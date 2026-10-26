-- Clean baseline consolidated from the original migration sequence.
-- Fresh local databases only; existing installations should mark this baseline applied.

-- Begin consolidated source: 20261016000001_salon_reminder_schema.sql
-- ==============================================================================
-- Migration: 20261016000001_salon_reminder_schema.sql
-- Project: Salon Appointment Reminder System (Multi-Tenant SaaS Ready)
-- Description: Core tables, constraints, indexes, Row Level Security (RLS),
--              and idempotent reminder scheduling/claiming RPCs.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Trigger Function for updated_at
CREATE OR REPLACE FUNCTION public.salon_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Table: salons
CREATE TABLE IF NOT EXISTS public.salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (char_length(trim(slug)) > 0),
  subscription_tier TEXT NOT NULL DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_salons_updated_at
  BEFORE UPDATE ON public.salons
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 3. Table: user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Salon Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 4. Table: salon_memberships
CREATE TABLE IF NOT EXISTS public.salon_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (salon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_salon_memberships_user_id ON public.salon_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_memberships_salon_id ON public.salon_memberships(salon_id);

CREATE TRIGGER trg_salon_memberships_updated_at
  BEFORE UPDATE ON public.salon_memberships
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 5. Table: salon_settings
CREATE TABLE IF NOT EXISTS public.salon_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
  salon_name TEXT NOT NULL CHECK (char_length(trim(salon_name)) > 0),
  sender_display_name TEXT NOT NULL CHECK (char_length(trim(sender_display_name)) > 0),
  verified_sender_email TEXT NOT NULL CHECK (
    verified_sender_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  timezone TEXT NOT NULL DEFAULT 'UTC' CHECK (char_length(trim(timezone)) > 0),
  reminder_interval_days INTEGER NOT NULL DEFAULT 21 CHECK (reminder_interval_days >= 1 AND reminder_interval_days <= 365),
  email_subject TEXT NOT NULL DEFAULT 'It''s time to book your next epilation appointment!' CHECK (char_length(trim(email_subject)) > 0),
  email_body_template TEXT NOT NULL DEFAULT E'Hi {{client_name}},\n\nIt''s been 21 days since your last epilation appointment, and we''d love to welcome you back!\n\nIt''s a great time to plan your next visit.\n\nReady to book your next appointment?\n\n{{booking_link}}\n\nThank you for choosing {{salon_name}}. We look forward to seeing you again!\n\nBest regards,\n{{salon_name}} Team',
  booking_url TEXT NOT NULL DEFAULT 'https://example.com/book' CHECK (booking_url ~* '^https?://'),
  brand_color TEXT NOT NULL DEFAULT '#e11d48',
  auto_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  dry_run_mode BOOLEAN NOT NULL DEFAULT true,
  test_recipient_email TEXT CHECK (
    test_recipient_email IS NULL OR test_recipient_email = '' OR
    test_recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_salon_settings_updated_at
  BEFORE UPDATE ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 6. Table: clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email TEXT NOT NULL CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  normalized_email TEXT GENERATED ALWAYS AS (lower(trim(email))) STORED,
  phone TEXT,
  notes TEXT,
  email_consent BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  last_completed_epilation_date DATE,
  next_expected_appointment_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_clients_salon_email UNIQUE (salon_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_clients_salon_id ON public.clients(salon_id);
CREATE INDEX IF NOT EXISTS idx_clients_salon_archived ON public.clients(salon_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_clients_next_expected ON public.clients(salon_id, next_expected_appointment_date);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 7. Table: appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  treatment_date DATE NOT NULL,
  treatment_time TIME NOT NULL DEFAULT '10:00:00',
  treatment_type TEXT NOT NULL DEFAULT 'epilation' CHECK (
    treatment_type IN (
      'epilation',
      'laser_epilation',
      'wax_epilation',
      'sugaring_epilation',
      'facial',
      'massage',
      'manicure',
      'consultation'
    )
  ),
  is_epilation BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'completed', 'missed', 'canceled')
  ),
  completed_at TIMESTAMPTZ,
  next_expected_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_salon_date ON public.appointments(salon_id, treatment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id, treatment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_salon_status ON public.appointments(salon_id, status);

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 8. Table: reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  scheduled_for_date DATE NOT NULL,
  scheduled_send_at TIMESTAMPTZ NOT NULL,
  actual_sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'processing', 'sent', 'delivered', 'bounced', 'failed', 'canceled')
  ),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 10),
  next_retry_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  failure_reason TEXT,
  is_permanent_failure BOOLEAN NOT NULL DEFAULT false,
  processing_locked_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_reminder_per_appointment
  ON public.reminders(appointment_id)
  WHERE status IN ('scheduled', 'processing', 'sent', 'delivered');

CREATE INDEX IF NOT EXISTS idx_reminders_salon_status_due
  ON public.reminders(salon_id, status, scheduled_send_at);

CREATE INDEX IF NOT EXISTS idx_reminders_due_worker
  ON public.reminders(status, scheduled_send_at, next_retry_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_reminders_provider_msg_id
  ON public.reminders(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.salon_set_updated_at();

-- 9. Table: email_logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'scheduled',
      'processing',
      'api_accepted',
      'delivered',
      'bounced',
      'complained',
      'failed',
      'retry_scheduled',
      'canceled',
      'dry_run_simulated'
    )
  ),
  provider_message_id TEXT,
  idempotency_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status_code INTEGER,
  error_message TEXT,
  is_dry_run BOOLEAN NOT NULL DEFAULT false,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_salon_created
  ON public.email_logs(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_reminder_id
  ON public.email_logs(reminder_id, created_at DESC);

-- ==============================================================================
-- Row Level Security (RLS) Setup & Authorization Functions
-- ==============================================================================

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_salon_access(target_salon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.salon_memberships sm
    WHERE sm.salon_id = target_salon_id
      AND sm.user_id = auth.uid()
      AND sm.is_active = true
  );
$$;

CREATE POLICY "Salon members can view their salons"
  ON public.salons FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(id));

CREATE POLICY "Salon members can update their salons"
  ON public.salons FOR UPDATE
  TO authenticated
  USING (public.user_has_salon_access(id))
  WITH CHECK (public.user_has_salon_access(id));

CREATE POLICY "Users can view own profile or profiles in same salon"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.salon_memberships sm1
      JOIN public.salon_memberships sm2 ON sm1.salon_id = sm2.salon_id
      WHERE sm1.user_id = auth.uid() AND sm2.user_id = public.user_profiles.id
        AND sm1.is_active = true AND sm2.is_active = true
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can view memberships of their salons"
  ON public.salon_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can select salon_settings"
  ON public.salon_settings FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can update salon_settings"
  ON public.salon_settings FOR UPDATE
  TO authenticated
  USING (public.user_has_salon_access(salon_id))
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can insert salon_settings"
  ON public.salon_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can select clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.user_has_salon_access(salon_id))
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can select appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can insert appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can update appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (public.user_has_salon_access(salon_id))
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can select reminders"
  ON public.reminders FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can insert reminders"
  ON public.reminders FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can update reminders"
  ON public.reminders FOR UPDATE
  TO authenticated
  USING (public.user_has_salon_access(salon_id))
  WITH CHECK (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can select email_logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (public.user_has_salon_access(salon_id));

CREATE POLICY "Salon members can insert email_logs"
  ON public.email_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id));

