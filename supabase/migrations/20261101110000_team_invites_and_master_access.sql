-- Dashboard step 5: everyone signs in.
-- 1. A master (membership role 'staff') is linked to one staff row and sees only their own visits,
--    the clients of those visits and their own payments. Owners and admins see the whole salon.
-- 2. Team invites: owner or admin invites by email with a one-time link. The link token is stored
--    only as a SHA-256 hash. Invites expire after 7 days.
-- 3. Membership changes go only through functions that protect the owner. Admins can no longer
--    write salon_memberships directly (they could have promoted themselves to owner).

-- Link a login to a master.
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_salon_user_uidx ON public.staff (salon_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_user_idx ON public.staff (user_id) WHERE user_id IS NOT NULL;

-- The staff row of the signed-in master in a salon, or null. Requires an active membership.
CREATE OR REPLACE FUNCTION public.current_staff_id(target_salon_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT s.id
  FROM public.staff s
  JOIN public.salon_memberships sm ON sm.salon_id = s.salon_id AND sm.user_id = s.user_id AND sm.is_active
  WHERE s.salon_id = target_salon_id AND s.user_id = auth.uid() AND s.is_active
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.current_staff_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_id(uuid) TO authenticated;

-- Appointments: masters read and update only their own visits; only admins create or delete.
DROP POLICY IF EXISTS "Salon members can select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Salon members can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Salon members can update appointments" ON public.appointments;
CREATE POLICY appointments_read ON public.appointments FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id) OR (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id)));
CREATE POLICY appointments_admin_insert ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY appointments_update ON public.appointments FOR UPDATE TO authenticated
  USING (public.user_is_salon_admin(salon_id) OR (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id)))
  WITH CHECK (public.user_is_salon_admin(salon_id) OR (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id)));

-- A master may only change the status and notes of a visit, and may not cancel or restore one.
CREATE OR REPLACE FUNCTION public.guard_master_appointment_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  v_free text[] := ARRAY['status', 'arrived_at', 'completed_at', 'next_expected_date', 'notes', 'updated_at'];
BEGIN
  IF auth.uid() IS NULL OR public.user_is_salon_admin(OLD.salon_id) THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
    RAISE EXCEPTION 'Masters can only change the status and notes of their visits' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'canceled' OR OLD.status = 'canceled') THEN
    RAISE EXCEPTION 'Only the salon can cancel or restore a visit' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_master_appointment_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_master_appointment_update ON public.appointments;
CREATE TRIGGER guard_master_appointment_update BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_master_appointment_update();

-- Clients: masters read only clients they have a visit with; only admins create or change clients.
DROP POLICY IF EXISTS "Salon members can select clients" ON public.clients;
DROP POLICY IF EXISTS "Salon members can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Salon members can update clients" ON public.clients;
CREATE POLICY clients_read ON public.clients FOR SELECT TO authenticated
  USING (
    public.user_is_salon_admin(salon_id)
    OR EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.client_id = clients.id AND a.salon_id = clients.salon_id
        AND a.staff_id IS NOT NULL AND a.staff_id = public.current_staff_id(clients.salon_id)
    )
  );
CREATE POLICY clients_admin_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY clients_admin_update ON public.clients FOR UPDATE TO authenticated
  USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));

-- Payments of visits: masters read only their own.
DROP POLICY IF EXISTS visit_payments_member_read ON public.visit_payments;
CREATE POLICY visit_payments_read ON public.visit_payments FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id) OR (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id)));

-- The booking code trigger calls a helper nobody may execute directly, so the trigger must run as
-- its owner. Without this, any insert outside create_appointment (imports, tests) fails.
ALTER FUNCTION public.set_appointment_booking_code() SECURITY DEFINER;

-- Messages, reminders and billing are for the salon office only.
DROP POLICY IF EXISTS "Salon members can select reminders" ON public.reminders;
DROP POLICY IF EXISTS "Salon members can insert reminders" ON public.reminders;
DROP POLICY IF EXISTS "Salon members can update reminders" ON public.reminders;
CREATE POLICY reminders_admin_all ON public.reminders FOR ALL TO authenticated
  USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));

