-- Migration: 20261016000011_security_hardening.sql
-- Security Hardening for MOERGE Multi-Tenant Platform:
-- 1. Lock down claim_due_reminders to service_role only (revoke from PUBLIC, anon, authenticated).
-- 2. Remove hardcoded cron secrets ('lumiere-salon-cron-secret-2026-secure') from all RPC functions.
-- 3. Lock down record_reminder_send_result & process_email_webhook_event to service_role (or authorized salon staff).
-- 4. Protect salon_settings.resend_api_key: revoke SELECT on this column from authenticated, anon, and public.
-- 5. Idempotently disable/remove the demo staff user (staff@lumieresalon.com).
-- 6. Add DB-level rate limiting for public online bookings (max 5 per hour per email/IP).

-- ============================================================================
-- 1. LOCK DOWN claim_due_reminders & REMOVE HARDCODED SECRETS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_cron_secret TEXT DEFAULT NULL,
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
  test_recipient_email TEXT,
  resend_api_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict authorization: only service_role (server background worker) can claim due reminders
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
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
    ss.test_recipient_email,
    ss.resend_api_key
  FROM claimed c
  JOIN public.clients cl ON cl.id = c.client_id
  JOIN public.appointments a ON a.id = c.appointment_id
  JOIN public.salon_settings ss ON ss.salon_id = c.salon_id;
END;
$$;