-- ==============================================================================
-- RPC Functions for Onboarding, Unsubscribe, Cron Claiming & Webhook Processing
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name TEXT DEFAULT 'My Salon'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_full_name TEXT;
  v_salon_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO v_user_email, v_full_name
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (v_user_id, COALESCE(v_user_email, ''), COALESCE(v_full_name, 'Salon Staff'))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

  SELECT salon_id INTO v_salon_id
  FROM public.salon_memberships
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_salon_id IS NOT NULL THEN
    RETURN v_salon_id;
  END IF;

  SELECT id INTO v_salon_id
  FROM public.salons
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_salon_id IS NULL THEN
    INSERT INTO public.salons (name, slug, subscription_tier, subscription_status)
    VALUES (
      p_default_salon_name,
      'moarge-demo-' || substr(md5(random()::text), 1, 6),
      'professional',
      'active'
    )
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
      dry_run_mode
    ) VALUES (
      v_salon_id,
      p_default_salon_name,
      p_default_salon_name,
      'reminders@example.com',
      'America/New_York',
      21,
      'https://example.com/book',
      true,
      true
    );
  END IF;

  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_user_id, 'owner', true)
  ON CONFLICT (salon_id, user_id) DO UPDATE SET is_active = true;

  RETURN v_salon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unsubscribe_client_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_cron_secret TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_salon_id UUID DEFAULT NULL,
  p_specific_reminder_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN := false;
  v_results JSONB := '[]'::jsonb;
