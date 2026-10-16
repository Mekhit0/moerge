-- ==============================================================================
-- Migration: 20261016000006_moerge_production_booking_and_tbilisi_tz.sql
-- Description: Upgrades project to MOERGE production state:
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

-- Update existing salon to MOERGE Georgia defaults (Asia/Tbilisi)
UPDATE public.salons
SET name = 'MOERGE Epilation & Beauty Studio'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.salon_settings
SET timezone = 'Asia/Tbilisi',
    salon_name = 'MOERGE Epilation & Beauty Studio',
    sender_display_name = 'MOERGE Studio',
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
      WHEN verified_sender_email = 'reminders@lumieresalon.com' THEN 'onboarding@resend.dev'
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

