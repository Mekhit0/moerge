-- Booking codes, client blocking and public-booking abuse checks.
-- Clients manage a booking with a 6-digit code plus their phone number, so no email is needed.

-- 1. Booking codes ----------------------------------------------------------------------------

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booking_code text;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_booking_code_format;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_booking_code_format
  CHECK (booking_code IS NULL OR booking_code ~ '^[0-9]{6}$');
CREATE UNIQUE INDEX IF NOT EXISTS appointments_booking_code_uidx
  ON public.appointments(booking_code) WHERE booking_code IS NOT NULL;

-- A code alone never unlocks a booking: lookups also require the client's phone number and are
-- rate limited, so 6 digits are enough and stay easy to read out over the phone.
CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public AS $$
DECLARE v_code text;
BEGIN
 FOR i IN 1..20 LOOP
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE booking_code = v_code) THEN
   RETURN v_code;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'Could not allocate a booking code' USING ERRCODE='P0001';
END; $$;
REVOKE ALL ON FUNCTION public.generate_booking_code() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.set_appointment_booking_code()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.booking_code IS NULL THEN
  NEW.booking_code := public.generate_booking_code();
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_appointment_booking_code() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS set_appointment_booking_code ON public.appointments;
CREATE TRIGGER set_appointment_booking_code BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_appointment_booking_code();

-- Existing appointments get codes one at a time so the uniqueness check sees earlier rows.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT id FROM public.appointments WHERE booking_code IS NULL LOOP
  UPDATE public.appointments SET booking_code = public.generate_booking_code() WHERE id = r.id;
 END LOOP;
END $$;

-- 2. Client blocking --------------------------------------------------------------------------

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS blocked_at timestamptz;

-- 3. Public booking guard: is this phone blocked, and how many upcoming bookings does it hold? --

CREATE OR REPLACE FUNCTION public.public_booking_guard(p_salon_id uuid, p_phone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_phone text; v_client public.clients%ROWTYPE; v_upcoming integer := 0;
BEGIN
 v_phone := public.normalize_georgian_phone(p_phone);
 IF v_phone IS NULL THEN
  RETURN jsonb_build_object('blocked', false, 'upcoming', 0);
 END IF;
 SELECT * INTO v_client FROM public.clients WHERE salon_id = p_salon_id AND normalized_phone = v_phone;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('blocked', false, 'upcoming', 0);
 END IF;
 SELECT count(*) INTO v_upcoming FROM public.appointments
 WHERE salon_id = p_salon_id AND client_id = v_client.id AND status = 'scheduled' AND starts_at > now();
 RETURN jsonb_build_object('blocked', v_client.is_blocked, 'upcoming', v_upcoming);
END; $$;
REVOKE ALL ON FUNCTION public.public_booking_guard(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.public_booking_guard(uuid,text) TO service_role;

-- 4. Code + phone lookup ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_booking_by_code(p_code text, p_phone text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT a.self_service_token
 FROM public.appointments a
 JOIN public.clients c ON c.id = a.client_id AND c.salon_id = a.salon_id
 WHERE a.booking_code = p_code
   AND c.normalized_phone = public.normalize_georgian_phone(p_phone)
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_booking_by_code(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.find_booking_by_code(text,text) TO service_role;

-- 5. Client replies reach the salon owner, not the Resend demo address -------------------------

UPDATE public.salon_settings ss
SET verified_sender_email = owner.email, updated_at = now()
FROM (
 SELECT DISTINCT ON (m.salon_id) m.salon_id, u.email
 FROM public.salon_memberships m
 JOIN auth.users u ON u.id = m.user_id
 WHERE m.role = 'owner' AND m.is_active AND u.email IS NOT NULL
 ORDER BY m.salon_id, m.created_at
) owner
WHERE ss.salon_id = owner.salon_id
  AND ss.verified_sender_email IN ('onboarding@resend.dev', 'reminders@example.com');