BEGIN
  IF p_cron_secret IS NOT NULL AND p_cron_secret = current_setting('app.cron_secret', true) THEN
    v_is_authorized := true;
  ELSIF auth.uid() IS NOT NULL THEN
    IF p_salon_id IS NOT NULL AND public.user_has_salon_access(p_salon_id) THEN
      v_is_authorized := true;
    ELSIF p_salon_id IS NULL THEN
      v_is_authorized := EXISTS (
        SELECT 1 FROM public.salon_memberships WHERE user_id = auth.uid() AND is_active = true
      );
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized to claim due reminders';
  END IF;

  UPDATE public.reminders
  SET status = 'scheduled',
      processing_locked_at = NULL
  WHERE status = 'processing'
    AND processing_locked_at < (now() - interval '10 minutes');

  WITH candidate_reminders AS (
    SELECT r.id
    FROM public.reminders r
    JOIN public.salon_settings ss ON ss.salon_id = r.salon_id
    JOIN public.clients c ON c.id = r.client_id
    WHERE (
      (
        p_specific_reminder_id IS NULL
        AND r.status = 'scheduled'
        AND ss.auto_reminders_enabled = true
        AND r.scheduled_send_at <= now()
        AND (r.next_retry_at IS NULL OR r.next_retry_at <= now())
        AND r.attempt_count < r.max_attempts
      )
      OR (
        p_specific_reminder_id IS NOT NULL
        AND r.id = p_specific_reminder_id
        AND r.status IN ('scheduled', 'failed')
        AND r.is_permanent_failure = false
      )
    )
    AND (p_salon_id IS NULL OR r.salon_id = p_salon_id)
    AND (
      auth.uid() IS NULL
      OR public.user_has_salon_access(r.salon_id)
    )
    ORDER BY r.scheduled_send_at ASC
    LIMIT p_limit
    FOR UPDATE OF r SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.reminders r
    SET status = 'processing',
        processing_locked_at = now(),
        last_attempt_at = now(),
        attempt_count = r.attempt_count + 1
    FROM candidate_reminders cr
    WHERE r.id = cr.id
    RETURNING r.*
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'reminder_id', cl.id,
        'salon_id', cl.salon_id,
        'client_id', cl.client_id,
        'appointment_id', cl.appointment_id,
        'scheduled_for_date', cl.scheduled_for_date,
        'scheduled_send_at', cl.scheduled_send_at,
        'idempotency_key', cl.idempotency_key,
        'attempt_count', cl.attempt_count,
        'max_attempts', cl.max_attempts,
        'client_name', c.full_name,
        'client_email', c.email,
        'client_archived', c.is_archived,
        'client_consent', c.email_consent,
        'client_unsubscribed_at', c.unsubscribed_at,
        'unsubscribe_token', c.unsubscribe_token,
        'treatment_date', a.treatment_date,
        'treatment_type', a.treatment_type,
        'appointment_status', a.status,
        'salon_name', ss.salon_name,
        'sender_display_name', ss.sender_display_name,
        'verified_sender_email', ss.verified_sender_email,
        'timezone', ss.timezone,
        'email_subject', ss.email_subject,
        'email_body_template', ss.email_body_template,
        'booking_url', ss.booking_url,
        'brand_color', ss.brand_color,
        'dry_run_mode', ss.dry_run_mode,
        'test_recipient_email', ss.test_recipient_email
      )
    ),
    '[]'::jsonb
  )
  INTO v_results
  FROM claimed cl
  JOIN public.clients c ON c.id = cl.client_id
  JOIN public.appointments a ON a.id = cl.appointment_id
  JOIN public.salon_settings ss ON ss.salon_id = cl.salon_id;

  RETURN v_results;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_reminder_send_result(
  p_cron_secret TEXT,
  p_reminder_id UUID,
  p_outcome TEXT,
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

  IF p_cron_secret IS DISTINCT FROM current_setting('app.cron_secret', true)
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

CREATE OR REPLACE FUNCTION public.process_email_webhook_event(
  p_cron_secret TEXT,
  p_provider_message_id TEXT,
  p_event_type TEXT,
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
  IF p_cron_secret IS DISTINCT FROM current_setting('app.cron_secret', true) THEN
    RAISE EXCEPTION 'Unauthorized webhook processor call';
  END IF;

  SELECT * INTO v_rem
  FROM public.reminders
  WHERE provider_message_id = p_provider_message_id
  LIMIT 1;

  IF v_rem.id IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'provider_message_id', p_provider_message_id);
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_rem.client_id;

  IF p_event_type = 'email.delivered' THEN
    v_mapped_event := 'delivered';
    UPDATE public.reminders
    SET status = 'delivered',
        delivered_at = COALESCE(delivered_at, now()),
        failure_reason = NULL
    WHERE id = v_rem.id;

  ELSIF p_event_type = 'email.bounced' THEN
    v_mapped_event := 'bounced';
    UPDATE public.reminders
    SET status = 'bounced',
        bounced_at = COALESCE(bounced_at, now()),
        failure_reason = COALESCE(p_error_message, 'Recipient email address bounced'),
        is_permanent_failure = true
    WHERE id = v_rem.id;

    UPDATE public.clients
    SET email_consent = false,
        notes = COALESCE(notes || E'\n', '') || '[System] Email hard-bounced on ' || now()::date::text
    WHERE id = v_rem.client_id;

  ELSIF p_event_type = 'email.complained' THEN
    v_mapped_event := 'complained';
    UPDATE public.reminders
    SET status = 'bounced',
        bounced_at = COALESCE(bounced_at, now()),
        failure_reason = COALESCE(p_error_message, 'Recipient marked email as spam/complaint'),
        is_permanent_failure = true
    WHERE id = v_rem.id;

    UPDATE public.clients
    SET email_consent = false,
        unsubscribed_at = COALESCE(unsubscribed_at, now())
    WHERE id = v_rem.client_id;

  ELSE
    v_mapped_event := 'processing';
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
    COALESCE(v_client.email, 'client@example.com'),
    'Webhook: ' || p_event_type,
    v_mapped_event,
    p_provider_message_id,
    v_rem.idempotency_key || ':' || v_mapped_event,
    GREATEST(v_rem.attempt_count, 1),
    200,
    p_error_message,
    false,
    p_raw_payload
  );

  RETURN jsonb_build_object(
    'matched', true,
    'reminder_id', v_rem.id,
    'new_status', v_mapped_event
  );
END;
$$;

-- End consolidated source: 20261016000001_salon_reminder_schema.sql

-- Begin consolidated source: 20261016000002_seed_initial_salon_and_staff.sql
-- Legacy demo seed removed. Local demonstration data lives in supabase/seed.sql.
-- This migration intentionally creates no users, credentials, or production demo records.

-- End consolidated source: 20261016000002_seed_initial_salon_and_staff.sql

-- Begin consolidated source: 20261016000003_cron_schedule_template.sql
-- ==============================================================================
-- Migration: 20261016000003_cron_schedule_template.sql
-- Description: Supabase Cron (pg_cron + pg_net) setup instructions and helper
--              to automatically invoke the reminder processing endpoint every
--              15 minutes without requiring any browser tab to be open.
-- ==============================================================================

