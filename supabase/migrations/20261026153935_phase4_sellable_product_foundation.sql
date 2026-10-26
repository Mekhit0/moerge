-- Phase 4 sellable product: onboarding, billing ledger, reports and client data tools.
ALTER TABLE public.salon_settings
  ADD COLUMN onboarding_completed_at timestamptz,
  ADD COLUMN deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN deposit_amount_gel numeric(8,2),
  ADD COLUMN deposit_percentage smallint,
  ADD CONSTRAINT salon_settings_deposit_mode_check CHECK (
    (NOT deposit_required AND deposit_amount_gel IS NULL AND deposit_percentage IS NULL) OR
    (deposit_required AND ((deposit_amount_gel > 0 AND deposit_percentage IS NULL) OR
      (deposit_amount_gel IS NULL AND deposit_percentage BETWEEN 1 AND 100))));
UPDATE public.salon_settings SET onboarding_completed_at=now() WHERE onboarding_completed_at IS NULL;
ALTER TABLE public.clients ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.salons ADD COLUMN subscription_period_ends_at timestamptz, ADD COLUMN billing_past_due_at timestamptz;

CREATE TABLE public.plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 code text NOT NULL CHECK(code IN ('business','multi_branch')), name_ka text NOT NULL, name_en text NOT NULL,
 base_monthly_gel numeric(10,2) NOT NULL CHECK(base_monthly_gel>=0), branch_limit integer NOT NULL,
 staff_limit integer NOT NULL, included_sms integer NOT NULL, extra_staff_monthly_gel numeric(10,2) NOT NULL,
 is_active boolean NOT NULL DEFAULT true, UNIQUE(salon_id,code));
CREATE TABLE public.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL UNIQUE REFERENCES public.salons(id) ON DELETE CASCADE,
 plan_id uuid REFERENCES public.plans(id), plan_code text NOT NULL DEFAULT 'business' CHECK(plan_code IN ('business','multi_branch')),
 status text NOT NULL DEFAULT 'trialing' CHECK(status IN ('trialing','active','past_due','canceled')),
 current_period_start timestamptz NOT NULL DEFAULT now(), current_period_end timestamptz,
 trial_ends_at timestamptz NOT NULL DEFAULT now()+interval '14 days', grace_ends_at timestamptz,
 prepaid_months smallint NOT NULL DEFAULT 1 CHECK(prepaid_months IN (1,3,6,12)), cancel_at_period_end boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 subscription_id uuid REFERENCES public.subscriptions(id), kind text NOT NULL CHECK(kind IN ('plan','usage','sms_pack','deposit')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid','void','failed','refunded')),
 plan_code text CHECK(plan_code IS NULL OR plan_code IN ('business','multi_branch')),
 prepaid_months smallint NOT NULL DEFAULT 1, period_start timestamptz, period_end timestamptz,
 subtotal_gel numeric(12,2) NOT NULL DEFAULT 0, total_gel numeric(12,2) NOT NULL CHECK(total_gel>=0), currency text NOT NULL DEFAULT 'GEL',
 issued_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL DEFAULT now()+interval '7 days', paid_at timestamptz,
 idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(salon_id,idempotency_key));
CREATE TABLE public.invoice_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
 line_type text NOT NULL CHECK(line_type IN ('plan','extra_staff','sms_overage','sms_pack','deposit','adjustment')),
 description text NOT NULL, quantity numeric(12,2) NOT NULL CHECK(quantity>=0), unit_price_gel numeric(12,4) NOT NULL CHECK(unit_price_gel>=0),
 total_gel numeric(12,2) NOT NULL CHECK(total_gel>=0), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 invoice_id uuid NOT NULL REFERENCES public.invoices(id), provider text NOT NULL, provider_payment_id text,
 status text NOT NULL CHECK(status IN ('pending','paid','failed','refunded')), amount_gel numeric(12,2) NOT NULL CHECK(amount_gel>=0),
 idempotency_key text NOT NULL, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(salon_id,idempotency_key), UNIQUE(provider,provider_payment_id));
CREATE TABLE public.sms_wallet (
 salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE, included_quota integer NOT NULL DEFAULT 0,
 prepaid_balance integer NOT NULL DEFAULT 0 CHECK(prepaid_balance>=0), used_this_period integer NOT NULL DEFAULT 0,
 overage_count integer NOT NULL DEFAULT 0, overage_cap_gel numeric(10,2) NOT NULL DEFAULT 50,
 period_start timestamptz NOT NULL DEFAULT date_trunc('month',now()), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.salon_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 name text NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(salon_id,name));

