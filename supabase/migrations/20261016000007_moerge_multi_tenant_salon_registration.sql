-- ==============================================================================
-- MOERGE Migration 7: Multi-Tenant Salon Registration & Salon Name Separation
-- Ensures each salon displays its own business name, while MOERGE is the platform.
-- ==============================================================================

-- 1. Rename default seed salon from MOERGE to a salon name (Lumière Epilation Studio)
UPDATE public.salons
SET name = 'Lumière Epilation Studio',
    slug = 'lumiere-studio'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.salon_settings
SET salon_name = 'Lumière Epilation Studio',
    sender_display_name = 'Lumière Epilation Studio'
WHERE salon_id = '11111111-1111-4111-8111-111111111111';

-- 2. Upgrade ensure_user_salon to respect the salon_name entered during registration
CREATE OR REPLACE FUNCTION public.ensure_user_salon(
  p_default_salon_name TEXT DEFAULT 'Lumière Epilation Studio'
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
  VALUES (v_user_id, COALESCE(v_user_email, 'staff@salon.ge'), COALESCE(v_full_name, 'Salon Staff'))
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
    'https://moerge.ge/book?salon=' || v_slug,
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
