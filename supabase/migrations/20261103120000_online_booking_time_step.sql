-- The salon's "time step when booking" now shapes online booking. Until now free times were
-- always offered every 15 minutes, whatever the salon chose.
--
-- p_online = true (the booking page and moving a booking with its code): times follow the salon's
-- step, counted from each specialist's start of day (10:00, 10:30, 11:00 for a 30 minute step).
-- p_online = false (default; the calendar and the final check when a booking is saved): every
-- 15 minutes as before, so the front desk can still book any quarter hour.
--
-- Same body as 20261026145931_phase2_dst_duration_math.sql otherwise. The old five-argument version
-- is dropped so calls with fewer arguments stay unambiguous.

DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, date, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_available_slots(p_salon_id uuid, p_service_id uuid, p_date date, p_staff_id uuid DEFAULT NULL, p_exclude_appointment_id uuid DEFAULT NULL, p_online boolean DEFAULT false)
RETURNS TABLE(slot_time time, staff_id uuid, staff_name text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH salon AS (
    SELECT s.id, ss.timezone,
      -- Steps are whole quarter hours between 15 minutes and 3 hours.
      CASE WHEN p_online THEN GREATEST(15, LEAST(180, (COALESCE(ss.slot_interval_minutes, 15) / 15) * 15)) ELSE 15 END AS step_minutes
    FROM public.salons s JOIN public.salon_settings ss ON ss.salon_id=s.id
    WHERE s.id=p_salon_id AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))
  ), svc AS (
    SELECT id, duration_minutes, buffer_minutes FROM public.services
    WHERE id=p_service_id AND salon_id=p_salon_id AND is_active AND is_online_bookable
  ), candidates AS (
    SELECT st.id AS staff_id, st.full_name, sh.start_time + (n * interval '15 minutes') AS local_time,
           (p_date + sh.start_time + (n * interval '15 minutes')) AT TIME ZONE salon.timezone AS starts_at,
           ((p_date + sh.start_time + (n * interval '15 minutes')) AT TIME ZONE salon.timezone) + make_interval(mins => svc.duration_minutes + svc.buffer_minutes) AS ends_at,
           (SELECT count(*) FROM public.appointments la WHERE la.staff_id=st.id AND la.starts_at >= p_date::timestamp AT TIME ZONE salon.timezone AND la.starts_at < (p_date+1)::timestamp AT TIME ZONE salon.timezone AND la.status IN ('scheduled','completed','arrived')) AS load
    FROM salon CROSS JOIN svc JOIN public.staff st ON st.salon_id=salon.id AND st.is_active
    JOIN public.staff_services ssrv ON ssrv.staff_id=st.id AND ssrv.service_id=svc.id
    JOIN public.staff_working_hours sh ON sh.staff_id=st.id AND sh.weekday=extract(dow FROM p_date)::int AND NOT sh.is_break
    CROSS JOIN LATERAL generate_series(0, greatest(0, floor(extract(epoch FROM (sh.end_time-sh.start_time))/900)::int)) AS slot_offsets(n)
    WHERE (p_staff_id IS NULL OR st.id=p_staff_id)
      AND (n * 15) % salon.step_minutes = 0
      AND p_date BETWEEN (now() AT TIME ZONE salon.timezone)::date AND (now() AT TIME ZONE salon.timezone)::date + 90
      AND timezone(salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone)) = (p_date+sh.start_time+n*interval '15 minutes')
      AND sh.start_time + n*interval '15 minutes' + make_interval(mins=>svc.duration_minutes+svc.buffer_minutes) <= sh.end_time
      AND NOT EXISTS (SELECT 1 FROM public.staff_working_hours br WHERE br.staff_id=st.id AND br.weekday=extract(dow FROM p_date)::int AND br.is_break AND (sh.start_time+n*interval '15 minutes', sh.start_time+n*interval '15 minutes'+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes)) OVERLAPS (br.start_time,br.end_time))
      AND NOT EXISTS (SELECT 1 FROM public.time_off t WHERE t.salon_id=salon.id AND (t.staff_id IS NULL OR t.staff_id=st.id) AND tstzrange(t.starts_at,t.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone)+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes),'[)'))
      AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.staff_id=st.id AND a.id IS DISTINCT FROM p_exclude_appointment_id AND a.status IN ('scheduled','completed','arrived') AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone)+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes),'[)'))
      AND (NOT EXISTS (SELECT 1 FROM public.service_resources sr WHERE sr.service_id=svc.id)
        OR EXISTS (SELECT 1 FROM public.service_resources sr JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
          WHERE sr.service_id=svc.id AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.resource_id=r.id AND a.id IS DISTINCT FROM p_exclude_appointment_id AND a.status IN ('scheduled','completed','arrived') AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone, ((p_date+sh.start_time+n*interval '15 minutes') AT TIME ZONE salon.timezone)+make_interval(mins=>svc.duration_minutes+svc.buffer_minutes),'[)'))))
  ), chosen AS (
    SELECT DISTINCT ON (local_time) local_time, candidates.staff_id, candidates.full_name, candidates.starts_at, candidates.ends_at
    FROM candidates ORDER BY local_time, load, staff_id
  )
  SELECT local_time::time, chosen.staff_id, chosen.full_name, chosen.starts_at, chosen.ends_at FROM chosen ORDER BY local_time
$$;
REVOKE EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid,boolean) TO service_role;