-- Helper function to configure pg_cron + pg_net once the production URL is deployed:
CREATE OR REPLACE FUNCTION public.configure_reminder_cron_job(
  p_app_base_url TEXT,
  p_cron_secret TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Requires pg_cron and pg_net extensions enabled in Supabase Dashboard -> Database -> Extensions
  -- Example usage in Supabase SQL Editor after deploying to Vercel:
  -- SELECT public.configure_reminder_cron_job('https://your-salon-app.vercel.app', 'your-cron-secret');
  RETURN format(
    E'SELECT cron.schedule(\n' ||
    E'  ''salon-process-due-reminders'',\n' ||
    E'  ''*/15 * * * *'',\n' ||
    E'  $cron$\n' ||
    E'  SELECT net.http_post(\n' ||
    E'    url := %L,\n' ||
    E'    headers := jsonb_build_object(\n' ||
    E'      ''Content-Type'', ''application/json'',\n' ||
    E'      ''Authorization'', %L\n' ||
    E'    ),\n' ||
    E'    body := ''{"source":"supabase_pg_cron"}''::jsonb\n' ||
    E'  );\n' ||
    E'  $cron$\n' ||
    E');',
    rtrim(p_app_base_url, '/') || '/api/cron/process-reminders',
    'Bearer ' || p_cron_secret
  );
END;
$$;

-- End consolidated source: 20261016000003_cron_schedule_template.sql

-- Begin consolidated source: 20261016000004_public_booking_ecosystem.sql
-- ==============================================================================
-- Migration: 20261016000004_public_booking_ecosystem.sql
-- Description: Adds public online booking RPCs so clients clicking the 21-day
--              reminder email link (or visiting /book) can book their next
--              appointment directly into the salon's schedule without duplicate
--              client records.
-- ==============================================================================

-- 1. Public RPC to fetch safe salon branding for the /book page
CREATE OR REPLACE FUNCTION public.get_public_salon_booking_info(
  p_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_salon RECORD;
BEGIN
  SELECT
    s.id AS salon_id,
    s.slug,
    ss.salon_name,
    ss.timezone,
    ss.brand_color,
    ss.reminder_interval_days
  INTO v_salon
  FROM public.salons s
  JOIN public.salon_settings ss ON ss.salon_id = s.id
  WHERE (p_slug IS NULL OR p_slug = '' OR s.slug = p_slug)
    AND s.subscription_status IN ('active', 'trialing')
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_salon.salon_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'salon_id', v_salon.salon_id,
    'slug', v_salon.slug,
    'salon_name', v_salon.salon_name,
    'timezone', v_salon.timezone,
    'brand_color', v_salon.brand_color,
    'reminder_interval_days', v_salon.reminder_interval_days
  );
END;
$$;

-- 2. Public RPC to submit a client booking (matches existing client by email or creates new client)
CREATE OR REPLACE FUNCTION public.submit_public_booking(
  p_salon_slug TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_treatment_date DATE DEFAULT NULL,
  p_treatment_time TIME DEFAULT '10:00:00',
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
  v_normalized_email TEXT;
  v_client_id UUID;
  v_is_returning BOOLEAN := false;
  v_is_epilation BOOLEAN := true;
  v_appointment_id UUID;
BEGIN
  -- Resolve salon
  SELECT s.id, ss.salon_name
  INTO v_salon_id, v_salon_name
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
    RAISE EXCEPTION 'Please provide a valid email address';
  END IF;

  IF char_length(trim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Please provide your full name';
  END IF;

  IF p_treatment_date IS NULL THEN
    RAISE EXCEPTION 'Please select a treatment date';
  END IF;

  v_is_epilation := p_treatment_type IN (
    'epilation',
    'laser_epilation',
    'wax_epilation',
    'sugaring_epilation'
  );

  -- Match existing client in this salon by normalized_email or create a new client record
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

  -- Create the scheduled appointment
  INSERT INTO public.appointments (
    salon_id,
    client_id,
    treatment_date,
    treatment_time,
    treatment_type,
    is_epilation,
    status,
    notes
  ) VALUES (
    v_salon_id,
    v_client_id,
    p_treatment_date,
    COALESCE(p_treatment_time, '10:00:00'::time),
    p_treatment_type,
    v_is_epilation,
    'scheduled',
    CASE
      WHEN p_notes IS NOT NULL AND trim(p_notes) <> ''
        THEN '[Online Booking] ' || trim(p_notes)
      ELSE '[Online Booking] Booked via client booking form'
    END
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'salon_id', v_salon_id,
    'salon_name', v_salon_name,
    'is_returning_client', v_is_returning,
    'treatment_date', p_treatment_date,
    'treatment_time', COALESCE(p_treatment_time, '10:00:00'::time),
    'treatment_type', p_treatment_type
  );
END;
$$;

-- Update default booking_url in seeded salon_settings to point to the integrated /book page
UPDATE public.salon_settings
SET booking_url = 'http://localhost:3000/book'
WHERE booking_url = 'https://example.com/book'
   OR booking_url = 'https://example.com/book';

-- End consolidated source: 20261016000004_public_booking_ecosystem.sql

-- Begin consolidated source: 20261016000005_smart_availability_and_conflict_check.sql
-- ==============================================================================
-- Migration: 20261016000005_smart_availability_and_conflict_check.sql
-- Description: Smart time-slot availability inspection, overlap detection,
--              and automatic alternative slot suggestions for public & staff bookings.
-- ==============================================================================

-- 1. Check date availability & booked time slots for a salon on a given date
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
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
  v_booked_times TEXT[];
  v_standard_slots TEXT[] := ARRAY['09:30', '10:30', '11:30', '13:00', '14:30', '16:00', '17:30', '18:30'];
  v_slot TEXT;
  v_slot_time TIME;
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
      AND s.subscription_status IN ('active', 'trialing')
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

  -- Fetch all active appointment times on p_date
  SELECT COALESCE(array_agg(to_char(a.treatment_time, 'HH24:MI') ORDER BY a.treatment_time), ARRAY[]::TEXT[])
  INTO v_booked_times
  FROM public.appointments a
  WHERE a.salon_id = v_salon_id
    AND a.treatment_date = p_date
    AND a.status IN ('scheduled', 'completed')
    AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id);

  -- Evaluate each standard slot against a 45-minute buffer window
  FOREACH v_slot IN ARRAY v_standard_slots LOOP
    v_slot_time := (v_slot || ':00')::time;
    SELECT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.salon_id = v_salon_id
        AND a.treatment_date = p_date
        AND a.status IN ('scheduled', 'completed')
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND abs(extract(epoch FROM (a.treatment_time - v_slot_time))) < 2700
    ) INTO v_has_conflict;

    v_slots_result := v_slots_result || jsonb_build_object(
      'time', v_slot,
      'available', NOT v_has_conflict
    );

    IF NOT v_has_conflict THEN
      v_available_slots := array_append(v_available_slots, v_slot);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'found', true,
    'salon_id', v_salon_id,
    'date', p_date,
    'booked_times', to_jsonb(v_booked_times),
    'slots', v_slots_result,
    'available_slots', to_jsonb(v_available_slots)
  );
