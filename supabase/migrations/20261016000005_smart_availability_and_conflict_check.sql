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