DO $$ DECLARE s record; b uuid; p uuid; BEGIN
 FOR s IN SELECT id,subscription_status,trial_ends_at,subscription_tier FROM public.salons LOOP
  INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_sms,extra_staff_monthly_gel)
  VALUES(s.id,'business','ბიზნესი','Business',69,1,7,500,9),(s.id,'multi_branch','მრავალი ფილიალი','Multi-branch',129,999,50,1500,9)
  ON CONFLICT(salon_id,code) DO NOTHING;
  SELECT id INTO p FROM public.plans WHERE salon_id=s.id AND code='business';
  INSERT INTO public.subscriptions(salon_id,plan_id,plan_code,status,trial_ends_at)
   VALUES(s.id,p,'business',CASE WHEN s.subscription_status='active' THEN 'active' ELSE 'trialing' END,COALESCE(s.trial_ends_at,now()+interval '14 days'))
   ON CONFLICT(salon_id) DO NOTHING;
  INSERT INTO public.sms_wallet(salon_id,included_quota) VALUES(s.id,500) ON CONFLICT(salon_id) DO NOTHING;
  INSERT INTO public.salon_branches(salon_id,name) SELECT s.id,'Main branch' WHERE NOT EXISTS(SELECT 1 FROM public.salon_branches WHERE salon_id=s.id);
 END LOOP;