END;
$$;

-- 2. Upgrade submit_public_booking with smart conflict detection & suggested alternatives
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
  v_normalized_email TEXT;
  v_client_id UUID;
  v_is_returning BOOLEAN := false;
  v_is_epilation BOOLEAN := true;
  v_appointment_id UUID;
  v_conflicting_time TEXT;
  v_availability JSONB;
BEGIN
  SELECT s.id, ss.salon_name
  INTO v_salon_id, v_salon_name
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

  -- Smart Conflict Detection: check if another active appointment is within 45 minutes on the same date
  SELECT to_char(a.treatment_time, 'HH24:MI')
  INTO v_conflicting_time
  FROM public.appointments a
  WHERE a.salon_id = v_salon_id
    AND a.treatment_date = p_treatment_date
    AND a.status IN ('scheduled', 'completed')
    AND abs(extract(epoch FROM (a.treatment_time - COALESCE(p_treatment_time, '10:30:00'::time)))) < 2700
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

  v_is_epilation := p_treatment_type IN (
    'epilation',
    'laser_epilation',
    'wax_epilation',
    'sugaring_epilation'
  );

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

  INSERT INTO public.appointments (
    salon_id,
    client_id,
    treatment_date,
    treatment_time,
    treatment_type,
    is_epilation,
    status,
    notes
  ) VALUES (
    v_salon_id,
    v_client_id,
    p_treatment_date,
    COALESCE(p_treatment_time, '10:30:00'::time),
    p_treatment_type,
    v_is_epilation,
    'scheduled',
    CASE
      WHEN p_notes IS NOT NULL AND trim(p_notes) <> ''
        THEN '[Online Booking] ' || trim(p_notes)
      ELSE '[Online Booking] Booked via client booking form'
    END
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
    'treatment_type', p_treatment_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_salon_date_availability(text, date, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text, text, text, text, date, time, text, text, boolean) TO anon, authenticated, service_role;

-- End consolidated source: 20261016000005_smart_availability_and_conflict_check.sql

-- Begin consolidated source: 20261016000006_moarge_production_booking_and_tbilisi_tz.sql
-- ==============================================================================
-- Migration: 20261016000006_moarge_production_booking_and_tbilisi_tz.sql
-- Description: Upgrades project to moarge production state:
--              1. Sets default timezone to Asia/Tbilisi (Georgia Time, GMT+4)
--              2. Adds full Online Booking Page customization columns & custom_services JSONB
--              3. Adds per-salon Resend API Key & instant booking confirmation support
--              4. Upgrades get_public_salon_booking_info & get_salon_date_availability
--                 to generate dynamic time slots from working_hours_start..working_hours_end
-- ==============================================================================

ALTER TABLE public.salon_settings
  ALTER COLUMN timezone SET DEFAULT 'Asia/Tbilisi';

ALTER TABLE public.salon_settings
  ADD COLUMN IF NOT EXISTS booking_title TEXT NOT NULL DEFAULT 'ონლაინ ჩაწერა სალონში',
  ADD COLUMN IF NOT EXISTS booking_subtitle TEXT NOT NULL DEFAULT 'აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში.',
  ADD COLUMN IF NOT EXISTS salon_address TEXT NOT NULL DEFAULT 'თბილისი, ი. ჭავჭავაძის გამზ. 34',
  ADD COLUMN IF NOT EXISTS salon_phone TEXT NOT NULL DEFAULT '+995 555 00 21 21',
  ADD COLUMN IF NOT EXISTS working_hours_start TEXT NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS working_hours_end TEXT NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS send_booking_confirmation_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_services JSONB NOT NULL DEFAULT '[
    {
      "id": "svc_laser_full",
      "type": "laser_epilation",
      "name_ka": "დიოდური ლაზერული ეპილაცია (მთლიანი სხეული)",
      "name_en": "Diode Laser Epilation (Full Body)",
      "desc_ka": "უახლესი თაობის მოყინვის მეთოდით, უმტკივნეულო პროცედურა. მოქმედებს 21-დღიანი შეხსენება.",
      "desc_en": "Medical-grade cooling diode laser hair removal. Includes 21-day care cycle reminder.",
      "price_gel": 95,
      "duration_minutes": 45,
      "is_epilation": true,
      "enabled": true
    },
    {
      "id": "svc_laser_zones",
      "type": "epilation",
      "name_ka": "ლაზერული ეპილაცია (ცალკეული ზონები)",
      "name_en": "Laser Epilation (Selected Zones)",
      "desc_ka": "სახე, იღლია, ბიკინი ან ფეხები — სწრაფი და ეფექტური სეანსი. 21-დღიანი ციკლი.",
      "desc_en": "Targeted zone epilation session with soothing post-care balm. 21-day cycle.",
      "price_gel": 45,
      "duration_minutes": 30,
      "is_epilation": true,
      "enabled": true
    },
    {
      "id": "svc_sugaring",
      "type": "sugaring_epilation",
      "name_ka": "შუგარინგი (ბიო-ეპილაცია)",
      "name_en": "Organic Sugaring Epilation",
      "desc_ka": "ნაზი ორგანული შაქრის პასტით ეპილაცია მგრძნობიარე კანისთვის. 21-დღიანი ციკლი.",
      "desc_en": "Gentle organic sugar paste epilation for sensitive skin. 21-day cycle.",
      "price_gel": 50,
      "duration_minutes": 40,
      "is_epilation": true,
      "enabled": true
    },
    {
      "id": "svc_wax",
      "type": "wax_epilation",
      "name_ka": "ცვილით ეპილაცია (პრემიუმ ცვილი)",
      "name_en": "Luxury Warm Wax Epilation",
      "desc_ka": "დაბალტემპერატურული ვარდის ცვილით სწრაფი ეპილაცია. 21-დღიანი ციკლი.",
      "desc_en": "Low-temperature rose-resin wax epilation. 21-day cycle.",
      "price_gel": 40,
      "duration_minutes": 35,
      "is_epilation": true,
      "enabled": true
    },
    {
      "id": "svc_facial",
      "type": "facial",
      "name_ka": "სახის კანის ღრმა წმენდა და დატენიანება",
      "name_en": "Hydrating Facial & Skin Renewal",
      "desc_ka": "ულტრაბგერითი წმენდა და ბარიერის აღმდგენი ნიღაბი.",
      "desc_en": "Deep ultrasonic cleansing & skin barrier renewal.",
      "price_gel": 110,
      "duration_minutes": 60,
      "is_epilation": false,
      "enabled": true
    },
    {
      "id": "svc_consultation",
      "type": "consultation",
      "name_ka": "უფასო კონსულტაცია და სატესტო იმპულსი",
      "name_en": "Free Skin Consultation & Patch Test",
      "desc_ka": "კანის ტიპის შეფასება და ლაზერის სატესტო სინჯი.",
      "desc_en": "Complimentary skin assessment & laser patch test.",
      "price_gel": 0,
      "duration_minutes": 20,
      "is_epilation": false,
      "enabled": true
    }
  ]'::jsonb;

