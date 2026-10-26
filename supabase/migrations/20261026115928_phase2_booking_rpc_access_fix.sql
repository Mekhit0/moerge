-- Phase 2 follow-up: fix service-role authorization and retain locked legacy RPC stubs.

CREATE OR REPLACE FUNCTION public.get_available_slots(p_salon_id uuid, p_service_id uuid, p_date date, p_staff_id uuid DEFAULT NULL, p_exclude_appointment_id uuid DEFAULT NULL)
RETURNS TABLE(slot_time time, staff_id uuid, staff_name text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH salon AS (
    SELECT s.id, ss.timezone FROM public.salons s JOIN public.salon_settings ss ON ss.salon_id=s.id
    WHERE s.id=p_salon_id AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))
  ), svc AS (
    SELECT id, duration_minutes, buffer_minutes FROM public.services
    WHERE id=p_service_id AND salon_id=p_salon_id AND is_active AND is_online_bookable
  ), candidates AS (
    SELECT st.id AS staff_id, st.full_name, sh.start_time + (n * interval '15 minutes') AS local_time,
           (p_date + sh.start_time + (n * interval '15 minutes')) AT TIME ZONE salon.timezone AS starts_at,
           ((p_date + sh.start_time + (n * interval '15 minutes')) + make_interval(mins => svc.duration_minutes + svc.buffer_minutes)) AT TIME ZONE salon.timezone AS ends_at,
           (SELECT count(*) FROM public.appointments la WHERE la.staff_id=st.id AND la.starts_at >= p_date::timestamp AT TIME ZONE salon.timezone AND la.starts_at < (p_date+1)::timestamp AT TIME ZONE salon.timezone AND la.status IN ('scheduled','completed','arrived')) AS load
    FROM salon CROSS JOIN svc JOIN public.staff st ON st.salon_id=salon.id AND st.is_active
    JOIN public.staff_services ssrv ON ssrv.staff_id=st.id AND ssrv.service_id=svc.id
    JOIN public.staff_working_hours sh ON sh.staff_id=st.id AND sh.weekday=extract(dow FROM p_date)::int AND NOT sh.is_break
    CROSS JOIN LATERAL generate_series(0, greatest(0, floor(extract(epoch FROM (sh.end_time-sh.start_time))/900)::int)) AS slot_offsets(n)
    WHERE (p_staff_id IS NULL OR st.id=p_staff_id)
      AND p_date BETWEEN (now() AT TIME ZONE salon.timezone)::date AND (now() AT TIME ZONE salon.timezone)::date + 90
      AND sh.start_time + n*interval '15 minutes' + make_interval(mins=>svc.duration_minutes+svc.buffer_minutes) <= sh.end_time
      AND NOT EXISTS (SELECT 1 FROM public.staff_working_hours br WHERE br.staff_id=st.id AND br.weekday=extract(dow FROM p_date)::int AND br.is_break AND (sh.start_time+n*interval '15 minutes', sh.start_time+n*interval '15 minutes'+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)) OVERLAPS (br.start_time,br.end_time))
      AND NOT EXISTS (SELECT 1 FROM public.time_off t WHERE t.salon_id=salon.id AND (t.staff_id IS NULL OR t.staff_id=st.id) AND tstzrange(t.starts_at,t.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes')+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)) AT TIME ZONE salon.timezone,'[)'))
      AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.staff_id=st.id AND a.id IS DISTINCT FROM p_exclude_appointment_id AND a.status IN ('scheduled','completed','arrived') AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes')+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)) AT TIME ZONE salon.timezone,'[)'))
      AND (NOT EXISTS (SELECT 1 FROM public.service_resources sr WHERE sr.service_id=svc.id)
        OR EXISTS (SELECT 1 FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
          WHERE sr.service_id=svc.id AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.resource_id=r.id AND a.id IS DISTINCT FROM p_exclude_appointment_id AND a.status IN ('scheduled','completed','arrived') AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes')+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)) AT TIME ZONE salon.timezone,'[)'))))
  ), chosen AS (
    SELECT DISTINCT ON (local_time) local_time, candidates.staff_id, candidates.full_name, candidates.starts_at, candidates.ends_at
    FROM candidates ORDER BY local_time, load, staff_id
  )
  SELECT local_time::time, chosen.staff_id, chosen.full_name, chosen.starts_at, chosen.ends_at FROM chosen
  WHERE p_date >= (now() AT TIME ZONE (SELECT timezone FROM salon))::date
  ORDER BY local_time
$$;
REVOKE ALL ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_salon_id uuid, p_service_id uuid, p_date date, p_start_time time, p_staff_id uuid,
  p_client_id uuid DEFAULT NULL, p_full_name text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_slot record; v_service public.services%rowtype; v_client_id uuid; v_client_email text; v_appointment public.appointments%rowtype; v_resource_id uuid; v_email_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR NOT public.user_has_salon_access(p_salon_id)) THEN
    RAISE EXCEPTION 'Salon access required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.salons s WHERE s.id=p_salon_id AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))) THEN
    RETURN jsonb_build_object('success',false,'error','Salon subscription is not active.');
  END IF;
  SELECT * INTO v_service FROM public.services WHERE id=p_service_id AND salon_id=p_salon_id AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Selected service is unavailable.'); END IF;
  SELECT * INTO v_slot FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id) s WHERE s.slot_time=p_start_time LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','This time is no longer available.','available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
  END IF;
  SELECT sr.resource_id INTO v_resource_id
  FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
  WHERE sr.service_id=v_service.id AND NOT EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.resource_id=sr.resource_id AND a.status IN ('scheduled','completed','arrived')
      AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_slot.starts_at,v_slot.ends_at,'[)')
  ) ORDER BY sr.resource_id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.service_resources WHERE service_id=v_service.id) AND v_resource_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','No required resource is available at this time.');
  END IF;
  v_client_email := NULLIF(lower(trim(p_email)), '');
  IF v_client_email IS NOT NULL THEN
    INSERT INTO public.booking_email_daily_limits(email_hash,booking_date,booking_count)
    VALUES (encode(digest(v_client_email,'sha256'),'hex'), (now() AT TIME ZONE (SELECT timezone FROM public.salon_settings WHERE salon_id=p_salon_id))::date, 1)
    ON CONFLICT (email_hash,booking_date) DO UPDATE SET booking_count=public.booking_email_daily_limits.booking_count+1
      WHERE public.booking_email_daily_limits.booking_count < 3
    RETURNING booking_count INTO v_email_count;
    IF v_email_count IS NULL THEN RETURN jsonb_build_object('success',false,'error','This email has reached the daily booking limit.'); END IF;
  END IF;
  IF p_client_id IS NOT NULL THEN
    SELECT id,email INTO v_client_id,v_client_email FROM public.clients WHERE id=p_client_id AND salon_id=p_salon_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Client not found.'); END IF;
  ELSE
    IF length(trim(COALESCE(p_full_name,''))) < 2 OR length(trim(COALESCE(p_phone,''))) < 5 THEN
      RETURN jsonb_build_object('success',false,'error','Name and phone are required.');
    END IF;
    IF v_client_email IS NULL THEN
      INSERT INTO public.clients(salon_id,full_name,email,phone,email_consent) VALUES(p_salon_id,trim(p_full_name),NULL,trim(p_phone),false) RETURNING id INTO v_client_id;
    ELSE
      INSERT INTO public.clients(salon_id,full_name,email,phone,email_consent) VALUES(p_salon_id,trim(p_full_name),v_client_email,trim(p_phone),false)
      ON CONFLICT (salon_id,normalized_email) DO UPDATE SET full_name=excluded.full_name, phone=excluded.phone, is_archived=false, archived_at=NULL RETURNING id INTO v_client_id;
    END IF;
  END IF;
  INSERT INTO public.appointments(salon_id,client_id,treatment_date,treatment_time,treatment_type,status,notes,staff_id,resource_id,starts_at,ends_at,service_id,service_name,price_gel,duration_minutes,price_snapshot,duration_snapshot_minutes,buffer_snapshot_minutes,is_epilation)
  VALUES(p_salon_id,v_client_id,p_date,p_start_time,COALESCE(v_service.legacy_id,v_service.category),'scheduled',p_notes,v_slot.staff_id,v_resource_id,v_slot.starts_at,v_slot.ends_at,v_service.id::text,v_service.name_en,v_service.price_gel,v_service.duration_minutes,v_service.price_gel,v_service.duration_minutes,v_service.buffer_minutes,v_service.recall_days IS NOT NULL)
  RETURNING * INTO v_appointment;
  RETURN jsonb_build_object('success',true,'appointment_id',v_appointment.id,'client_id',v_client_id,'salon_id',p_salon_id,'salon_name',(SELECT name FROM public.salons WHERE id=p_salon_id),'treatment_date',p_date,'treatment_time',p_start_time,'treatment_type',v_service.legacy_id,'service_id',v_service.id,'staff_id',v_slot.staff_id,'staff_name',v_slot.staff_name,'client_email',v_client_email,'price_gel',v_service.price_gel,'duration_minutes',v_service.duration_minutes);