END $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['plans','subscriptions','invoices','invoice_lines','payments','sms_wallet','salon_branches'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id))',t||'_member_read',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.complete_fake_payment(p_salon_id uuid,p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.invoices%ROWTYPE; ln record; v_plan uuid;
BEGIN
 SELECT * INTO i FROM public.invoices WHERE id=p_invoice_id AND salon_id=p_salon_id FOR UPDATE;
 IF NOT FOUND OR i.status<>'open' THEN RAISE EXCEPTION 'Invoice is not payable' USING ERRCODE='22023'; END IF;
 UPDATE public.invoices SET status='paid',paid_at=now() WHERE id=i.id;
 INSERT INTO public.payments(salon_id,invoice_id,provider,provider_payment_id,status,amount_gel,idempotency_key,paid_at)
 VALUES(i.salon_id,i.id,'fake','fake_'||i.id,'paid',i.total_gel,'fake_'||i.id,now()) ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
 IF i.kind='plan' AND i.plan_code IS NOT NULL THEN
  SELECT id INTO v_plan FROM public.plans WHERE salon_id=i.salon_id AND code=i.plan_code;
  UPDATE public.subscriptions SET plan_id=v_plan,plan_code=i.plan_code,status='active',prepaid_months=i.prepaid_months,
    current_period_start=now(),current_period_end=now()+make_interval(months=>i.prepaid_months),grace_ends_at=NULL,trial_ends_at=now()
   WHERE salon_id=i.salon_id;
  UPDATE public.salons SET subscription_tier=CASE WHEN i.plan_code='business' THEN 'professional' ELSE 'enterprise' END,
    subscription_status='active',trial_ends_at=now(),subscription_period_ends_at=now()+make_interval(months=>i.prepaid_months),billing_past_due_at=NULL WHERE id=i.salon_id;
  UPDATE public.sms_wallet SET included_quota=CASE WHEN i.plan_code='business' THEN 500 ELSE 1500 END WHERE salon_id=i.salon_id;
 ELSIF i.kind='sms_pack' THEN
  SELECT quantity INTO ln FROM public.invoice_lines WHERE invoice_id=i.id AND line_type='sms_pack' LIMIT 1;
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance+COALESCE(ln.quantity,0)::integer WHERE salon_id=i.salon_id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.complete_fake_payment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_fake_payment(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_salon_reports(p_salon_id uuid,p_start_date date,p_end_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_result jsonb;
BEGIN
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date>p_start_date+366 THEN RAISE EXCEPTION 'Invalid report date range' USING ERRCODE='22023'; END IF;
 IF NOT public.user_has_salon_access(p_salon_id) THEN RAISE EXCEPTION 'Salon access required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('revenue_gel',COALESCE(sum(a.price_snapshot) FILTER(WHERE a.status='completed'),0),
 'booking_count',count(*) FILTER(WHERE a.status<>'canceled'),'completed_count',count(*) FILTER(WHERE a.status='completed'),
 'no_show_count',count(*) FILTER(WHERE a.status IN('no_show','missed')),
 'no_show_rate',CASE WHEN count(*) FILTER(WHERE a.status<>'canceled')=0 THEN 0::numeric ELSE round(100.0*count(*) FILTER(WHERE a.status IN('no_show','missed'))/count(*) FILTER(WHERE a.status<>'canceled'),1) END,
 'returning_clients',(SELECT count(*) FROM(SELECT client_id FROM public.appointments WHERE salon_id=p_salon_id AND treatment_date BETWEEN p_start_date AND p_end_date AND status='completed' GROUP BY client_id HAVING count(*)>1) repeated),
 'by_staff',COALESCE((SELECT jsonb_agg(jsonb_build_object('staff_id',q.staff_id,'staff_name',q.staff_name,'booking_count',q.booking_count,'revenue_gel',q.revenue_gel) ORDER BY q.booking_count DESC) FROM(SELECT st.id staff_id,COALESCE(st.full_name,'Unassigned') staff_name,count(a2.id) FILTER(WHERE a2.status<>'canceled') booking_count,COALESCE(sum(a2.price_snapshot) FILTER(WHERE a2.status='completed'),0) revenue_gel FROM public.appointments a2 LEFT JOIN public.staff st ON st.id=a2.staff_id AND st.salon_id=a2.salon_id WHERE a2.salon_id=p_salon_id AND a2.treatment_date BETWEEN p_start_date AND p_end_date GROUP BY st.id,st.full_name) q),'[]'::jsonb),
 'top_services',COALESCE((SELECT jsonb_agg(jsonb_build_object('service_id',q.service_id,'service_name',q.service_name,'booking_count',q.booking_count,'revenue_gel',q.revenue_gel) ORDER BY q.booking_count DESC) FROM(SELECT a3.service_id,COALESCE(a3.service_name,'Service') service_name,count(*) booking_count,COALESCE(sum(a3.price_snapshot) FILTER(WHERE a3.status='completed'),0) revenue_gel FROM public.appointments a3 WHERE a3.salon_id=p_salon_id AND a3.treatment_date BETWEEN p_start_date AND p_end_date AND a3.status<>'canceled' GROUP BY a3.service_id,a3.service_name ORDER BY count(*) DESC LIMIT 10) q),'[]'::jsonb)) INTO v_result FROM public.appointments a WHERE a.salon_id=p_salon_id AND a.treatment_date BETWEEN p_start_date AND p_end_date;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_salon_reports(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_salon_reports(uuid,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.import_salon_clients(p_salon_id uuid,p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_inserted integer; BEGIN
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>500 THEN RAISE EXCEPTION 'Import must contain at most 500 rows' USING ERRCODE='22023'; END IF;
 INSERT INTO public.clients(salon_id,full_name,email,phone,notes,tags,email_consent,sms_consent,unsubscribed_at,sms_unsubscribed_at)
 SELECT p_salon_id,trim(r.full_name),NULLIF(lower(trim(r.email)),''),public.normalize_georgian_phone(r.phone),NULLIF(trim(r.notes),''),COALESCE(r.tags,'{}'::text[]),false,false,now(),now()
 FROM jsonb_to_recordset(p_rows) AS r(full_name text,email text,phone text,notes text,tags text[]) WHERE length(trim(r.full_name))>=2 AND public.normalize_georgian_phone(r.phone) IS NOT NULL
 ON CONFLICT(salon_id,normalized_phone) WHERE normalized_phone IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT; RETURN v_inserted; END; $$;
REVOKE ALL ON FUNCTION public.import_salon_clients(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_salon_clients(uuid,jsonb) TO service_role;

-- Plan payment grace and explicit trial gating; never delete salon data automatically.
UPDATE public.subscriptions SET grace_ends_at=now()+interval '7 days' WHERE status='past_due' AND grace_ends_at IS NULL;

CREATE TABLE public.payment_provider_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 provider text NOT NULL, provider_event_id text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz, status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','failed')),
 UNIQUE(provider,provider_event_id));
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_provider_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.payment_provider_events TO service_role;

