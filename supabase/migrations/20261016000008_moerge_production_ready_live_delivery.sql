-- Migration: 20261016000008_moerge_production_ready_live_delivery.sql
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
SET booking_url = 'https://moerge.ge/book?salon=' || s.slug
FROM public.salons s
WHERE ss.salon_id = s.id;

-- Ensure Lumiere default slug has clean booking_url
UPDATE public.salon_settings
SET booking_url = 'https://moerge.ge/book?salon=lumiere-studio'
WHERE salon_id = '11111111-1111-4111-8111-111111111111';

-- Update ensure_user_salon function to default dry_run_mode to false
CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name text DEFAULT 'Lumière Epilation Studio'
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
      WHERE id = v_salon_id AND (name = 'MOERGE Epilation & Beauty Studio' OR name = 'MOERGE Studio');

      UPDATE public.salon_settings
      SET salon_name = v_meta_salon_name,
          sender_display_name = v_meta_salon_name
      WHERE salon_id = v_salon_id AND (salon_name = 'MOERGE Epilation & Beauty Studio' OR salon_name = 'MOERGE Studio');
    END IF;
    RETURN v_salon_id;
  END IF;

  -- 2. Determine salon name for new registration
  v_salon_name := COALESCE(v_meta_salon_name, NULLIF(trim(p_default_salon_name), ''), 'Lumière Epilation Studio');

  -- If it's the demo staff account, link to seed salon if it exists
  IF v_user_email = 'staff@lumieresalon.com' AND v_meta_salon_name IS NULL THEN
    SELECT id INTO v_salon_id
    FROM public.salons
    WHERE id = '11111111-1111-4111-8111-111111111111';

    IF v_salon_id IS NOT NULL THEN
      INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
      VALUES (v_salon_id, v_user_id, 'owner', true)
      ON CONFLICT DO NOTHING;
      RETURN v_salon_id;
    END IF;
  END IF;

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
    'https://moerge.ge/book?salon=' || v_slug,
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