ALTER TABLE public.salon_settings
  ALTER COLUMN booking_title SET DEFAULT 'ონლაინ ჩაწერა სალონში',
  ALTER COLUMN booking_subtitle SET DEFAULT 'აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში.',
  ALTER COLUMN salon_address SET DEFAULT 'თბილისი, ი. ჭავჭავაძის გამზ. 34',
  ALTER COLUMN salon_phone SET DEFAULT '+995 555 00 21 21';

-- Update existing salon to moarge Georgia defaults (Asia/Tbilisi)
UPDATE public.salons
SET name = 'moarge Demo Salon'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.salon_settings
SET timezone = 'Asia/Tbilisi',
    salon_name = 'moarge Demo Salon',
    sender_display_name = 'moarge Demo Salon',
    booking_title = 'ონლაინ ჩაწერა სალონში',
    booking_subtitle = 'აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში.',
    salon_address = 'თბილისი, ი. ჭავჭავაძის გამზ. 34',
    salon_phone = '+995 555 00 21 21',
    working_hours_start = '10:00',
    working_hours_end = '20:00',
    slot_interval_minutes = 60,
    custom_services = '[
      {
        "id": "svc_laser_full",
        "type": "laser_epilation",
        "name_ka": "დიოდური ლაზერული ეპილაცია (მთლიანი სხეული)",
        "name_en": "Diode Laser Epilation (Full Body)",
        "desc_ka": "უახლესი თაობის მოყინვის მეთოდით, უმტკივნეულო პროცედურა. მოქმედებს 21-დღიანი შეხსენება.",
        "desc_en": "Medical-grade cooling diode laser hair removal. Includes 21-day care cycle reminder.",
        "price_gel": 95,
        "duration_minutes": 45,
        "is_epilation": true,
        "enabled": true
      },
      {
        "id": "svc_laser_zones",
        "type": "epilation",
        "name_ka": "ლაზერული ეპილაცია (ცალკეული ზონები)",
        "name_en": "Laser Epilation (Selected Zones)",
        "desc_ka": "სახე, იღლია, ბიკინი ან ფეხები — სწრაფი და ეფექტური სეანსი. 21-დღიანი ციკლი.",
        "desc_en": "Targeted zone epilation session with soothing post-care balm. 21-day cycle.",
        "price_gel": 45,
        "duration_minutes": 30,
        "is_epilation": true,
        "enabled": true
      },
      {
        "id": "svc_sugaring",
        "type": "sugaring_epilation",
        "name_ka": "შუგარინგი (ბიო-ეპილაცია)",
        "name_en": "Organic Sugaring Epilation",
        "desc_ka": "ნაზი ორგანული შაქრის პასტით ეპილაცია მგრძნობიარე კანისთვის. 21-დღიანი ციკლი.",
        "desc_en": "Gentle organic sugar paste epilation for sensitive skin. 21-day cycle.",
        "price_gel": 50,
        "duration_minutes": 40,
        "is_epilation": true,
        "enabled": true
      },
      {
        "id": "svc_wax",
        "type": "wax_epilation",
        "name_ka": "ცვილით ეპილაცია (პრემიუმ ცვილი)",
        "name_en": "Luxury Warm Wax Epilation",
        "desc_ka": "დაბალტემპერატურული ვარდის ცვილით სწრაფი ეპილაცია. 21-დღიანი ციკლი.",
        "desc_en": "Low-temperature rose-resin wax epilation. 21-day cycle.",
        "price_gel": 40,
        "duration_minutes": 35,
        "is_epilation": true,
        "enabled": true
      },
      {
        "id": "svc_facial",
        "type": "facial",
        "name_ka": "სახის კანის ღრმა წმენდა და დატენიანება",
        "name_en": "Hydrating Facial & Skin Renewal",
        "desc_ka": "ულტრაბგერითი წმენდა და ბარიერის აღმდგენი ნიღაბი.",
        "desc_en": "Deep ultrasonic cleansing & skin barrier renewal.",
        "price_gel": 110,
        "duration_minutes": 60,
        "is_epilation": false,
        "enabled": true
      },
      {
        "id": "svc_consultation",
        "type": "consultation",
        "name_ka": "უფასო კონსულტაცია და სატესტო იმპულსი",
        "name_en": "Free Skin Consultation & Patch Test",
        "desc_ka": "კანის ტიპის შეფასება და ლაზერის სატესტო სინჯი.",
        "desc_en": "Complimentary skin assessment & laser patch test.",
        "price_gel": 0,
        "duration_minutes": 20,
        "is_epilation": false,
        "enabled": true
      }
    ]'::jsonb,
    verified_sender_email = CASE
      WHEN verified_sender_email = 'reminders@example.com' THEN 'onboarding@resend.dev'
      ELSE verified_sender_email
    END
