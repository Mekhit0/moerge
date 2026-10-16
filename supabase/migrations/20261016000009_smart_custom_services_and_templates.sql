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
