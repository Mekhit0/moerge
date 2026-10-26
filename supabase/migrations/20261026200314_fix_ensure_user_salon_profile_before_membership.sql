-- Repair salon provisioning for authenticated users whose profile row is missing.
-- salon_memberships.user_id references user_profiles.id, so upsert the profile
-- before creating a membership. Serialize provisioning per user to avoid races.
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
  v_full_name text;
  v_salon_id uuid;
  v_salon_name text;
  v_slug text;
  v_meta_salon_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  SELECT
    u.email,
    NULLIF(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(pg_catalog.btrim(u.raw_user_meta_data->>'salon_name'), '')
  INTO v_user_email, v_full_name, v_meta_salon_name
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    v_user_id,
    COALESCE(v_user_email, ''),
    COALESCE(
      v_full_name,
      NULLIF(pg_catalog.split_part(COALESCE(v_user_email, ''), '@', 1), ''),
      'Salon Staff'
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(v_full_name, user_profiles.full_name);

  SELECT sm.salon_id
  INTO v_salon_id
  FROM public.salon_memberships AS sm
  WHERE sm.user_id = v_user_id
    AND sm.is_active
  ORDER BY sm.created_at
  LIMIT 1;

  IF v_salon_id IS NOT NULL THEN
    RETURN v_salon_id;
  END IF;

  v_salon_name := COALESCE(
    v_meta_salon_name,
    NULLIF(pg_catalog.btrim(p_default_salon_name), ''),
    'My Salon'
  );
  v_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(v_salon_name, '[^a-zA-Z0-9]+', '-', 'g')
  );
  IF v_slug = '' OR v_slug = '-' THEN
    v_slug := 'salon';
  END IF;
  v_slug := v_slug || '-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 6);

  INSERT INTO public.salons (
    name,
    slug,
    subscription_tier,
    subscription_status,
    trial_ends_at
  )
  VALUES (v_salon_name, v_slug, 'starter', 'trialing', now() + interval '14 days')
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
    dry_run_mode,
    booking_title,
    booking_subtitle,
    salon_address,
    salon_phone,
    working_hours_start,
    working_hours_end,
    slot_interval_minutes,
    send_booking_confirmation_email
  )
  VALUES (
    v_salon_id,
    v_salon_name,
    v_salon_name,
    'onboarding@resend.dev',
    'Asia/Tbilisi',
    21,
    'https://moarge.ge/book?salon=' || v_slug,
    true,
    false,
    'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online',
    'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო. | Choose a service, staff member and available time.',
    'თბილისი, ჭავჭავაძის გამზ. 34',
    '+995 555 00 11 22',
    '10:00',
    '20:00',
    60,
    true
  );

  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_user_id, 'owner', true);

  RETURN v_salon_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_user_salon(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_salon(text)
  TO authenticated;
