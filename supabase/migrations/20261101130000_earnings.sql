-- Dashboard step 7: earnings, analytics and master commission.
-- 1. Commission: a default % per master, an optional % per service that wins over it. The rate is
--    saved on each payment when it is taken, so later changes never rewrite past payouts.
--    Commission is paid on the amount after discount; tips go to the master in full.
-- 2. Only the owner changes commission rates and whether admins may see earnings.
-- 3. get_earnings(): all numbers for a period in one call. It runs with the caller's own access, so
--    a master gets numbers from their own visits only.

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2) NOT NULL DEFAULT 0
  CHECK (commission_percent BETWEEN 0 AND 100);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2)
  CHECK (commission_percent IS NULL OR commission_percent BETWEEN 0 AND 100);
ALTER TABLE public.visit_payments ADD COLUMN IF NOT EXISTS commission_percent numeric(5,2)
  CHECK (commission_percent IS NULL OR commission_percent BETWEEN 0 AND 100);
ALTER TABLE public.salon_settings ADD COLUMN IF NOT EXISTS admins_see_earnings boolean NOT NULL DEFAULT false;
GRANT SELECT (admins_see_earnings), UPDATE (admins_see_earnings) ON public.salon_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.is_salon_owner(target_salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM public.salon_memberships sm WHERE sm.salon_id = target_salon_id AND sm.user_id = auth.uid() AND sm.is_active AND sm.role = 'owner');
$$;
REVOKE EXECUTE ON FUNCTION public.is_salon_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_salon_owner(uuid) TO authenticated;

-- Money settings are the owner's. Server jobs (no signed-in user) are not affected.
CREATE OR REPLACE FUNCTION public.guard_owner_money_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_salon_owner(NEW.salon_id) THEN
    RETURN NEW;
  END IF;
  -- Separate blocks: each table only has its own columns.
  IF TG_TABLE_NAME = 'salon_settings' THEN
    IF NEW.admins_see_earnings IS DISTINCT FROM OLD.admins_see_earnings THEN
      RAISE EXCEPTION 'Only the owner changes who sees earnings' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.commission_percent, 0) <> 0 THEN
      RAISE EXCEPTION 'Only the owner changes commission' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent THEN
    RAISE EXCEPTION 'Only the owner changes commission' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_owner_money_settings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_owner_money_settings ON public.salon_settings;
CREATE TRIGGER guard_owner_money_settings BEFORE UPDATE ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_money_settings();
DROP TRIGGER IF EXISTS guard_owner_money_settings ON public.staff;
CREATE TRIGGER guard_owner_money_settings BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_money_settings();
DROP TRIGGER IF EXISTS guard_owner_money_settings ON public.services;
CREATE TRIGGER guard_owner_money_settings BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.guard_owner_money_settings();

-- Save the commission rate on each new payment.
CREATE OR REPLACE FUNCTION public.set_payment_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  SELECT coalesce(sv.commission_percent, st.commission_percent, 0)
  INTO NEW.commission_percent
  FROM public.appointments a
  LEFT JOIN public.services sv ON sv.id::text = a.service_id AND sv.salon_id = a.salon_id
  LEFT JOIN public.staff st ON st.id = NEW.staff_id AND st.salon_id = NEW.salon_id
  WHERE a.id = NEW.appointment_id;
  NEW.commission_percent := coalesce(NEW.commission_percent, 0);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_payment_commission() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS set_payment_commission ON public.visit_payments;
CREATE TRIGGER set_payment_commission BEFORE INSERT ON public.visit_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_commission();

-- Payments taken before this step get today's rates (all rates start at 0).
UPDATE public.visit_payments vp
SET commission_percent = coalesce(sv.commission_percent, st.commission_percent, 0)
FROM public.appointments a
LEFT JOIN public.services sv ON sv.id::text = a.service_id
LEFT JOIN public.staff st ON st.id = a.staff_id
WHERE a.id = vp.appointment_id AND vp.commission_percent IS NULL;