WHERE salon_id = '11111111-1111-4111-8111-111111111111';

-- 1. Upgrade get_public_salon_booking_info to return all custom booking config
CREATE OR REPLACE FUNCTION public.get_public_salon_booking_info(p_slug TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
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
    AND s.subscription_status IN ('active', 'trialing')
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$;

-- 2. Upgrade get_salon_date_availability to generate slots dynamically from working_hours_start..working_hours_end
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
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
  v_work_start TIME := '10:00:00'::time;
  v_work_end TIME := '20:00:00'::time;
  v_interval_mins INTEGER := 60;
  v_buffer_secs INTEGER := 2700; -- 45 min default conflict buffer
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
      AND s.subscription_status IN ('active', 'trialing')
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
    GREATEST(15, LEAST(180, COALESCE(ss.slot_interval_minutes, 60)))
  INTO v_work_start, v_work_end, v_interval_mins
  FROM public.salon_settings ss
  WHERE ss.salon_id = v_salon_id;

  v_buffer_secs := LEAST(2700, v_interval_mins * 60);

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
  WHILE v_curr_time <= v_work_end LOOP
    v_slot_str := to_char(v_curr_time, 'HH24:MI');

    SELECT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.salon_id = v_salon_id
        AND a.treatment_date = p_date
        AND a.status IN ('scheduled', 'completed')
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND abs(extract(epoch FROM (a.treatment_time - v_curr_time))) < v_buffer_secs
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

-- 3. Upgrade claim_due_reminders to also return ss.resend_api_key so per-salon Resend keys work automatically
DROP FUNCTION IF EXISTS public.claim_due_reminders(integer);
DROP FUNCTION IF EXISTS public.claim_due_reminders(text, integer, uuid, uuid);

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

GRANT EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_salon_date_availability(text, date, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(text, integer, uuid, uuid) TO anon, authenticated, service_role;


-- End consolidated source: 20261016000006_moarge_production_booking_and_tbilisi_tz.sql

-- Begin consolidated source: 20261016000007_moarge_multi_tenant_salon_registration.sql
-- ==============================================================================
-- moarge Migration 7: Multi-Tenant Salon Registration & Salon Name Separation
-- Ensures each salon displays its own business name, while moarge is the platform.
-- ==============================================================================

-- 1. Rename default seed salon from moarge to a salon name (My Salon)
UPDATE public.salons
SET name = 'My Salon',
    slug = 'moarge-demo'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.salon_settings
SET salon_name = 'My Salon',
    sender_display_name = 'My Salon'
WHERE salon_id = '11111111-1111-4111-8111-111111111111';

-- 2. Upgrade ensure_user_salon to respect the salon_name entered during registration
CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name TEXT DEFAULT 'My Salon'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_full_name TEXT;
  v_meta_salon_name TEXT;
  v_salon_id UUID;
  v_salon_name TEXT;
  v_slug TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email,
         COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
         NULLIF(trim(raw_user_meta_data->>'salon_name'), '')
  INTO v_user_email, v_full_name, v_meta_salon_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Upsert user profile
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (v_user_id, COALESCE(v_user_email, ''), COALESCE(v_full_name, 'Salon Staff'))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name);

  -- 1. If user already has an active salon membership, return that salon_id
  SELECT salon_id INTO v_salon_id
  FROM public.salon_memberships
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_salon_id IS NOT NULL THEN
    -- If user provided a specific salon name in metadata and the salon is still default
    IF v_meta_salon_name IS NOT NULL THEN
      UPDATE public.salons
      SET name = v_meta_salon_name
      WHERE id = v_salon_id AND (name = 'moarge Demo Salon' OR name = 'moarge Demo Salon');

      UPDATE public.salon_settings
      SET salon_name = v_meta_salon_name,
          sender_display_name = v_meta_salon_name
      WHERE salon_id = v_salon_id AND (salon_name = 'moarge Demo Salon' OR salon_name = 'moarge Demo Salon');
    END IF;
    RETURN v_salon_id;
  END IF;

  -- 2. Determine salon name for new registration
  v_salon_name := COALESCE(v_meta_salon_name, NULLIF(trim(p_default_salon_name), ''), 'My Salon');

  -- 3. Create a brand new dedicated salon for the registering salon owner
  v_slug := lower(regexp_replace(v_salon_name, '[^a-zA-Z0-9]+', '-', 'g'));
  IF v_slug = '' OR v_slug = '-' THEN
    v_slug := 'salon';
  END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.salons (name, slug, subscription_tier, subscription_status)
  VALUES (v_salon_name, v_slug, 'professional', 'active')
  RETURNING id INTO v_salon_id;

  -- Create salon settings with Georgia timezone and customizable booking defaults
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
    true,
    'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online',
    'აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური 21-დღიანი შეხსენება.',
    'თბილისი, ჭავჭავაძის გამზ. 34',
    '+995 555 00 11 22',
    '10:00',
    '20:00',
    60,
    true,
    '[
      {"id":"srv_1","type":"laser_epilation","name_ka":"დიოდური ეპილაცია — მთლიანი სხეული","name_en":"Full Body Diode Laser Epilation","desc_ka":"სრული სხეულის უმტკივნეულო დიოდური ეპილაცია","desc_en":"Painless full body diode laser session","price_gel":120,"duration_minutes":60,"is_epilation":true,"enabled":true},
      {"id":"srv_2","type":"laser_epilation","name_ka":"დიოდური ეპილაცია — ფეხები და ბიკინი","name_en":"Legs & Bikini Diode Epilation","desc_ka":"ფეხები მთლიანად + ღრმა ბიკინი","desc_en":"Full legs and deep bikini area","price_gel":70,"duration_minutes":45,"is_epilation":true,"enabled":true},
      {"id":"srv_3","type":"laser_epilation","name_ka":"დიოდური ეპილაცია — იღლიები","name_en":"Underarms Diode Epilation","desc_ka":"სწრაფი და ეფექტური პროცედურა","desc_en":"Quick and gentle underarm treatment","price_gel":25,"duration_minutes":15,"is_epilation":true,"enabled":true},
      {"id":"srv_4","type":"facial","name_ka":"სახის ღრმა წმენდა და დატენიანება","name_en":"Deep Cleansing & Hydrating Facial","desc_ka":"აპარატურული ულტრაბგერითი წმენდა","desc_en":"Ultrasonic peeling and hydrating mask","price_gel":85,"duration_minutes":60,"is_epilation":false,"enabled":true}
    ]'::jsonb
  );

  -- Link user as owner
  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_user_id, 'owner', true);

  RETURN v_salon_id;