DROP POLICY IF EXISTS "Salon members can select email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Salon members can insert email_logs" ON public.email_logs;
CREATE POLICY email_logs_admin_read ON public.email_logs FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
CREATE POLICY email_logs_admin_insert ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (public.user_is_salon_admin(salon_id));

DROP POLICY IF EXISTS notification_log_member_read ON public.notification_log;
CREATE POLICY notification_log_admin_read ON public.notification_log FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));

DROP POLICY IF EXISTS payments_member_read ON public.payments;
CREATE POLICY payments_admin_read ON public.payments FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
DROP POLICY IF EXISTS invoices_member_read ON public.invoices;
CREATE POLICY invoices_admin_read ON public.invoices FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
DROP POLICY IF EXISTS invoice_lines_member_read ON public.invoice_lines;
CREATE POLICY invoice_lines_admin_read ON public.invoice_lines FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
DROP POLICY IF EXISTS sms_wallet_member_read ON public.sms_wallet;
CREATE POLICY sms_wallet_admin_read ON public.sms_wallet FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));

-- Masters may block and free their own time.
CREATE POLICY time_off_master_insert ON public.time_off FOR INSERT TO authenticated
  WITH CHECK (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id));
CREATE POLICY time_off_master_delete ON public.time_off FOR DELETE TO authenticated
  USING (staff_id IS NOT NULL AND staff_id = public.current_staff_id(salon_id));

-- Memberships change only through the functions below.
DROP POLICY IF EXISTS "Salon admins manage memberships" ON public.salon_memberships;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.salon_memberships FROM authenticated, anon;

