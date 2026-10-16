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
  booking_url TEXT NOT NULL DEFAULT 'https://lumieresalon.example.com/book' CHECK (booking_url ~* '^https?://'),
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
  p_default_salon_name TEXT DEFAULT 'Lumière Epilation & Beauty Studio'
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
  VALUES (v_user_id, COALESCE(v_user_email, 'staff@lumieresalon.com'), COALESCE(v_full_name, 'Salon Staff'))
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
      'lumiere-epilation-' || substr(md5(random()::text), 1, 6),
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
      'reminders@lumieresalon.com',
      'America/New_York',
      21,
      'https://lumieresalon.com/book',
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
  IF p_cron_secret IS NOT NULL AND p_cron_secret = 'lumiere-salon-cron-secret-2026-secure' THEN
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

  IF p_cron_secret IS DISTINCT FROM 'lumiere-salon-cron-secret-2026-secure'
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
  IF p_cron_secret IS DISTINCT FROM 'lumiere-salon-cron-secret-2026-secure' THEN
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