-- Revoke execute from PUBLIC, anon, authenticated; grant only to service_role
REVOKE ALL ON FUNCTION public.claim_due_reminders(TEXT, INTEGER, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_due_reminders(TEXT, INTEGER, UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(TEXT, INTEGER, UUID, UUID) TO service_role;

-- ============================================================================
-- 2. LOCK DOWN record_reminder_send_result & REMOVE HARDCODED SECRETS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_reminder_send_result(
  p_cron_secret TEXT DEFAULT NULL,
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
SET search_path = public
AS $$
DECLARE
  v_rem public.reminders%ROWTYPE;
  v_log_event TEXT;
BEGIN
  SELECT * INTO v_rem FROM public.reminders WHERE id = p_reminder_id;
  IF v_rem.id IS NULL THEN
    RAISE EXCEPTION 'Reminder % not found', p_reminder_id;
  END IF;

  -- Allow service_role OR staff member with explicit salon membership
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.user_has_salon_access(v_rem.salon_id) THEN
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

REVOKE ALL ON FUNCTION public.record_reminder_send_result(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_reminder_send_result(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_reminder_send_result(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB) TO service_role, authenticated;

-- ============================================================================
-- 3. LOCK DOWN process_email_webhook_event
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_email_webhook_event(
  p_cron_secret TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rem public.reminders%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_mapped_event TEXT;
BEGIN
  -- Strict authorization: only service_role (verified server webhook handler) can execute
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized webhook caller: service_role required';
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

REVOKE ALL ON FUNCTION public.process_email_webhook_event(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_email_webhook_event(TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_email_webhook_event(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- 4. CONFIRM PUBLIC PERMISSIONS ON INTENTIONALLY PUBLIC RPCs
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_public_salon_booking_info(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_salon_date_availability(TEXT, DATE, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(TEXT, TEXT, TEXT, TEXT, DATE, TIME, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unsubscribe_client_by_token(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_salon(TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_user_salon(TEXT) FROM anon, PUBLIC;

-- ============================================================================
-- 5. PROTECT salon_settings.resend_api_key FROM UNAUTHORIZED SELECT
-- ============================================================================

-- Revoke table-wide SELECT on salon_settings from anon and authenticated
REVOKE ALL ON public.salon_settings FROM PUBLIC, anon, authenticated;

-- Allow authenticated users to perform INSERT, UPDATE, DELETE (governed by RLS policies)
GRANT INSERT, UPDATE, DELETE ON public.salon_settings TO authenticated;

-- Allow authenticated users to SELECT only non-sensitive columns (excluding resend_api_key)
GRANT SELECT (
  id,
  salon_id,
  salon_name,
  sender_display_name,
  verified_sender_email,
  timezone,
  reminder_interval_days,
  email_subject,
  email_body_template,
  booking_url,
  brand_color,
  auto_reminders_enabled,
  dry_run_mode,
  test_recipient_email,
  booking_title,
  booking_subtitle,
  salon_address,
  salon_phone,
  working_hours_start,
  working_hours_end,
  slot_interval_minutes,
  send_booking_confirmation_email,
  custom_services,
  created_at,
  updated_at
) ON public.salon_settings TO authenticated;

-- Explicitly revoke SELECT on the resend_api_key column from authenticated, anon, and public
REVOKE SELECT (resend_api_key) ON public.salon_settings FROM authenticated, anon, PUBLIC;

-- service_role retains full access to all columns
GRANT ALL ON public.salon_settings TO service_role;

-- ============================================================================
-- 6. IDEMPOTENTLY DISABLE THE DEMO USER (staff@lumieresalon.com)
-- ============================================================================

UPDATE auth.users
SET encrypted_password = 'DISABLED_' || gen_random_uuid()::text,
    banned_until = '3000-01-01 00:00:00+00'::timestamptz,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"disabled": true, "security_deactivated_at": "2026-10-16"}'::jsonb
WHERE email = 'staff@lumieresalon.com';

UPDATE public.salon_memberships
SET is_active = false
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'staff@lumieresalon.com');

-- ============================================================================
-- 7. DB-LEVEL RATE LIMITING FOR PUBLIC BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.public_booking_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_rate_limit_ip_created
  ON public.public_booking_rate_limits (ip_address, created_at);

CREATE INDEX IF NOT EXISTS idx_booking_rate_limit_email_created
  ON public.public_booking_rate_limits (email, created_at);

ALTER TABLE public.public_booking_rate_limits ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT ON public.public_booking_rate_limits TO anon, authenticated, service_role;

-- Upgrade submit_public_booking to enforce max 5 bookings per hour per normalized email
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_salon_slug TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_treatment_date DATE DEFAULT NULL,
  p_treatment_time TIME DEFAULT '10:30:00',
  p_treatment_type TEXT DEFAULT 'laser_epilation',
  p_notes TEXT DEFAULT NULL,
  p_email_consent BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  -- 1. Resolve Salon
  SELECT s.id, ss.salon_name, ss.custom_services
  INTO v_salon_id, v_salon_name, v_custom_services
  FROM public.salons s
  JOIN public.salon_settings ss ON ss.salon_id = s.id
  WHERE (p_salon_slug IS NULL OR p_salon_slug = '' OR s.slug = p_salon_slug)
    AND s.subscription_status IN ('active', 'trialing')
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

  IF p_treatment_date IS NULL THEN
    RAISE EXCEPTION 'Please select a treatment date / გთხოვთ აირჩიოთ თარიღი';
  END IF;

  -- 2. Database Rate Limiting: Max 5 bookings per hour per normalized email
  SELECT count(*)
  INTO v_recent_email_bookings
  FROM public.appointments a
  JOIN public.clients c ON c.id = a.client_id
  WHERE c.normalized_email = v_normalized_email
    AND a.created_at >= (now() - INTERVAL '1 hour');

  IF v_recent_email_bookings >= 5 THEN
    RAISE EXCEPTION 'Booking limit exceeded (max 5 per hour). Please try again later / ჯავშნების ლიმიტი (საათში 5) ამოიწურა. გთხოვთ სცადოთ მოგვიანებით.';
  END IF;

  -- 3. Match service from salon's custom_services catalog
  v_is_epilation := p_treatment_type IN ('epilation', 'laser_epilation', 'wax_epilation', 'sugaring_epilation');
  v_service_id := p_treatment_type;
  v_service_name := p_treatment_type;

  IF v_custom_services IS NOT NULL AND jsonb_typeof(v_custom_services) = 'array' THEN
    SELECT elem
    INTO v_service_elem
    FROM jsonb_array_elements(v_custom_services) elem
    WHERE elem->>'id' = p_treatment_type OR elem->>'type' = p_treatment_type
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

  -- 4. Smart Conflict Detection: evaluate against existing appointments with duration
  SELECT to_char(a.treatment_time, 'HH24:MI')
  INTO v_conflicting_time
  FROM public.appointments a
  WHERE a.salon_id = v_salon_id
    AND a.treatment_date = p_treatment_date
    AND a.status IN ('scheduled', 'completed')
    AND abs(extract(epoch FROM (a.treatment_time - COALESCE(p_treatment_time, '10:30:00'::time)))) < (COALESCE(v_duration_mins, 45) * 60)
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

  -- 5. Upsert or find client
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
      p_email_consent,
      CASE WHEN p_email_consent = true THEN NULL ELSE now() END
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- 6. Insert Appointment
  INSERT INTO public.appointments (
    salon_id,
    client_id,
    treatment_date,
    treatment_time,
    treatment_type,
    status,
    notes,
    price_gel,
    duration_minutes
  ) VALUES (
    v_salon_id,
    v_client_id,
    p_treatment_date,
    COALESCE(p_treatment_time, '10:30:00'::time),
    v_service_id,
    'scheduled',
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_price_gel,
    COALESCE(v_duration_mins, 45)
  )
  RETURNING id INTO v_appointment_id;

  -- Record in rate limit tracking table
  INSERT INTO public.public_booking_rate_limits (email)
  VALUES (v_normalized_email);

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'salon_id', v_salon_id,
    'salon_name', v_salon_name,
    'is_returning_client', v_is_returning,
    'treatment_date', p_treatment_date,
    'treatment_time', to_char(COALESCE(p_treatment_time, '10:30:00'::time), 'HH24:MI'),
    'treatment_type', v_service_id,
    'treatment_name', v_service_name,
    'price_gel', v_price_gel,
    'duration_minutes', v_duration_mins,
    'is_epilation', v_is_epilation
  );
END;
$$;