-- Taking payment is for the salon office, not masters.
CREATE OR REPLACE FUNCTION public.record_visit_payment(
  p_appointment_id uuid,
  p_price_gel numeric,
  p_discount_gel numeric,
  p_tip_gel numeric,
  p_cash_gel numeric,
  p_card_gel numeric
)
RETURNS public.visit_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_price numeric(10,2);
  v_discount numeric(10,2) := round(coalesce(p_discount_gel, 0), 2);
  v_tip numeric(10,2) := round(coalesce(p_tip_gel, 0), 2);
  v_cash numeric(10,2) := round(coalesce(p_cash_gel, 0), 2);
  v_card numeric(10,2) := round(coalesce(p_card_gel, 0), 2);
  v_row public.visit_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_salon_access(v_appointment.salon_id) THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.user_is_salon_admin(v_appointment.salon_id) THEN
    RAISE EXCEPTION 'Only the salon office can take payment' USING ERRCODE = '42501';
  END IF;
  IF v_appointment.status <> 'completed' THEN
    RAISE EXCEPTION 'Mark the visit as done before taking payment' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.visit_payments WHERE appointment_id = v_appointment.id AND voided_at IS NULL) THEN
    RAISE EXCEPTION 'This visit is already paid' USING ERRCODE = '23505';
  END IF;

  v_price := round(coalesce(p_price_gel, v_appointment.price_snapshot, v_appointment.price_gel, 0), 2);
  IF v_price < 0 OR v_price > 100000 OR v_discount < 0 OR v_discount > v_price OR v_tip < 0 OR v_tip > 100000 OR v_cash < 0 OR v_card < 0 THEN
    RAISE EXCEPTION 'Payment amounts are not valid' USING ERRCODE = '22023';
  END IF;
  IF v_cash + v_card <> v_price - v_discount + v_tip THEN
    RAISE EXCEPTION 'Cash and card must add up to the total' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.visit_payments (salon_id, appointment_id, client_id, staff_id, price_gel, discount_gel, tip_gel, cash_gel, card_gel, taken_by)
  VALUES (v_appointment.salon_id, v_appointment.id, v_appointment.client_id, v_appointment.staff_id, v_price, v_discount, v_tip, v_cash, v_card, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_visit_payment(uuid, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_visit_payment(uuid, numeric, numeric, numeric, numeric, numeric) TO authenticated;

-- Invites.
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1),
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  staff_id uuid,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role <> 'staff' OR staff_id IS NOT NULL),
  FOREIGN KEY (salon_id, staff_id) REFERENCES public.staff(salon_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX team_invites_one_pending_email ON public.team_invites (salon_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX team_invites_salon_idx ON public.team_invites (salon_id, created_at DESC);
CREATE INDEX team_invites_staff_idx ON public.team_invites (salon_id, staff_id);
CREATE INDEX team_invites_invited_by_idx ON public.team_invites (invited_by);
CREATE INDEX team_invites_accepted_by_idx ON public.team_invites (accepted_by);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_invites_admin_read ON public.team_invites FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
REVOKE ALL ON public.team_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, salon_id, email, role, staff_id, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;

-- Owner invites admins or masters; an admin invites masters only. Replaces any pending invite
-- for the same email. The caller passes the SHA-256 hash of a random token it keeps for the link.
CREATE OR REPLACE FUNCTION public.create_team_invite(
  p_salon_id uuid,
  p_email text,
  p_role text,
  p_staff_id uuid,
  p_token_hash text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_caller_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
BEGIN
  SELECT role INTO v_caller_role FROM public.salon_memberships
  WHERE salon_id = p_salon_id AND user_id = auth.uid() AND is_active;
  IF v_caller_role IS NULL OR v_caller_role = 'staff' OR (v_caller_role = 'admin' AND p_role <> 'staff') THEN
    RAISE EXCEPTION 'Not allowed to invite this role' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Unknown role' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  IF p_role = 'staff' THEN
    PERFORM 1 FROM public.staff WHERE id = p_staff_id AND salon_id = p_salon_id AND is_active AND user_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Master not found or already has a login' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.team_invites SET revoked_at = now()
    WHERE salon_id = p_salon_id AND staff_id = p_staff_id AND accepted_at IS NULL AND revoked_at IS NULL;
  ELSIF p_staff_id IS NOT NULL THEN
    RAISE EXCEPTION 'Admins are not linked to a master' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.salon_memberships sm JOIN public.user_profiles up ON up.id = sm.user_id
    WHERE sm.salon_id = p_salon_id AND sm.is_active AND lower(up.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Already a team member' USING ERRCODE = '23505';
  END IF;

  UPDATE public.team_invites SET revoked_at = now()
  WHERE salon_id = p_salon_id AND email = v_email AND accepted_at IS NULL AND revoked_at IS NULL;

  INSERT INTO public.team_invites (salon_id, email, role, staff_id, token_hash, invited_by)
  VALUES (p_salon_id, v_email, p_role, CASE WHEN p_role = 'staff' THEN p_staff_id END, p_token_hash, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_team_invite(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_invite(uuid, text, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_team_invite(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_invite public.team_invites%ROWTYPE;
  v_caller_role text;
BEGIN
  SELECT * INTO v_invite FROM public.team_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT role INTO v_caller_role FROM public.salon_memberships
  WHERE salon_id = v_invite.salon_id AND user_id = auth.uid() AND is_active;
  IF v_caller_role IS NULL OR v_caller_role = 'staff' OR (v_caller_role = 'admin' AND v_invite.role <> 'staff') THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.team_invites SET revoked_at = now()
  WHERE id = p_invite_id AND accepted_at IS NULL AND revoked_at IS NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.revoke_team_invite(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite(uuid) TO authenticated;

-- Called by the server right after the invited person creates their login. The new login must use
-- the invited email and must not belong to any salon yet.
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_token_hash text, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_invite public.team_invites%ROWTYPE;
  v_email text;
  v_full_name text;
BEGIN
  SELECT * INTO v_invite FROM public.team_invites
  WHERE token_hash = p_token_hash AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite is not valid' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(u.email), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), '')
  INTO v_email, v_full_name FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL OR v_email <> v_invite.email THEN
    RAISE EXCEPTION 'Invite is for another email' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.salon_memberships WHERE user_id = p_user_id AND is_active) THEN
    RAISE EXCEPTION 'This login already belongs to a salon' USING ERRCODE = '23505';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (p_user_id, v_email, COALESCE(v_full_name, split_part(v_email, '@', 1)))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(v_full_name, user_profiles.full_name);

  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_invite.salon_id, p_user_id, v_invite.role, true)
  ON CONFLICT (salon_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();

  IF v_invite.staff_id IS NOT NULL THEN
    UPDATE public.staff SET user_id = p_user_id, updated_at = now()
    WHERE id = v_invite.staff_id AND salon_id = v_invite.salon_id AND user_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This master already has a login' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.team_invites SET accepted_at = now(), accepted_by = p_user_id WHERE id = v_invite.id;
  RETURN v_invite.salon_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_team_invite(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text, uuid) TO service_role;

-- Only the owner changes a member's role or removes them. Owners cannot be changed here.
-- Removing a master also unlinks their login from the staff row, so the master can be invited again.
CREATE OR REPLACE FUNCTION public.update_team_member(p_salon_id uuid, p_user_id uuid, p_role text, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_target_role text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.salon_memberships
    WHERE salon_id = p_salon_id AND user_id = auth.uid() AND is_active AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the owner can change the team' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_target_role FROM public.salon_memberships
  WHERE salon_id = p_salon_id AND user_id = p_user_id FOR UPDATE;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'The owner cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Unknown role' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'staff' AND p_is_active AND NOT EXISTS (
    SELECT 1 FROM public.staff WHERE salon_id = p_salon_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'A master login must be linked to a master' USING ERRCODE = '23514';
  END IF;

  UPDATE public.salon_memberships SET role = p_role, is_active = p_is_active, updated_at = now()
  WHERE salon_id = p_salon_id AND user_id = p_user_id;
  IF NOT p_is_active THEN
    UPDATE public.staff SET user_id = NULL, updated_at = now() WHERE salon_id = p_salon_id AND user_id = p_user_id;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.update_team_member(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member(uuid, uuid, text, boolean) TO authenticated;

-- A removed team member must not get a new empty salon on their next sign-in.
CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name text DEFAULT 'My Salon'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_full_name text;
  v_salon_id uuid;
  v_salon_name text;
  v_slug text;
  v_meta_salon_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  SELECT
    u.email,
    NULLIF(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(pg_catalog.btrim(u.raw_user_meta_data->>'salon_name'), '')
  INTO v_user_email, v_full_name, v_meta_salon_name
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    v_user_id,
    COALESCE(v_user_email, ''),
    COALESCE(
      v_full_name,
      NULLIF(pg_catalog.split_part(COALESCE(v_user_email, ''), '@', 1), ''),
      'Salon Staff'
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(v_full_name, user_profiles.full_name);

  SELECT sm.salon_id
  INTO v_salon_id
  FROM public.salon_memberships AS sm
  WHERE sm.user_id = v_user_id
    AND sm.is_active
  ORDER BY sm.created_at
  LIMIT 1;

  IF v_salon_id IS NOT NULL THEN
    RETURN v_salon_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.salon_memberships WHERE user_id = v_user_id) THEN
    RETURN NULL;
  END IF;

  v_salon_name := COALESCE(
    v_meta_salon_name,
    NULLIF(pg_catalog.btrim(p_default_salon_name), ''),
    'My Salon'
  );
  v_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(v_salon_name, '[^a-zA-Z0-9]+', '-', 'g')
  );
  IF v_slug = '' OR v_slug = '-' THEN
    v_slug := 'salon';
  END IF;
  v_slug := v_slug || '-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 6);

  INSERT INTO public.salons (
    name,
    slug,
    subscription_tier,
    subscription_status,
    trial_ends_at
  )
  VALUES (v_salon_name, v_slug, 'starter', 'trialing', now() + interval '14 days')
  RETURNING id INTO v_salon_id;

  INSERT INTO public.salon_settings (
    salon_id,
    salon_name,
    sender_display_name,
    verified_sender_email,
    timezone,
    reminder_interval_days,
    booking_url,
    auto_reminders_enabled,
    dry_run_mode,
    booking_title,
    booking_subtitle,
    salon_address,
    salon_phone,
    working_hours_start,
    working_hours_end,
    slot_interval_minutes,
    send_booking_confirmation_email
  )
  VALUES (
    v_salon_id,
    v_salon_name,
    v_salon_name,
    'onboarding@resend.dev',
    'Asia/Tbilisi',
    21,
    'https://moarge.ge/book?salon=' || v_slug,
    true,
    false,
    'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online',
    'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო. | Choose a service, staff member and available time.',
    'თბილისი, ჭავჭავაძის გამზ. 34',
    '+995 555 00 11 22',
    '10:00',
    '20:00',
    60,
    true
  );

  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_user_id, 'owner', true);

  RETURN v_salon_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_salon(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_salon(text)
  TO authenticated;
