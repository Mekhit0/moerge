-- Phase 0 security hardening. Apply only to a confirmed staging project.
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS public.public_booking_rate_limit_counters (
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  rate_key text NOT NULL,
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (rate_key, bucket_start)
);
ALTER TABLE public.public_booking_rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_booking_rate_limit_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_booking_rate_limit_counters TO service_role;

ALTER TABLE public.public_booking_rate_limits
  ADD COLUMN IF NOT EXISTS salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE;
ALTER TABLE public.public_booking_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_booking_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_booking_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_request_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allowed boolean;
  v_bucket timestamptz;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit < 1 OR p_window_seconds < 1 OR p_rate_key IS NULL OR length(p_rate_key) > 300 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;
  IF p_window_seconds = 86400 THEN
    v_bucket := date_trunc('day', now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi';
  ELSE
    v_bucket := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  END IF;
  INSERT INTO public.public_booking_rate_limit_counters(salon_id, rate_key, bucket_start, request_count)
  VALUES (NULL, md5(p_rate_key), v_bucket, 1)
  ON CONFLICT (rate_key, bucket_start) DO UPDATE
    SET request_count = public.public_booking_rate_limit_counters.request_count + 1
    WHERE public.public_booking_rate_limit_counters.request_count < p_limit
  RETURNING true INTO v_allowed;
  RETURN COALESCE(v_allowed, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_public_request_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_request_limit(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.is_verified_auth_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(trim(p_email)) AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_verified_auth_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_auth_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.user_is_salon_admin(target_salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM public.salon_memberships sm WHERE sm.salon_id = target_salon_id AND sm.user_id = auth.uid() AND sm.is_active AND sm.role IN ('owner', 'admin'));
$$;
REVOKE EXECUTE ON FUNCTION public.user_is_salon_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_salon_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Salon members can update their salons" ON public.salons;
CREATE POLICY "Salon admins can update their salons" ON public.salons FOR UPDATE TO authenticated USING (public.user_is_salon_admin(id)) WITH CHECK (public.user_is_salon_admin(id));
DROP POLICY IF EXISTS "Salon members can update salon_settings" ON public.salon_settings;
CREATE POLICY "Salon admins can update salon_settings" ON public.salon_settings FOR UPDATE TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
DROP POLICY IF EXISTS "Salon members can insert salon_settings" ON public.salon_settings;
CREATE POLICY "Salon admins can insert salon_settings" ON public.salon_settings FOR INSERT TO authenticated WITH CHECK (public.user_is_salon_admin(salon_id));
ALTER TABLE public.salon_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salon admins manage memberships" ON public.salon_memberships FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY "Salon admins delete clients" ON public.clients FOR DELETE TO authenticated USING (public.user_is_salon_admin(salon_id));
CREATE POLICY "Salon admins delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.user_is_salon_admin(salon_id));

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
  v_salon_id uuid;
  v_salon_name text;
  v_slug text;
  v_meta_salon_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, (raw_user_meta_data->>'salon_name')
  INTO v_user_email, v_meta_salon_name
  FROM auth.users
  WHERE id = v_user_id;

  v_meta_salon_name := NULLIF(trim(v_meta_salon_name), '');

  -- 1. Check if user already has an active salon membership
  SELECT salon_id INTO v_salon_id
  FROM public.salon_memberships
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_salon_id IS NOT NULL THEN
    IF v_meta_salon_name IS NOT NULL THEN
      UPDATE public.salons
      SET name = v_meta_salon_name
      WHERE id = v_salon_id AND (name = 'moarge Epilation & Beauty Studio' OR name = 'moarge Studio');

      UPDATE public.salon_settings
      SET salon_name = v_meta_salon_name,
          sender_display_name = v_meta_salon_name
      WHERE salon_id = v_salon_id AND (salon_name = 'moarge Epilation & Beauty Studio' OR salon_name = 'moarge Studio');
    END IF;
    RETURN v_salon_id;
  END IF;

  -- 2. Determine salon name for new registration
  v_salon_name := COALESCE(v_meta_salon_name, NULLIF(trim(p_default_salon_name), ''), 'My Salon');
  -- Create a dedicated trial salon for this authenticated user
  v_slug := lower(regexp_replace(v_salon_name, '[^a-zA-Z0-9]+', '-', 'g'));
  IF v_slug = '' OR v_slug = '-' THEN
    v_slug := 'salon';
  END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.salons (name, slug, subscription_tier, subscription_status, trial_ends_at)
  VALUES (v_salon_name, v_slug, 'starter', 'trialing', now() + interval '14 days')
  RETURNING id INTO v_salon_id;

  -- Create salon settings with Georgia timezone, auto-generated booking URL and live mode (dry_run_mode = false)
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
    send_booking_confirmation_email,
    custom_services
  ) VALUES (
    v_salon_id,
    v_salon_name,
    v_salon_name,
    'onboarding@resend.dev',
    'Asia/Tbilisi',
    21,
    'https://moarge.ge/book?salon=' || v_slug,
    true,
    false, -- PRODUCTION READY: live delivery enabled by default
    'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online',
    'აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური 21-დღიანი შეხსენება.',
    'თბილისი, ჭავჭავაძის გამზ. 34',
    '+995 555 00 11 22',
    '10:00',
    '20:00',
    60,
    true,
    '[
      {"id":"srv_laser_full","type":"laser_epilation","name_ka":"ლაზერული ეპილაცია (სრული ზონა)","name_en":"Laser Epilation (Full Body)","desc_ka":"დიოდური / ალექსანდრიტის უმტკივნეულო ეპილაცია","desc_en":"Painless diode/alexandrite laser epilation","price_gel":120,"duration_minutes":60,"is_epilation":true,"enabled":true},
      {"id":"srv_laser_bikini","type":"laser_epilation","name_ka":"ღრმა ბიკინი + იღლია","name_en":"Deep Bikini + Underarms","desc_ka":"სწრაფი და ეფექტური პროცედურა თანამედროვე აპარატით","desc_en":"Fast and effective modern laser procedure","price_gel":65,"duration_minutes":45,"is_epilation":true,"enabled":true},
      {"id":"srv_facial_deep","type":"facial","name_ka":"სახის ღრმა წმენდა და დატენიანება","name_en":"Deep Facial Cleansing & Hydration","desc_ka":"კომბინირებული ულტრაბგერითი და მექანიკური წმენდა","desc_en":"Ultrasonic and manual deep facial cleansing","price_gel":80,"duration_minutes":60,"is_epilation":false,"enabled":true},
      {"id":"srv_wax_legs","type":"wax_epilation","name_ka":"ბიოეპილაცია (მთლიანი ფეხები)","name_en":"Full Legs Waxing","desc_ka":"პრემიუმ ხარისხის იტალიური ცვილით დამუშავება","desc_en":"Premium Italian wax hair removal","price_gel":45,"duration_minutes":40,"is_epilation":true,"enabled":true}
    ]'::jsonb
  );

  -- Link user as owner
  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_user_id, 'owner', true);

  RETURN v_salon_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_user_salon(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_salon(text) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_due_reminders(text, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.record_reminder_send_result(text, uuid, text, text, text, text, text, timestamptz, integer, boolean, jsonb);
DROP FUNCTION IF EXISTS public.process_email_webhook_event(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.unsubscribe_client_by_token(uuid);
DROP FUNCTION IF EXISTS public.submit_public_booking(text, text, text, text, date, time, text, text, boolean);
DROP FUNCTION IF EXISTS public.get_salon_date_availability(text, date, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_public_salon_booking_info(text);
ALTER TABLE public.salon_settings DROP COLUMN IF EXISTS resend_api_key;

CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_limit INTEGER DEFAULT 25,
  p_salon_id UUID DEFAULT NULL,
  p_specific_reminder_id UUID DEFAULT NULL
)
RETURNS TABLE (
  reminder_id UUID,
  salon_id UUID,
  client_id UUID,
  appointment_id UUID,
  scheduled_for_date DATE,
  scheduled_send_at TIMESTAMPTZ,
  idempotency_key TEXT,
  attempt_count INTEGER,
  max_attempts INTEGER,
  client_name TEXT,
  client_email TEXT,
  client_archived BOOLEAN,
  client_consent BOOLEAN,
  client_unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token UUID,
  treatment_date DATE,
  treatment_type TEXT,
  appointment_status TEXT,
  salon_name TEXT,
  sender_display_name TEXT,
  verified_sender_email TEXT,
  timezone TEXT,
  email_subject TEXT,
  email_body_template TEXT,
  booking_url TEXT,
  brand_color TEXT,
  dry_run_mode BOOLEAN,
  test_recipient_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Strict authorization: only service_role (server background worker) can claim due reminders
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: claim_due_reminders can only be executed by service_role';
  END IF;

  RETURN QUERY
  WITH due_candidates AS (
    SELECT r.id
    FROM public.reminders r
    JOIN public.salon_settings ss ON ss.salon_id = r.salon_id
    WHERE (p_salon_id IS NULL OR r.salon_id = p_salon_id)
      AND (
        (
          p_specific_reminder_id IS NOT NULL
          AND r.id = p_specific_reminder_id
          AND r.status IN ('scheduled', 'failed')
          AND r.is_permanent_failure = false
        )
        OR (
          p_specific_reminder_id IS NULL
          AND r.status = 'scheduled'
          AND ss.auto_reminders_enabled = true
          AND r.scheduled_send_at <= now()
          AND (r.next_retry_at IS NULL OR r.next_retry_at <= now())
          AND r.attempt_count < r.max_attempts
          AND r.is_permanent_failure = false
        )
      )
      AND EXISTS (
        SELECT 1 FROM public.salons s
        WHERE s.id = r.salon_id
          AND (s.subscription_status = 'active' OR (s.subscription_status = 'trialing' AND s.trial_ends_at > now()))
      )
    ORDER BY r.scheduled_send_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
    FOR UPDATE OF r SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.reminders r
    SET status = 'processing',
        processing_locked_at = now(),
        attempt_count = r.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    FROM due_candidates dc
    WHERE r.id = dc.id
    RETURNING r.*
  )
  SELECT
    c.id AS reminder_id,
    c.salon_id,
    c.client_id,
    c.appointment_id,
    c.scheduled_for_date,
    c.scheduled_send_at,
    c.idempotency_key,
    c.attempt_count,
    c.max_attempts,
    cl.full_name AS client_name,
    cl.email AS client_email,
    cl.is_archived AS client_archived,
    cl.email_consent AS client_consent,
    cl.unsubscribed_at AS client_unsubscribed_at,
    cl.unsubscribe_token,
    a.treatment_date,
    a.treatment_type::text,
    a.status::text AS appointment_status,
    ss.salon_name,
    ss.sender_display_name,
    ss.verified_sender_email,
    ss.timezone,
    ss.email_subject,
    ss.email_body_template,
    ss.booking_url,
    ss.brand_color,
    ss.dry_run_mode,
    ss.test_recipient_email
  FROM claimed c
  JOIN public.clients cl ON cl.id = c.client_id
  JOIN public.appointments a ON a.id = c.appointment_id
  JOIN public.salon_settings ss ON ss.salon_id = c.salon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_reminder_send_result(
  p_reminder_id UUID DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_next_retry_at TIMESTAMPTZ DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_is_dry_run BOOLEAN DEFAULT false,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rem public.reminders%ROWTYPE;
  v_log_event TEXT;
BEGIN
  SELECT * INTO v_rem FROM public.reminders WHERE id = p_reminder_id;
  IF v_rem.id IS NULL THEN
    RAISE EXCEPTION 'Reminder % not found', p_reminder_id;
  END IF;

  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized to record reminder result';
  END IF;

  IF p_outcome = 'api_accepted' THEN
    v_log_event := 'api_accepted';
    UPDATE public.reminders
    SET status = 'sent',
        actual_sent_at = now(),
        provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
        failure_reason = NULL,
        next_retry_at = NULL,
        processing_locked_at = NULL
    WHERE id = p_reminder_id;

  ELSIF p_outcome = 'dry_run_delivered' THEN
    v_log_event := 'dry_run_simulated';
    UPDATE public.reminders
    SET status = 'sent',
        actual_sent_at = now(),
        provider_message_id = COALESCE(p_provider_message_id, 'dryrun_' || gen_random_uuid()::text),
        failure_reason = NULL,
        next_retry_at = NULL,
        processing_locked_at = NULL
    WHERE id = p_reminder_id;

  ELSIF p_outcome = 'retry_scheduled' THEN
    v_log_event := 'retry_scheduled';
    UPDATE public.reminders
    SET status = 'scheduled',
        failure_reason = p_error_message,
        next_retry_at = p_next_retry_at,
        processing_locked_at = NULL
    WHERE id = p_reminder_id;

  ELSIF p_outcome = 'canceled_suppressed' THEN
    v_log_event := 'canceled';
    UPDATE public.reminders
    SET status = 'canceled',
        canceled_at = now(),
        cancel_reason = p_error_message,
        failure_reason = p_error_message,
        processing_locked_at = NULL
    WHERE id = p_reminder_id;

  ELSE
    v_log_event := 'failed';
    UPDATE public.reminders
    SET status = 'failed',
        failure_reason = p_error_message,
        is_permanent_failure = true,
        next_retry_at = NULL,
        processing_locked_at = NULL
    WHERE id = p_reminder_id;
  END IF;

  INSERT INTO public.email_logs (
    salon_id,
    reminder_id,
    client_id,
    appointment_id,
    recipient_email,
    subject,
    event_type,
    provider_message_id,
    idempotency_key,
    attempt_number,
    status_code,
    error_message,
    is_dry_run,
    raw_payload
  ) VALUES (
    v_rem.salon_id,
    v_rem.id,
    v_rem.client_id,
    v_rem.appointment_id,
    COALESCE(p_recipient_email, 'unknown@example.com'),
    COALESCE(p_subject, 'Reminder Email'),
    v_log_event,
    p_provider_message_id,
    v_rem.idempotency_key,
    GREATEST(v_rem.attempt_count, 1),
    p_status_code,
    p_error_message,
    p_is_dry_run,
    p_raw_payload
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_email_webhook_event(
  p_provider_message_id TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rem public.reminders%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_mapped_event TEXT;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized webhook caller';
  END IF;

  SELECT * INTO v_rem
  FROM public.reminders
  WHERE provider_message_id = p_provider_message_id
  LIMIT 1;

  IF v_rem.id IS NULL THEN
    RETURN jsonb_build_object(
      'matched', false,
      'reason', 'No reminder found for provider_message_id ' || COALESCE(p_provider_message_id, 'null')
    );
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = v_rem.client_id;

  v_mapped_event := CASE p_event_type
    WHEN 'email.delivered' THEN 'delivered'
    WHEN 'email.bounced' THEN 'bounced'
    WHEN 'email.complained' THEN 'complained'
    WHEN 'email.delivery_delayed' THEN 'retry_scheduled'
    ELSE 'failed'
  END;

  IF p_event_type = 'email.delivered' THEN
    UPDATE public.reminders
    SET status = 'delivered',
        delivered_at = COALESCE(delivered_at, now()),
        updated_at = now()
    WHERE id = v_rem.id;

  ELSIF p_event_type = 'email.bounced' THEN
    UPDATE public.reminders
    SET status = 'bounced',
        failure_reason = COALESCE(p_error_message, 'Email provider reported bounce'),
        is_permanent_failure = true,
        updated_at = now()
    WHERE id = v_rem.id;

    UPDATE public.clients
    SET is_archived = true,
        archived_at = COALESCE(archived_at, now()),
        notes = COALESCE(notes, '') || E'\n[Auto-archived: Email bounced via Resend webhook]'
    WHERE id = v_rem.client_id;

  ELSIF p_event_type = 'email.complained' THEN
    UPDATE public.reminders
    SET status = 'canceled',
        cancel_reason = 'Client registered spam complaint via provider',
        updated_at = now()
    WHERE id = v_rem.id;

    UPDATE public.clients
    SET email_consent = false,
        unsubscribed_at = COALESCE(unsubscribed_at, now()),
        notes = COALESCE(notes, '') || E'\n[Unsubscribed: Client spam complaint reported by provider]'
    WHERE id = v_rem.client_id;
  END IF;

  INSERT INTO public.email_logs (
    salon_id,
    reminder_id,
    client_id,
    appointment_id,
    recipient_email,
    subject,
    event_type,
    provider_message_id,
    idempotency_key,
    attempt_number,
    status_code,
    error_message,
    is_dry_run,
    raw_payload
  ) VALUES (
    v_rem.salon_id,
    v_rem.id,
    v_rem.client_id,
    v_rem.appointment_id,
    COALESCE(v_client.email, 'unknown@example.com'),
    'Resend Webhook Event: ' || p_event_type,
    v_mapped_event,
    p_provider_message_id,
    v_rem.idempotency_key,
    v_rem.attempt_count,
    200,
    p_error_message,
    false,
    p_raw_payload
  );

  RETURN jsonb_build_object(
    'matched', true,
    'reminder_id', v_rem.id,
    'salon_id', v_rem.salon_id,
    'event_recorded', v_mapped_event
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unsubscribe_client_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client RECORD;
  v_canceled_count INTEGER := 0;
BEGIN
  SELECT c.id, c.full_name, c.email, c.salon_id, s.salon_name
  INTO v_client
  FROM public.clients c
  JOIN public.salon_settings s ON s.salon_id = c.salon_id
  WHERE c.unsubscribe_token = p_token
  LIMIT 1;

  IF v_client.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired unsubscribe link.');
  END IF;

  UPDATE public.clients
  SET email_consent = false,
      unsubscribed_at = COALESCE(unsubscribed_at, now())
  WHERE id = v_client.id;

  WITH canceled_rows AS (
    UPDATE public.reminders
    SET status = 'canceled',
        canceled_at = now(),
        cancel_reason = 'Client unsubscribed from email reminders'
    WHERE client_id = v_client.id
      AND status = 'scheduled'
    RETURNING id
  )
  SELECT count(*) INTO v_canceled_count FROM canceled_rows;

  RETURN jsonb_build_object(
    'success', true,
    'client_name', v_client.full_name,
    'salon_name', v_client.salon_name,
    'canceled_reminders', v_canceled_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_salon_booking_info(p_slug TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'found', true,
    'salon_id', s.id,
    'slug', s.slug,
    'salon_name', ss.salon_name,
    'timezone', ss.timezone,
    'brand_color', ss.brand_color,
    'reminder_interval_days', ss.reminder_interval_days,
    'booking_title', ss.booking_title,
    'booking_subtitle', ss.booking_subtitle,
    'salon_address', ss.salon_address,
    'salon_phone', ss.salon_phone,
    'working_hours_start', ss.working_hours_start,
    'working_hours_end', ss.working_hours_end,
    'slot_interval_minutes', ss.slot_interval_minutes,
    'custom_services', ss.custom_services
  )
  INTO v_result
  FROM public.salons s
  JOIN public.salon_settings ss ON ss.salon_id = s.id
  WHERE (p_slug IS NULL OR p_slug = '' OR s.slug = p_slug)
    AND (s.subscription_status = 'active' OR (s.subscription_status = 'trialing' AND s.trial_ends_at > now()))
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_salon_date_availability(
  p_salon_slug TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_salon_id UUID DEFAULT NULL,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_salon_id UUID;
  v_work_start TIME := '10:00:00'::time;
  v_work_end TIME := '20:00:00'::time;
  v_interval_mins INTEGER := 60;
  v_buffer_secs INTEGER := 2700; -- 45 min default conflict buffer
  v_custom_services JSONB;
  v_service_max_mins INTEGER := 45;
  v_booked_times TEXT[];
  v_curr_time TIME;
  v_slot_str TEXT;
  v_has_conflict BOOLEAN;
  v_slots_result JSONB := '[]'::jsonb;
  v_available_slots TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_salon_id IS NOT NULL THEN
    v_salon_id := p_salon_id;
  ELSE
    SELECT s.id INTO v_salon_id
    FROM public.salons s
    WHERE (p_salon_slug IS NULL OR p_salon_slug = '' OR s.slug = p_salon_slug)
      AND (s.subscription_status = 'active' OR (s.subscription_status = 'trialing' AND s.trial_ends_at > now()))
    ORDER BY s.created_at ASC
    LIMIT 1;
  END IF;

  IF v_salon_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'booked_times', '[]'::jsonb,
      'slots', '[]'::jsonb,
      'available_slots', '[]'::jsonb
    );
  END IF;

  -- Load custom working hours & interval from salon_settings
  SELECT
    COALESCE(NULLIF(ss.working_hours_start, '')::time, '10:00:00'::time),
    COALESCE(NULLIF(ss.working_hours_end, '')::time, '20:00:00'::time),
    GREATEST(15, LEAST(180, COALESCE(ss.slot_interval_minutes, 60))),
    ss.custom_services
  INTO v_work_start, v_work_end, v_interval_mins, v_custom_services
  FROM public.salon_settings ss
  WHERE ss.salon_id = v_salon_id;

  IF jsonb_typeof(v_custom_services) = 'array' THEN
    SELECT GREATEST(15, LEAST(180, COALESCE(max((service->>'duration_minutes')::integer), 45)))
    INTO v_service_max_mins
    FROM jsonb_array_elements(v_custom_services) AS service
    WHERE COALESCE((service->>'enabled')::boolean, true);
  END IF;
  v_buffer_secs := v_service_max_mins * 60;

  -- Fetch all active appointment times on p_date
  SELECT COALESCE(array_agg(to_char(a.treatment_time, 'HH24:MI') ORDER BY a.treatment_time), ARRAY[]::TEXT[])
  INTO v_booked_times
  FROM public.appointments a
  WHERE a.salon_id = v_salon_id
    AND a.treatment_date = p_date
    AND a.status IN ('scheduled', 'completed')
    AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id);

  -- Dynamically generate slots from working_hours_start to working_hours_end
  v_curr_time := v_work_start;
  WHILE v_curr_time + make_interval(secs => v_buffer_secs) <= v_work_end LOOP
    v_slot_str := to_char(v_curr_time, 'HH24:MI');

    SELECT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.salon_id = v_salon_id
        AND a.treatment_date = p_date
        AND a.status IN ('scheduled', 'completed')
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND a.treatment_time < v_curr_time + make_interval(secs => v_buffer_secs)
        AND a.treatment_time + make_interval(mins => COALESCE(a.duration_minutes, 45)) > v_curr_time
    ) INTO v_has_conflict;

    v_slots_result := v_slots_result || jsonb_build_object(
      'time', v_slot_str,
      'available', NOT v_has_conflict
    );

    IF NOT v_has_conflict THEN
      v_available_slots := array_append(v_available_slots, v_slot_str);
    END IF;

    v_curr_time := v_curr_time + make_interval(mins => v_interval_mins);
    -- Prevent wrap-around past midnight
    IF v_curr_time < v_work_start THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'found', true,
    'salon_id', v_salon_id,
    'date', p_date,
    'working_hours_start', to_char(v_work_start, 'HH24:MI'),
    'working_hours_end', to_char(v_work_end, 'HH24:MI'),
    'slot_interval_minutes', v_interval_mins,
    'booked_times', to_jsonb(v_booked_times),
    'slots', v_slots_result,
    'available_slots', to_jsonb(v_available_slots)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_salon_slug TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_treatment_date DATE DEFAULT NULL,
  p_treatment_time TIME DEFAULT '10:30:00',
  p_treatment_type TEXT DEFAULT 'laser_epilation',
  p_notes TEXT DEFAULT NULL,
  p_email_consent BOOLEAN DEFAULT true,
  p_client_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_salon_id UUID;
  v_salon_name TEXT;
  v_custom_services JSONB;
  v_service_elem JSONB;
  v_service_id TEXT := NULL;
  v_service_name TEXT := NULL;
  v_price_gel NUMERIC(10,2) := NULL;
  v_duration_mins INTEGER := 45;
  v_is_epilation BOOLEAN := false;
  v_normalized_email TEXT;
  v_client_id UUID;
  v_is_returning BOOLEAN := false;
  v_appointment_id UUID;
  v_conflicting_time TEXT;
  v_availability JSONB;
  v_recent_email_bookings INTEGER;
  v_work_start TIME;
  v_work_end TIME;
BEGIN
  -- 1. Resolve Salon
  SELECT s.id, ss.salon_name, ss.custom_services
  INTO v_salon_id, v_salon_name, v_custom_services
  FROM public.salons s
  JOIN public.salon_settings ss ON ss.salon_id = s.id
  WHERE (p_salon_slug IS NULL OR p_salon_slug = '' OR s.slug = p_salon_slug)
    AND (s.subscription_status = 'active' OR (s.subscription_status = 'trialing' AND s.trial_ends_at > now()))
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_salon_id IS NULL THEN
    RAISE EXCEPTION 'Salon not found or inactive';
  END IF;

  v_normalized_email := lower(trim(COALESCE(p_email, '')));
  IF v_normalized_email = '' OR v_normalized_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Please provide a valid email address / გთხოვთ მიუთითოთ სწორი ელ-ფოსტა';
  END IF;

  IF char_length(trim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Please provide your full name / გთხოვთ მიუთითოთ სახელი და გვარი';
  END IF;

  IF p_treatment_date IS NULL OR p_treatment_date < (now() AT TIME ZONE 'Asia/Tbilisi')::date OR p_treatment_date > (now() AT TIME ZONE 'Asia/Tbilisi')::date + 90 THEN
    RAISE EXCEPTION 'Appointment date must be today or within the next 90 days';
  END IF;

  -- 2. Match service from salon's custom_services catalog
  v_is_epilation := p_treatment_type IN ('epilation', 'laser_epilation', 'wax_epilation', 'sugaring_epilation');
  v_service_id := p_treatment_type;
  v_service_name := p_treatment_type;

  IF v_custom_services IS NOT NULL AND jsonb_typeof(v_custom_services) = 'array' THEN
    SELECT elem
    INTO v_service_elem
    FROM jsonb_array_elements(v_custom_services) elem
    WHERE elem->>'id' = p_treatment_type AND COALESCE((elem->>'enabled')::boolean, true)
    LIMIT 1;

    IF v_service_elem IS NOT NULL THEN
      v_service_id := v_service_elem->>'id';
      v_service_name := COALESCE(v_service_elem->>'name_ka', v_service_elem->>'name_en', p_treatment_type);
      IF (v_service_elem->>'price_gel') IS NOT NULL THEN
        v_price_gel := (v_service_elem->>'price_gel')::numeric;
      END IF;
      IF (v_service_elem->>'duration_minutes') IS NOT NULL THEN
        v_duration_mins := (v_service_elem->>'duration_minutes')::integer;
      END IF;
      IF (v_service_elem->>'is_epilation') IS NOT NULL THEN
        v_is_epilation := (v_service_elem->>'is_epilation')::boolean;
      END IF;
    END IF;
  END IF;

  IF v_service_elem IS NULL THEN RAISE EXCEPTION 'Select an available service'; END IF;

  SELECT COALESCE(NULLIF(working_hours_start, '')::time, '10:00'::time),
         COALESCE(NULLIF(working_hours_end, '')::time, '20:00'::time)
  INTO v_work_start, v_work_end
  FROM public.salon_settings
  WHERE salon_id = v_salon_id;

  IF COALESCE(p_treatment_time, '10:30'::time) < v_work_start
     OR COALESCE(p_treatment_time, '10:30'::time) + make_interval(mins => v_duration_mins) > v_work_end THEN
    RAISE EXCEPTION 'Selected service does not fit within salon working hours';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_salon_id::text || ':' || p_treatment_date::text));

  -- 3. Smart Conflict Detection: evaluate against existing appointments with duration
  SELECT to_char(a.treatment_time, 'HH24:MI')
  INTO v_conflicting_time
  FROM public.appointments a
  WHERE a.salon_id = v_salon_id
    AND a.treatment_date = p_treatment_date
    AND a.status IN ('scheduled', 'completed')
    AND a.treatment_time < COALESCE(p_treatment_time, '10:30:00'::time) + make_interval(mins => COALESCE(v_duration_mins, 45))
    AND a.treatment_time + make_interval(mins => COALESCE(a.duration_minutes, 45)) > COALESCE(p_treatment_time, '10:30:00'::time)
  ORDER BY a.treatment_time ASC
  LIMIT 1;

  IF v_conflicting_time IS NOT NULL THEN
    v_availability := public.get_salon_date_availability(p_salon_slug, p_treatment_date, v_salon_id, NULL);
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'conflicting_time', v_conflicting_time,
      'available_slots', v_availability->'available_slots',
      'error', format(
        'Time slot %s on %s is unavailable (conflicts with %s booking). Please choose one of the available times.',
        to_char(COALESCE(p_treatment_time, '10:30:00'::time), 'HH24:MI'),
        p_treatment_date::text,
        v_conflicting_time
      ),
      'error_ka', format(
        'არჩეული დრო (%s, %s) დაკავებულია (ემთხვევა %s ჯავშანს). გთხოვთ აირჩიოთ თავისუფალი დრო.',
        to_char(COALESCE(p_treatment_time, '10:30:00'::time), 'HH24:MI'),
        p_treatment_date::text,
        v_conflicting_time
      )
    );
  END IF;

  IF NOT public.consume_public_request_limit('booking:email:' || v_normalized_email, 3, 86400) THEN
    RAISE EXCEPTION 'Daily booking limit reached for this email';
  END IF;
  IF p_client_ip IS NOT NULL THEN
    IF NOT public.consume_public_request_limit('booking:ip:' || p_client_ip, 5, 3600) THEN
      RAISE EXCEPTION 'Hourly booking limit reached for this network';
    END IF;
  END IF;

  -- 4. Upsert or find client
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE salon_id = v_salon_id
    AND normalized_email = v_normalized_email
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    v_is_returning := true;
    UPDATE public.clients
    SET full_name = trim(p_full_name),
        phone = COALESCE(NULLIF(trim(COALESCE(p_phone, '')), ''), phone),
        is_archived = false,
        archived_at = NULL,
        email_consent = CASE
          WHEN p_email_consent = true THEN true
          ELSE email_consent
        END,
        unsubscribed_at = CASE
          WHEN p_email_consent = true THEN NULL
          ELSE unsubscribed_at
        END
    WHERE id = v_client_id;
  ELSE
    INSERT INTO public.clients (
      salon_id,
      full_name,
      email,
      phone,
      notes,
      email_consent,
      unsubscribed_at
    ) VALUES (
      v_salon_id,
      trim(p_full_name),
      v_normalized_email,
      NULLIF(trim(COALESCE(p_phone, '')), ''),
      'Registered via online booking form',
      COALESCE(p_email_consent, true),
      CASE WHEN COALESCE(p_email_consent, true) THEN NULL ELSE now() END
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- 5. Record Appointment with smart service details
  INSERT INTO public.appointments (
    salon_id,
    client_id,
    treatment_date,
    treatment_time,
    treatment_type,
    is_epilation,
    status,
    notes,
    service_id,
    service_name,
    price_gel,
    duration_minutes
  ) VALUES (
    v_salon_id,
    v_client_id,
    p_treatment_date,
    COALESCE(p_treatment_time, '10:30:00'::time),
    v_service_id,
    v_is_epilation,
    'scheduled',
    CASE
      WHEN p_notes IS NOT NULL AND trim(p_notes) <> ''
        THEN '[Online Booking] ' || trim(p_notes)
      ELSE '[Online Booking] Booked via client booking form'
    END,
    v_service_id,
    v_service_name,
    v_price_gel,
    v_duration_mins
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'conflict', false,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'salon_id', v_salon_id,
    'salon_name', v_salon_name,
    'is_returning_client', v_is_returning,
    'treatment_date', p_treatment_date,
    'treatment_time', COALESCE(p_treatment_time, '10:30:00'::time),
    'treatment_type', p_treatment_type,
    'service_name', v_service_name,
    'price_gel', v_price_gel,
    'duration_minutes', v_duration_mins
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_reminders(integer, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(integer, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_reminder_send_result(uuid, text, text, text, text, text, timestamptz, integer, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reminder_send_result(uuid, text, text, text, text, text, timestamptz, integer, boolean, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_email_webhook_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_email_webhook_event(text, text, text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_client_by_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_client_by_token(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.submit_public_booking(text, text, text, text, date, time, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text, text, text, text, date, time, text, text, boolean, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_salon_date_availability(text, date, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_salon_date_availability(text, date, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) TO service_role;