EXCEPTION WHEN exclusion_violation THEN
  RETURN jsonb_build_object('success',false,'conflict',true,'error','This time was booked by another request.','available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_salon_id uuid, p_appointment_id uuid, p_date date, p_start_time time, p_staff_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_appt public.appointments%rowtype; v_service_id uuid; v_slot record; v_resource_id uuid;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id=p_appointment_id AND salon_id=p_salon_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Appointment not found.'); END IF;
  BEGIN
    v_service_id := v_appt.service_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    SELECT id INTO v_service_id FROM public.services WHERE salon_id=p_salon_id AND legacy_id=v_appt.service_id LIMIT 1;
  END;
  IF v_service_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Service is no longer available.'); END IF;
  SELECT * INTO v_slot FROM public.get_available_slots(p_salon_id,v_service_id,p_date,COALESCE(p_staff_id,v_appt.staff_id),p_appointment_id) WHERE slot_time=p_start_time LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'conflict',true,'error','This time is no longer available.','available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,v_service_id,p_date,COALESCE(p_staff_id,v_appt.staff_id),p_appointment_id)),'[]'::jsonb)); END IF;
  SELECT sr.resource_id INTO v_resource_id FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
  WHERE sr.service_id=v_service_id AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.resource_id=sr.resource_id AND a.id<>p_appointment_id AND a.status IN ('scheduled','completed','arrived') AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_slot.starts_at,v_slot.ends_at,'[)')) ORDER BY sr.resource_id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.service_resources WHERE service_id=v_service_id) AND v_resource_id IS NULL THEN RETURN jsonb_build_object('success',false,'conflict',true,'error','No required resource is available at this time.'); END IF;
  UPDATE public.appointments SET treatment_date=p_date,treatment_time=p_start_time,staff_id=v_slot.staff_id,resource_id=v_resource_id,starts_at=v_slot.starts_at,ends_at=v_slot.ends_at WHERE id=p_appointment_id RETURNING * INTO v_appt;
  RETURN jsonb_build_object('success',true,'appointment_id',v_appt.id,'staff_id',v_appt.staff_id,'starts_at',v_appt.starts_at,'ends_at',v_appt.ends_at);
