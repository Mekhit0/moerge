CREATE OR REPLACE FUNCTION public.ensure_salon_booking_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  SELECT id INTO v_staff_id FROM public.staff WHERE salon_id=NEW.salon_id ORDER BY sort_order,id LIMIT 1;
  IF v_staff_id IS NULL THEN
    INSERT INTO public.staff(salon_id,full_name,sort_order) VALUES(NEW.salon_id,NEW.salon_name,0) RETURNING id INTO v_staff_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.services WHERE salon_id=NEW.salon_id) THEN
    INSERT INTO public.services(salon_id,legacy_id,name_ka,name_en,price_gel,duration_minutes,category,recall_days,is_active,is_online_bookable)
    SELECT NEW.salon_id,x->>'id',COALESCE(NULLIF(x->>'name_ka',''),x->>'name_en','სერვისი'),COALESCE(NULLIF(x->>'name_en',''),x->>'name_ka','Service'),
      COALESCE(NULLIF(x->>'price_gel','')::numeric,0),COALESCE(NULLIF(x->>'duration_minutes','')::integer,45),COALESCE(x->>'category',x->>'type','general'),
      COALESCE(NULLIF(x->>'reminder_days','')::integer,CASE WHEN COALESCE((x->>'is_epilation')::boolean,false) THEN 21 ELSE NULL END),
      COALESCE((x->>'enabled')::boolean,true),COALESCE((x->>'enabled')::boolean,true)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.custom_services)='array' THEN NEW.custom_services ELSE '[]'::jsonb END) x;
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE salon_id=NEW.salon_id) THEN
      INSERT INTO public.services(salon_id,name_ka,name_en,price_gel,duration_minutes,category,is_active,is_online_bookable)
      VALUES(NEW.salon_id,'კონსულტაცია','Consultation',0,30,'consultation',true,true);
    END IF;
  END IF;

  INSERT INTO public.staff_services(salon_id,staff_id,service_id)
  SELECT NEW.salon_id,st.id,sv.id FROM public.staff st JOIN public.services sv ON sv.salon_id=st.salon_id
  WHERE st.salon_id=NEW.salon_id AND st.is_active AND sv.is_active
  ON CONFLICT DO NOTHING;

  INSERT INTO public.staff_working_hours(salon_id,staff_id,weekday,start_time,end_time)
  SELECT NEW.salon_id,st.id,d,COALESCE(NULLIF(NEW.working_hours_start,'')::time,'10:00'),COALESCE(NULLIF(NEW.working_hours_end,'')::time,'20:00')
  FROM public.staff st CROSS JOIN generate_series(0,6) d
  WHERE st.salon_id=NEW.salon_id AND NOT EXISTS (SELECT 1 FROM public.staff_working_hours h WHERE h.staff_id=st.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_salon_booking_defaults() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER trg_salon_booking_defaults
AFTER INSERT ON public.salon_settings
FOR EACH ROW EXECUTE FUNCTION public.ensure_salon_booking_defaults();
