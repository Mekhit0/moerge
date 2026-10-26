-- Keep data visible to salon members, but restrict catalog and schedule changes
-- to owners and administrators even when clients access PostgREST directly.
DROP POLICY IF EXISTS staff_member_access ON public.staff;
DROP POLICY IF EXISTS services_member_access ON public.services;
DROP POLICY IF EXISTS staff_services_member_access ON public.staff_services;
DROP POLICY IF EXISTS resources_member_access ON public.resources;
DROP POLICY IF EXISTS service_resources_member_access ON public.service_resources;
DROP POLICY IF EXISTS staff_hours_member_access ON public.staff_working_hours;
DROP POLICY IF EXISTS time_off_member_access ON public.time_off;

CREATE POLICY staff_member_read ON public.staff FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY staff_admin_write ON public.staff FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY services_member_read ON public.services FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY services_admin_write ON public.services FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY staff_services_member_read ON public.staff_services FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY staff_services_admin_write ON public.staff_services FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY resources_member_read ON public.resources FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY resources_admin_write ON public.resources FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY service_resources_member_read ON public.service_resources FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY service_resources_admin_write ON public.service_resources FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY staff_hours_member_read ON public.staff_working_hours FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY staff_hours_admin_write ON public.staff_working_hours FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
CREATE POLICY time_off_member_read ON public.time_off FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
CREATE POLICY time_off_admin_write ON public.time_off FOR ALL TO authenticated USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));

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
      AND timezone(salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone)) = (p_date+sh.start_time+n*interval '15 minutes')
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
  SELECT local_time::time, chosen.staff_id, chosen.full_name, chosen.starts_at, chosen.ends_at FROM chosen ORDER BY local_time
$$;
REVOKE ALL ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) TO anon, authenticated, service_role;