END;
$$;

-- End consolidated source: 20261016000007_moarge_multi_tenant_salon_registration.sql

-- Begin consolidated source: 20261016000008_moarge_production_ready_live_delivery.sql
-- Migration: 20261016000008_moarge_production_ready_live_delivery.sql
-- Production readiness:
-- 1. End dry-run mode: set default dry_run_mode = false across database and future provisioning
-- 2. Auto-generated read-only Booking URLs tied to unique salon slugs
-- 3. Update ensure_user_salon to enforce dry_run_mode = false by default

ALTER TABLE public.salon_settings
  ALTER COLUMN dry_run_mode SET DEFAULT false;

-- Disable dry-run mode on all existing salon settings
UPDATE public.salon_settings
SET dry_run_mode = false;

-- Synchronize booking_url with salon slug for all salons
UPDATE public.salon_settings ss
SET booking_url = 'https://moarge.ge/book?salon=' || s.slug
FROM public.salons s
WHERE ss.salon_id = s.id;

-- Ensure the demo salon slug has a clean booking_url
UPDATE public.salon_settings
SET booking_url = 'https://moarge.ge/book?salon=moarge-demo'
WHERE salon_id = '11111111-1111-4111-8111-111111111111';

-- Update ensure_user_salon function to default dry_run_mode to false
CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name text DEFAULT 'My Salon'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
      WHERE id = v_salon_id AND (name = 'moarge Demo Salon' OR name = 'moarge Demo Salon');

      UPDATE public.salon_settings
      SET salon_name = v_meta_salon_name,
          sender_display_name = v_meta_salon_name
      WHERE salon_id = v_salon_id AND (salon_name = 'moarge Demo Salon' OR salon_name = 'moarge Demo Salon');
    END IF;
    RETURN v_salon_id;
  END IF;

  -- 2. Determine salon name for new registration
  v_salon_name := COALESCE(v_meta_salon_name, NULLIF(trim(p_default_salon_name), ''), 'My Salon');

  -- 3. Create a brand new dedicated salon for the registering salon owner
  v_slug := lower(regexp_replace(v_salon_name, '[^a-zA-Z0-9]+', '-', 'g'));
  IF v_slug = '' OR v_slug = '-' THEN
    v_slug := 'salon';
  END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.salons (name, slug, subscription_tier, subscription_status)
  VALUES (v_salon_name, v_slug, 'professional', 'active')
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

-- End consolidated source: 20261016000008_moarge_production_ready_live_delivery.sql

-- Begin consolidated source: 20261016000009_smart_custom_services_and_templates.sql
-- ==============================================================================
-- Migration 009: Smart Custom Services, Duration-Aware Availability & Templates
-- ==============================================================================

-- 1. Ensure public.appointments has flexible service metadata columns
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price_gel NUMERIC(10,2);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;

-- 2. Drop any legacy enum check constraint on appointments.treatment_type
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_treatment_type_check;

-- 3. Ensure custom_services default in salon_settings is empty array, not pre-seeded
ALTER TABLE public.salon_settings ALTER COLUMN custom_services SET DEFAULT '[]'::jsonb;

-- 4. Upgrade submit_public_booking to resolve custom service details & respect custom duration
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

  -- 2. Match service from salon's custom_services catalog
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

  -- 3. Smart Conflict Detection: evaluate against existing appointments with duration
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
    p_treatment_type,
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

GRANT EXECUTE ON FUNCTION public.submit_public_booking(text, text, text, text, date, time, text, text, boolean) TO anon, authenticated, service_role;

-- End consolidated source: 20261016000009_smart_custom_services_and_templates.sql

-- Begin consolidated source: 20261016000010_add_client_created_by.sql
-- Migration 010: Add created_by column to public.clients for audit logging & quick appointments
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

-- End consolidated source: 20261016000010_add_client_created_by.sql

-- Begin consolidated source: 20261016000011_security_hardening.sql
-- Migration: 20261016000011_security_hardening.sql
-- Security Hardening for moarge Multi-Tenant Platform:
-- 1. Lock down claim_due_reminders to service_role only (revoke from PUBLIC, anon, authenticated).
-- 2. Remove hardcoded cron credentials from all RPC functions.
-- 3. Lock down record_reminder_send_result & process_email_webhook_event to service_role (or authorized salon staff).
-- 4. Protect salon_settings.resend_api_key: revoke SELECT on this column from authenticated, anon, and public.
-- 5. Legacy seeded accounts are not part of this baseline.
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
-- 6. Legacy seeded accounts are not part of this baseline.
-- ============================================================================


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

-- End consolidated source: 20261016000011_security_hardening.sql
