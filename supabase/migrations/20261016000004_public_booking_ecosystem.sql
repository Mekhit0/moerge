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
WHERE booking_url = 'https://lumieresalon.com/book'
   OR booking_url = 'https://lumieresalon.example.com/book';
