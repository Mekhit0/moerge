CREATE OR REPLACE FUNCTION public.get_public_salon_booking_info(p_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'found',true,'salon_id',s.id,'slug',s.slug,'salon_name',ss.salon_name,'timezone',ss.timezone,
    'brand_color',ss.brand_color,'reminder_interval_days',ss.reminder_interval_days,'booking_title',ss.booking_title,
    'booking_subtitle',ss.booking_subtitle,'salon_address',ss.salon_address,'salon_phone',ss.salon_phone,
    'working_hours_start',ss.working_hours_start,'working_hours_end',ss.working_hours_end,'slot_interval_minutes',ss.slot_interval_minutes
  ) INTO v_result
  FROM public.salons s JOIN public.salon_settings ss ON ss.salon_id=s.id
  WHERE (p_slug IS NULL OR p_slug='' OR s.slug=p_slug)
    AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))
  ORDER BY s.created_at LIMIT 1;
  RETURN COALESCE(v_result,jsonb_build_object('found',false));
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_salon_booking_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ensure_salon_booking_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_staff_id uuid;
BEGIN
  SELECT id INTO v_staff_id FROM public.staff WHERE salon_id=NEW.salon_id ORDER BY sort_order,id LIMIT 1;
  IF v_staff_id IS NULL THEN
    INSERT INTO public.staff(salon_id,full_name,sort_order) VALUES(NEW.salon_id,NEW.salon_name,0) RETURNING id INTO v_staff_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE salon_id=NEW.salon_id) THEN
    INSERT INTO public.services(salon_id,name_ka,name_en,price_gel,duration_minutes,category,is_active,is_online_bookable)
    VALUES(NEW.salon_id,'კონსულტაცია','Consultation',0,30,'consultation',true,true);
  END IF;
  INSERT INTO public.staff_services(salon_id,staff_id,service_id)
  SELECT NEW.salon_id,st.id,sv.id FROM public.staff st JOIN public.services sv ON sv.salon_id=st.salon_id
  WHERE st.salon_id=NEW.salon_id AND st.is_active AND sv.is_active ON CONFLICT DO NOTHING;
  INSERT INTO public.staff_working_hours(salon_id,staff_id,weekday,start_time,end_time)
  SELECT NEW.salon_id,st.id,d,COALESCE(NULLIF(NEW.working_hours_start,'')::time,'10:00'),COALESCE(NULLIF(NEW.working_hours_end,'')::time,'20:00')
  FROM public.staff st CROSS JOIN generate_series(0,6) d
  WHERE st.salon_id=NEW.salon_id AND NOT EXISTS (SELECT 1 FROM public.staff_working_hours h WHERE h.staff_id=st.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_salon_booking_defaults() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ensure_user_salon(p_default_salon_name text DEFAULT 'My Salon')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_user_id uuid; v_user_email text; v_salon_id uuid; v_salon_name text; v_slug text; v_meta_salon_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email, raw_user_meta_data->>'salon_name' INTO v_user_email,v_meta_salon_name FROM auth.users WHERE id=v_user_id;
  v_meta_salon_name := NULLIF(trim(v_meta_salon_name),'');
  SELECT salon_id INTO v_salon_id FROM public.salon_memberships WHERE user_id=v_user_id AND is_active ORDER BY created_at LIMIT 1;
  IF v_salon_id IS NOT NULL THEN RETURN v_salon_id; END IF;
  v_salon_name := COALESCE(v_meta_salon_name,NULLIF(trim(p_default_salon_name),''),'My Salon');
  v_slug := lower(regexp_replace(v_salon_name,'[^a-zA-Z0-9]+','-','g'));
  IF v_slug='' OR v_slug='-' THEN v_slug:='salon'; END IF;
  v_slug := v_slug || '-' || substr(md5(random()::text),1,6);
  INSERT INTO public.salons(name,slug,subscription_tier,subscription_status,trial_ends_at)
  VALUES(v_salon_name,v_slug,'starter','trialing',now()+interval '14 days') RETURNING id INTO v_salon_id;
  INSERT INTO public.salon_settings(salon_id,salon_name,sender_display_name,verified_sender_email,timezone,reminder_interval_days,booking_url,auto_reminders_enabled,dry_run_mode,booking_title,booking_subtitle,salon_address,salon_phone,working_hours_start,working_hours_end,slot_interval_minutes,send_booking_confirmation_email)
  VALUES(v_salon_id,v_salon_name,v_salon_name,'onboarding@resend.dev','Asia/Tbilisi',21,'https://moarge.ge/book?salon='||v_slug,true,false,'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online','აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო. | Choose a service, staff member and available time.','თბილისი, ჭავჭავაძის გამზ. 34','+995 555 00 11 22','10:00','20:00',60,true);
  INSERT INTO public.salon_memberships(salon_id,user_id,role,is_active) VALUES(v_salon_id,v_user_id,'owner',true);
  RETURN v_salon_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_user_salon(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_salon(text) TO authenticated;

ALTER TABLE public.salon_settings DROP COLUMN custom_services;