EXCEPTION WHEN exclusion_violation THEN
  RETURN jsonb_build_object('success',false,'conflict',true,'error','This time was booked by another request.');
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid,uuid,date,time,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid,uuid,date,time,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_salon_date_availability(p_salon_slug text DEFAULT NULL,p_date date DEFAULT CURRENT_DATE,p_salon_id uuid DEFAULT NULL,p_exclude_appointment_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'This salon-wide availability RPC has been retired; use get_available_slots.' USING ERRCODE='42501'; END;
$$;
REVOKE ALL ON FUNCTION public.get_salon_date_availability(text,date,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_salon_date_availability(text,date,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.submit_public_booking(p_salon_slug text DEFAULT NULL,p_full_name text DEFAULT NULL,p_email text DEFAULT NULL,p_phone text DEFAULT NULL,p_treatment_date date DEFAULT NULL,p_treatment_time time DEFAULT '10:30:00',p_treatment_type text DEFAULT 'laser_epilation',p_notes text DEFAULT NULL,p_email_consent boolean DEFAULT true,p_client_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'This booking RPC has been retired; use the validated public booking endpoint.' USING ERRCODE='42501'; END;
$$;
REVOKE ALL ON FUNCTION public.submit_public_booking(text,text,text,text,date,time,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_booking(text,text,text,text,date,time,text,text,boolean,text) TO service_role;
