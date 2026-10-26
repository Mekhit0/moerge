-- The function is executable only by service_role. Do not rely on claim-setting
-- details that differ between PostgREST and the Supabase service client.
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_salon_id uuid,p_service_id uuid,p_date date,p_start_time time,p_staff_id uuid,
  p_client_id uuid DEFAULT NULL,p_full_name text DEFAULT NULL,p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,p_notes text DEFAULT NULL,p_email_consent boolean DEFAULT false,
  p_sms_consent boolean DEFAULT false,p_language text DEFAULT 'ka'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_slot record; v_service public.services%rowtype; v_client_id uuid; v_client_email text;
  v_appointment public.appointments%rowtype; v_resource_id uuid; v_email_count integer;
  v_phone text; v_name text; v_incoming_email text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.salons s WHERE s.id=p_salon_id AND
    (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))) THEN
    RETURN jsonb_build_object('success',false,'error','Salon subscription is not active.');
  END IF;
  SELECT * INTO v_service FROM public.services WHERE id=p_service_id AND salon_id=p_salon_id AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Selected service is unavailable.'); END IF;
  SELECT * INTO v_slot FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id) s WHERE s.slot_time=p_start_time LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','This time is no longer available.',
      'available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
  END IF;
  SELECT sr.resource_id INTO v_resource_id FROM public.service_resources sr
    JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
    WHERE sr.service_id=v_service.id AND NOT EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.resource_id=sr.resource_id
      AND a.status IN ('scheduled','completed','arrived')
      AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_slot.starts_at,v_slot.ends_at,'[)')
    ) ORDER BY sr.resource_id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.service_resources WHERE service_id=v_service.id) AND v_resource_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','No required resource is available at this time.');
  END IF;
  v_incoming_email:=NULLIF(lower(trim(p_email)), '');
  IF v_incoming_email IS NOT NULL THEN
    INSERT INTO public.booking_email_daily_limits(email_hash,booking_date,booking_count)
    VALUES(encode(digest(v_incoming_email,'sha256'),'hex'),
      (now() AT TIME ZONE (SELECT timezone FROM public.salon_settings WHERE salon_id=p_salon_id))::date,1)
    ON CONFLICT(email_hash,booking_date) DO UPDATE
      SET booking_count=public.booking_email_daily_limits.booking_count+1
      WHERE public.booking_email_daily_limits.booking_count<3
    RETURNING booking_count INTO v_email_count;
    IF v_email_count IS NULL THEN RETURN jsonb_build_object('success',false,'error','This email has reached the daily booking limit.'); END IF;
  END IF;
  IF p_client_id IS NOT NULL THEN
    SELECT id,email INTO v_client_id,v_client_email FROM public.clients WHERE id=p_client_id AND salon_id=p_salon_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Client not found.'); END IF;
  ELSE
    v_name:=trim(COALESCE(p_full_name,''));
    v_phone:=public.normalize_georgian_phone(COALESCE(p_phone,''));
    IF length(v_name)<2 OR v_phone IS NULL THEN RETURN jsonb_build_object('success',false,'error','Name and a valid Georgian mobile number are required.'); END IF;
    INSERT INTO public.clients(salon_id,full_name,email,phone,email_consent,sms_consent,preferred_language,unsubscribed_at,sms_unsubscribed_at)
    VALUES(p_salon_id,v_name,v_incoming_email,v_phone,COALESCE(p_email_consent,false),
      COALESCE(p_sms_consent,false),CASE WHEN p_language IN ('ka','en') THEN p_language ELSE 'ka' END,
      CASE WHEN p_email_consent THEN NULL ELSE now() END,CASE WHEN p_sms_consent THEN NULL ELSE now() END)
    ON CONFLICT (salon_id,normalized_phone) WHERE normalized_phone IS NOT NULL
    DO UPDATE SET full_name=excluded.full_name,email=COALESCE(excluded.email,public.clients.email),
      email_consent=public.clients.email_consent OR excluded.email_consent,
      unsubscribed_at=CASE WHEN excluded.email_consent THEN NULL ELSE public.clients.unsubscribed_at END,
      sms_consent=public.clients.sms_consent OR excluded.sms_consent,
      sms_unsubscribed_at=CASE WHEN excluded.sms_consent THEN NULL ELSE public.clients.sms_unsubscribed_at END,
      preferred_language=excluded.preferred_language,is_archived=false,archived_at=NULL
    RETURNING id,email INTO v_client_id,v_client_email;
  END IF;
  INSERT INTO public.appointments(salon_id,client_id,treatment_date,treatment_time,treatment_type,status,notes,
    staff_id,resource_id,starts_at,ends_at,service_id,service_name,price_gel,duration_minutes,
    price_snapshot,duration_snapshot_minutes,buffer_snapshot_minutes,is_epilation)
  VALUES(p_salon_id,v_client_id,p_date,p_start_time,COALESCE(v_service.legacy_id,v_service.category),'scheduled',
    p_notes,v_slot.staff_id,v_resource_id,v_slot.starts_at,v_slot.ends_at,v_service.id::text,v_service.name_en,
    v_service.price_gel,v_service.duration_minutes,v_service.price_gel,v_service.duration_minutes,
    v_service.buffer_minutes,v_service.recall_days IS NOT NULL) RETURNING * INTO v_appointment;
  RETURN jsonb_build_object('success',true,'appointment_id',v_appointment.id,'client_id',v_client_id,
    'salon_id',p_salon_id,'salon_name',(SELECT name FROM public.salons WHERE id=p_salon_id),
    'treatment_date',p_date,'treatment_time',p_start_time,'treatment_type',COALESCE(v_service.legacy_id,v_service.category),
    'service_name',v_service.name_en,'service_id',v_service.id,'staff_id',v_slot.staff_id,
    'staff_name',v_slot.staff_name,'client_email',v_client_email,'price_gel',v_service.price_gel,
    'duration_minutes',v_service.duration_minutes,'manage_token',v_appointment.self_service_token);
EXCEPTION WHEN exclusion_violation THEN
  RETURN jsonb_build_object('success',false,'conflict',true,'error','This time was booked by another request.',
    'available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text,boolean,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text,boolean,boolean,text) TO service_role;