-- One period of numbers. Visits count by their visit date (Georgia time). Canceled visits only count
-- as canceled. Spent money comes from active payments; done visits without a payment are listed as unpaid.
CREATE OR REPLACE FUNCTION public.get_earnings(p_salon_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.user_has_salon_access(p_salon_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Choose a period of up to one year' USING ERRCODE = '22023';
  END IF;

  WITH v AS (
    SELECT a.id, a.client_id, a.staff_id, a.status, a.treatment_date,
      coalesce(nullif(a.service_name, ''), a.treatment_type, '') AS service,
      coalesce(a.price_snapshot, a.price_gel, 0)::numeric AS price,
      greatest(coalesce(extract(epoch FROM (a.ends_at - a.starts_at)) / 60, a.duration_minutes, 0), 0)::numeric AS minutes,
      (a.starts_at AT TIME ZONE 'Asia/Tbilisi') AS local_start,
      p.total_gel, p.tip_gel, p.discount_gel, p.cash_gel, p.card_gel, p.commission_percent
    FROM public.appointments a
    LEFT JOIN public.visit_payments p ON p.appointment_id = a.id AND p.voided_at IS NULL
    WHERE a.salon_id = p_salon_id AND a.treatment_date BETWEEN p_from AND p_to
  ),
  active AS (SELECT * FROM v WHERE status <> 'canceled'),
  done AS (SELECT * FROM v WHERE status = 'completed'),
  first_visits AS (
    SELECT a.client_id, min(a.treatment_date) AS first_date
    FROM public.appointments a
    WHERE a.salon_id = p_salon_id AND a.status = 'completed' AND a.client_id IN (SELECT client_id FROM done)
    GROUP BY a.client_id
  ),
  hours AS (
    SELECT h.staff_id, h.weekday,
      sum(CASE WHEN h.is_break THEN -1 ELSE 1 END * extract(epoch FROM (h.end_time - h.start_time)) / 60) AS minutes
    FROM public.staff_working_hours h WHERE h.salon_id = p_salon_id GROUP BY h.staff_id, h.weekday
  ),
  days AS (SELECT d::date AS day FROM generate_series(p_from, p_to, interval '1 day') AS d),
  work AS (
    SELECT h.staff_id, sum(greatest(h.minutes, 0)) AS minutes
    FROM days JOIN hours h ON h.weekday = extract(dow FROM days.day) GROUP BY h.staff_id
  )
  SELECT jsonb_build_object(
    'money', (SELECT jsonb_build_object(
      'paid_total', coalesce(sum(total_gel), 0),
      'tips', coalesce(sum(tip_gel), 0),
      'discounts', coalesce(sum(discount_gel), 0),
      'cash', coalesce(sum(cash_gel), 0),
      'card', coalesce(sum(card_gel), 0),
      'payments', count(total_gel),
      'commission', coalesce(sum(round(total_gel * coalesce(commission_percent, 0) / 100, 2)), 0),
      'unpaid_count', count(*) FILTER (WHERE total_gel IS NULL),
      'unpaid_value', coalesce(sum(price) FILTER (WHERE total_gel IS NULL), 0)
    ) FROM done),
    'expected_total', (SELECT coalesce(sum(price), 0) FROM active WHERE status NOT IN ('no_show', 'missed')),
    'visits', jsonb_build_object(
      'booked', (SELECT count(*) FROM active),
      'completed', (SELECT count(*) FROM done),
      'no_show', (SELECT count(*) FROM active WHERE status IN ('no_show', 'missed')),
      'canceled', (SELECT count(*) FROM v WHERE status = 'canceled')
    ),
    'clients', (SELECT jsonb_build_object(
      'served', count(DISTINCT d.client_id),
      'new', count(DISTINCT d.client_id) FILTER (WHERE f.first_date >= p_from)
    ) FROM done d LEFT JOIN first_visits f ON f.client_id = d.client_id),
    'masters', (SELECT coalesce(jsonb_agg(row_to_json(m) ORDER BY m.sort_order, m.full_name), '[]'::jsonb) FROM (
      SELECT s.id AS staff_id, s.full_name, s.color, s.sort_order, s.commission_percent AS rate,
        (SELECT count(*) FROM done WHERE staff_id = s.id) AS completed,
        (SELECT count(*) FROM active WHERE staff_id = s.id AND status IN ('no_show', 'missed')) AS no_show,
        (SELECT coalesce(sum(total_gel), 0) FROM done WHERE staff_id = s.id) AS paid_total,
        (SELECT count(total_gel) FROM done WHERE staff_id = s.id) AS payments,
        (SELECT coalesce(sum(tip_gel), 0) FROM done WHERE staff_id = s.id) AS tips,
        (SELECT coalesce(sum(round(total_gel * coalesce(commission_percent, 0) / 100, 2)), 0) FROM done WHERE staff_id = s.id) AS commission,
        (SELECT coalesce(sum(minutes), 0) FROM active WHERE staff_id = s.id AND status NOT IN ('no_show', 'missed')) AS booked_minutes,
        coalesce((SELECT minutes FROM work WHERE work.staff_id = s.id), 0) AS working_minutes
      FROM public.staff s
      WHERE s.salon_id = p_salon_id AND (s.is_active OR EXISTS (SELECT 1 FROM v WHERE v.staff_id = s.id))
    ) m),
    'services', (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.visits DESC, x.paid_total DESC), '[]'::jsonb) FROM (
      SELECT service AS name, count(*) AS visits, coalesce(sum(total_gel), 0) AS paid_total
      FROM done GROUP BY service ORDER BY count(*) DESC, coalesce(sum(total_gel), 0) DESC LIMIT 10
    ) x),
    'daily', (SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.day), '[]'::jsonb) FROM (
      SELECT days.day,
        (SELECT coalesce(sum(total_gel), 0) FROM done WHERE treatment_date = days.day) AS paid_total,
        (SELECT count(*) FROM active WHERE treatment_date = days.day AND status NOT IN ('no_show', 'missed')) AS visits
      FROM days
    ) x),
    'heatmap', (SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
      SELECT extract(dow FROM local_start)::int AS weekday, extract(hour FROM local_start)::int AS hour, count(*) AS visits
      FROM active WHERE local_start IS NOT NULL AND status NOT IN ('no_show', 'missed')
      GROUP BY 1, 2
    ) x)
  ) INTO v_result;
  RETURN v_result;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_earnings(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_earnings(uuid, date, date) TO authenticated;
