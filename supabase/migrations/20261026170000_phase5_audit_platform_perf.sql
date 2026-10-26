-- Phase 5: audit trail, feedback, platform overview, and booking query indexes.
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  entity_type text NOT NULL CHECK (entity_type IN ('salon_settings','salons','staff','staff_services','appointments')),
  entity_id uuid NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_salon_created_idx ON public.audit_log(salon_id,created_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log(salon_id,entity_type,entity_id,created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT TO authenticated USING (public.user_is_salon_admin(salon_id));
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.capture_salon_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_salon uuid; v_entity uuid; v_fields text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old:=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new:=to_jsonb(NEW); END IF;
  v_salon:=COALESCE((v_new->>'salon_id')::uuid,(v_old->>'salon_id')::uuid);
  IF TG_TABLE_NAME='salons' THEN v_salon:=COALESCE((v_new->>'id')::uuid,(v_old->>'id')::uuid); END IF;
  v_entity:=COALESCE((v_new->>'id')::uuid,(v_old->>'id')::uuid);
  IF TG_TABLE_NAME='staff_services' THEN
    v_entity:=COALESCE((v_new->>'staff_id')::uuid,(v_old->>'staff_id')::uuid);
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT COALESCE(array_agg(key ORDER BY key),'{}') INTO v_fields FROM jsonb_object_keys(v_new) AS keys(key)
      WHERE key NOT IN ('id','salon_id','created_at','updated_at');
  ELSIF TG_OP='DELETE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key),'{}') INTO v_fields FROM jsonb_object_keys(v_old) AS keys(key)
      WHERE key NOT IN ('id','salon_id','created_at','updated_at');
  ELSE
    SELECT COALESCE(array_agg(n.key ORDER BY n.key),'{}') INTO v_fields
    FROM jsonb_each(v_new) n JOIN jsonb_each(v_old) o USING(key)
    WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('id','salon_id','created_at','updated_at');
    IF TG_TABLE_NAME='salons' THEN v_fields:=ARRAY(SELECT x FROM unnest(v_fields) x WHERE x IN ('name','slug')); END IF;
  END IF;
  IF cardinality(v_fields)>0 THEN
    INSERT INTO public.audit_log(salon_id,actor_id,action,entity_type,entity_id,changed_fields)
    VALUES(v_salon,auth.uid(),lower(TG_OP),TG_TABLE_NAME,v_entity,v_fields);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.capture_salon_audit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS audit_salon_settings_changes ON public.salon_settings;
CREATE TRIGGER audit_salon_settings_changes AFTER INSERT OR UPDATE OR DELETE ON public.salon_settings
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();
DROP TRIGGER IF EXISTS audit_salon_slug_changes ON public.salons;
CREATE TRIGGER audit_salon_slug_changes AFTER UPDATE OF name,slug ON public.salons
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();
DROP TRIGGER IF EXISTS audit_staff_changes ON public.staff;
CREATE TRIGGER audit_staff_changes AFTER INSERT OR UPDATE OR DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();
DROP TRIGGER IF EXISTS audit_staff_services_changes ON public.staff_services;
CREATE TRIGGER audit_staff_services_changes AFTER INSERT OR UPDATE OR DELETE ON public.staff_services
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();
DROP TRIGGER IF EXISTS audit_appointment_changes ON public.appointments;
CREATE TRIGGER audit_appointment_changes AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();

CREATE TABLE public.dashboard_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 5 AND 2000),
  page_path text NOT NULL CHECK (char_length(page_path) BETWEEN 1 AND 300 AND left(page_path,1)='/'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dashboard_feedback_created_idx ON public.dashboard_feedback(created_at DESC);
ALTER TABLE public.dashboard_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_feedback_member_insert ON public.dashboard_feedback FOR INSERT TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id) AND submitted_by=auth.uid());
CREATE POLICY dashboard_feedback_admin_read ON public.dashboard_feedback FOR SELECT TO authenticated
  USING (public.user_is_salon_admin(salon_id));
GRANT INSERT,SELECT ON public.dashboard_feedback TO authenticated;
GRANT ALL ON public.dashboard_feedback TO service_role;

CREATE OR REPLACE FUNCTION public.platform_salon_overview(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0,p_since timestamptz DEFAULT NULL)
RETURNS TABLE(salon_id uuid,salon_name text,slug text,created_at timestamptz,subscription_status text,plan_code text,trial_ends_at timestamptz,grace_ends_at timestamptz,active_staff bigint,active_branches bigint,bookings_period bigint,sms_messages_period bigint,sms_cost_gel numeric,total_salons bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role only' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT s.id,s.name,s.slug,s.created_at,sub.status,sub.plan_code,sub.trial_ends_at,sub.grace_ends_at,
    COALESCE(st.active_count,0),COALESCE(br.active_count,0),COALESCE(ap.booking_count,0),COALESCE(sms.message_count,0),COALESCE(sms.sms_cost,0),count(*) OVER()
  FROM public.salons s
  LEFT JOIN public.subscriptions sub ON sub.salon_id=s.id
  LEFT JOIN LATERAL (SELECT count(*) AS active_count FROM public.staff x WHERE x.salon_id=s.id AND x.is_active) st ON true
  LEFT JOIN LATERAL (SELECT count(*) AS active_count FROM public.salon_branches x WHERE x.salon_id=s.id AND x.is_active) br ON true
  LEFT JOIN LATERAL (SELECT count(*) AS booking_count FROM public.appointments x WHERE x.salon_id=s.id AND x.created_at>=COALESCE(p_since,now()-interval '30 days')) ap ON true
  LEFT JOIN LATERAL (SELECT count(*) AS message_count,COALESCE(sum(x.cost),0) AS sms_cost FROM public.notification_log x WHERE x.salon_id=s.id AND x.channel='sms' AND x.created_at>=COALESCE(p_since,now()-interval '30 days') AND x.status IN ('sent','delivered')) sms ON true
  ORDER BY s.created_at DESC,s.id
  LIMIT GREATEST(1,LEAST(COALESCE(p_limit,100),200)) OFFSET GREATEST(COALESCE(p_offset,0),0);
END; $$;
REVOKE ALL ON FUNCTION public.platform_salon_overview(integer,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_salon_overview(integer,integer,timestamptz) TO service_role;

-- Calendar range lookups and availability exclusion checks.
CREATE INDEX appointments_calendar_range_idx ON public.appointments(salon_id,treatment_date,starts_at);
CREATE INDEX appointments_active_staff_start_idx ON public.appointments(staff_id,starts_at)
  WHERE status IN ('scheduled','completed','arrived');
CREATE INDEX appointments_active_resource_start_idx ON public.appointments(resource_id,starts_at)
  WHERE resource_id IS NOT NULL AND status IN ('scheduled','completed','arrived');
CREATE INDEX time_off_salon_range_gist_idx ON public.time_off USING gist(salon_id,tstzrange(starts_at,ends_at,'[)'));
CREATE INDEX staff_hours_active_lookup_idx ON public.staff_working_hours(salon_id,staff_id,weekday)
  WHERE NOT is_break;

