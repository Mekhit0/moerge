-- Paid plans from 1 December 2026, as published on moarge.com/pricing.
--
-- Plans (one row per salon and plan, as before):
--   solo          19 ₾ a month, 1 specialist, 100 SMS a month
--   business      59 ₾ a month, 10 specialists included, +9 ₾ for each extra up to 50, 1000 SMS
--   multi_branch 149 ₾ a month, not sold yet
-- Paying ahead: 6 months -10%, 12 months -20%. The 3-month option is gone.
--
-- Trials:
--   Salons that sign up before 1 December (Tbilisi) keep the 30-day pilot trial; from 1 December, 14 days.
--   Every salon still on a trial now keeps it until the end of 15 December (Tbilisi), 14 days after launch.
--   SMS stays off during trials, as before.
--
-- extend_trials() lets the platform owner push every running trial to a later date in one step, for
-- example if card payments are not live yet. It never shortens a trial.

-- 1. Solo is a plan code everywhere a plan code is stored.
ALTER TABLE public.plans DROP CONSTRAINT plans_code_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_code_check CHECK (code IN ('solo','business','multi_branch'));
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_code_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_code_check CHECK (plan_code IN ('solo','business','multi_branch'));
ALTER TABLE public.invoices DROP CONSTRAINT invoices_plan_code_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_plan_code_check CHECK (plan_code IS NULL OR plan_code IN ('solo','business','multi_branch'));

-- 2. Current prices for every salon, and the new defaults.
ALTER TABLE public.plans ALTER COLUMN discount_3mo SET DEFAULT 0, ALTER COLUMN discount_12mo SET DEFAULT 20,
  ALTER COLUMN included_staff SET DEFAULT 10;

INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_staff,included_sms,extra_staff_monthly_gel,discount_3mo,discount_6mo,discount_12mo)
SELECT s.id,'solo','სოლო','Solo',19,1,1,1,100,0,0,10,20 FROM public.salons s
ON CONFLICT (salon_id,code) DO NOTHING;

UPDATE public.plans SET name_ka='სოლო', name_en='Solo', base_monthly_gel=19, branch_limit=1, staff_limit=1, included_staff=1,
  included_sms=100, extra_staff_monthly_gel=0, discount_3mo=0, discount_6mo=10, discount_12mo=20
WHERE code='solo';
UPDATE public.plans SET base_monthly_gel=59, branch_limit=1, staff_limit=50, included_staff=10, included_sms=1000,
  extra_staff_monthly_gel=9, discount_3mo=0, discount_6mo=10, discount_12mo=20
WHERE code='business';
UPDATE public.plans SET base_monthly_gel=149, discount_3mo=0, discount_6mo=10, discount_12mo=20
WHERE code='multi_branch';

-- New salons get all three plan rows; they start on a Business trial (up to 10 specialists while trying).
CREATE OR REPLACE FUNCTION public.initialize_salon_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_plan uuid;
BEGIN
 INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_staff,included_sms,extra_staff_monthly_gel,discount_3mo,discount_6mo,discount_12mo)
 VALUES(NEW.id,'solo','სოლო','Solo',19,1,1,1,100,0,0,10,20),
       (NEW.id,'business','ბიზნესი','Business',59,1,50,10,1000,9,0,10,20),
       (NEW.id,'multi_branch','მრავალი ფილიალი','Multi-branch',149,3,50,50,3000,9,0,10,20)
 ON CONFLICT(salon_id,code) DO NOTHING;
 SELECT id INTO v_plan FROM public.plans WHERE salon_id=NEW.id AND code='business';
 INSERT INTO public.subscriptions(salon_id,plan_id,plan_code,status,trial_ends_at)
 VALUES(NEW.id,v_plan,'business','trialing',COALESCE(NEW.trial_ends_at,now()+interval '14 days'))
 ON CONFLICT(salon_id) DO NOTHING;
 INSERT INTO public.sms_wallet(salon_id,included_quota) VALUES(NEW.id,0) ON CONFLICT(salon_id) DO NOTHING;
 INSERT INTO public.salon_branches(salon_id,name) VALUES(NEW.id,'Main branch') ON CONFLICT(salon_id,name) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.initialize_salon_billing() FROM PUBLIC,anon,authenticated,service_role;

-- 3. Trial length: 30 days before 1 December, 14 days from then on.
CREATE OR REPLACE FUNCTION public.set_pilot_trial_length()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF NEW.subscription_status = 'trialing' THEN
  NEW.trial_ends_at := GREATEST(COALESCE(NEW.trial_ends_at, now()),
    now() + CASE WHEN now() < timestamptz '2026-12-01 00:00:00+04' THEN interval '30 days' ELSE interval '14 days' END);
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_pilot_trial_length() FROM PUBLIC,anon,authenticated,service_role;

-- Running trials last at least until the end of 15 December, Tbilisi time.
UPDATE public.salons SET trial_ends_at = timestamptz '2026-12-16 00:00:00+04'
WHERE subscription_status = 'trialing' AND (trial_ends_at IS NULL OR trial_ends_at < timestamptz '2026-12-16 00:00:00+04');
UPDATE public.subscriptions SET trial_ends_at = timestamptz '2026-12-16 00:00:00+04', updated_at = now()
WHERE status = 'trialing' AND trial_ends_at < timestamptz '2026-12-16 00:00:00+04';

-- 4. Paying sets the plan's own SMS allowance and tier.
CREATE OR REPLACE FUNCTION public.complete_fake_payment(p_salon_id uuid, p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE i public.invoices%ROWTYPE; ln record; v_plan uuid; v_sms integer;
BEGIN
 SELECT * INTO i FROM public.invoices WHERE id=p_invoice_id AND salon_id=p_salon_id FOR UPDATE;
 IF NOT FOUND OR i.status<>'open' THEN RAISE EXCEPTION 'Invoice is not payable' USING ERRCODE='22023'; END IF;
 UPDATE public.invoices SET status='paid',paid_at=now() WHERE id=i.id;
 INSERT INTO public.payments(salon_id,invoice_id,provider,provider_payment_id,status,amount_gel,idempotency_key,paid_at)
 VALUES(i.salon_id,i.id,'fake','fake_'||i.id,'paid',i.total_gel,'fake_'||i.id,now()) ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
 IF i.kind='plan' AND i.plan_code IS NOT NULL THEN
  SELECT id,included_sms INTO v_plan,v_sms FROM public.plans WHERE salon_id=i.salon_id AND code=i.plan_code;
  UPDATE public.subscriptions SET plan_id=v_plan,plan_code=i.plan_code,status='active',prepaid_months=i.prepaid_months,current_period_start=now(),
    current_period_end=now()+make_interval(months=>i.prepaid_months),grace_ends_at=NULL,trial_ends_at=now() WHERE salon_id=i.salon_id;
  UPDATE public.salons SET subscription_tier=CASE i.plan_code WHEN 'solo' THEN 'starter' WHEN 'business' THEN 'professional' ELSE 'enterprise' END,
    subscription_status='active',trial_ends_at=now(),subscription_period_ends_at=now()+make_interval(months=>i.prepaid_months),billing_past_due_at=NULL
  WHERE id=i.salon_id;
  UPDATE public.sms_wallet SET included_quota=COALESCE(v_sms,included_quota),sms_paused=false WHERE salon_id=i.salon_id;
 ELSIF i.kind='sms_pack' THEN
  SELECT quantity INTO ln FROM public.invoice_lines WHERE invoice_id=i.id AND line_type='sms_pack' LIMIT 1;
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance+COALESCE(ln.quantity,0)::integer WHERE salon_id=i.salon_id;
 ELSIF i.kind='usage' THEN
  UPDATE public.sms_wallet SET sms_paused=false WHERE salon_id=i.salon_id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.complete_fake_payment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_fake_payment(uuid,uuid) TO service_role;

-- 5. Renewals use the plan's own discounts (6 months -10%, 12 months -20%).
CREATE OR REPLACE FUNCTION public.plan_period_total(p_base numeric, p_months integer, p_d3 integer, p_d6 integer, p_d12 integer)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
 SELECT round(p_base * p_months * (1 - CASE p_months WHEN 3 THEN p_d3 WHEN 6 THEN p_d6 WHEN 12 THEN p_d12 ELSE 0 END / 100.0), 2)
$$;
REVOKE ALL ON FUNCTION public.plan_period_total(numeric,integer,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.plan_period_total(numeric,integer,integer,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.process_billing_cycle()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
 w record;
 v_period timestamptz;
 v_invoice uuid;
 v_extra integer;
 v_extra_branches integer;
 v_sms integer;
 v_total numeric;
 v_count integer:=0;
BEGIN
 IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 v_period:=date_trunc('month',now());
 FOR w IN
  SELECT sw.*,sub.plan_code,sub.status AS subscription_status,pl.base_monthly_gel,
         pl.extra_staff_monthly_gel,pl.sms_overage_rate_gel,pl.included_staff,
         pl.branch_limit,pl.discount_3mo,pl.discount_6mo,pl.discount_12mo,
         sub.id subscription_id,sub.prepaid_months,sub.current_period_end
  FROM public.sms_wallet sw
  JOIN public.subscriptions sub ON sub.salon_id=sw.salon_id
  JOIN public.plans pl ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code
 LOOP
  IF w.period_start<v_period THEN
   -- Extra specialists and branches are only charged to paying salons, never during a trial.
   IF w.subscription_status='active' THEN
    SELECT GREATEST((SELECT count(*)::integer FROM public.staff st WHERE st.salon_id=w.salon_id AND st.is_active)-w.included_staff,0)::integer INTO v_extra;
    SELECT GREATEST((SELECT count(*)::integer FROM public.salon_branches br WHERE br.salon_id=w.salon_id AND br.is_active)-w.branch_limit,0)::integer INTO v_extra_branches;
   ELSE
    v_extra:=0; v_extra_branches:=0;
   END IF;
   v_sms:=w.overage_count;
   v_total:=v_extra*w.extra_staff_monthly_gel+v_extra_branches*40+v_sms*w.sms_overage_rate_gel;
   IF v_total>0 THEN
    INSERT INTO public.invoices(salon_id,subscription_id,kind,status,period_start,period_end,subtotal_gel,total_gel,idempotency_key,due_at)
     VALUES(w.salon_id,w.subscription_id,'usage','open',w.period_start,v_period,v_total,v_total,'usage:'||w.salon_id||':'||to_char(w.period_start,'YYYY-MM'),now()+interval '7 days')
     ON CONFLICT(salon_id,idempotency_key) DO NOTHING RETURNING id INTO v_invoice;
    IF v_invoice IS NOT NULL AND v_extra>0 THEN
     INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel)
     VALUES(w.salon_id,v_invoice,'extra_staff','Additional active staff',v_extra,w.extra_staff_monthly_gel,v_extra*w.extra_staff_monthly_gel);
    END IF;
    IF v_invoice IS NOT NULL AND v_extra_branches>0 THEN
     INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel)
     VALUES(w.salon_id,v_invoice,'extra_branch','Additional active branch',v_extra_branches,40,v_extra_branches*40);
    END IF;
    IF v_invoice IS NOT NULL AND v_sms>0 THEN
     INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel)
     VALUES(w.salon_id,v_invoice,'sms_overage','SMS overage',v_sms,w.sms_overage_rate_gel,v_sms*w.sms_overage_rate_gel);
    END IF;
    v_count:=v_count+1; v_invoice:=NULL;
   END IF;
   IF w.current_period_end IS NOT NULL AND w.current_period_end<=now()
      AND EXISTS(SELECT 1 FROM public.subscriptions WHERE salon_id=w.salon_id AND status='active') THEN
    v_total:=public.plan_period_total(w.base_monthly_gel,w.prepaid_months,w.discount_3mo,w.discount_6mo,w.discount_12mo);
    INSERT INTO public.invoices(salon_id,subscription_id,kind,status,plan_code,prepaid_months,period_start,period_end,subtotal_gel,total_gel,idempotency_key,due_at)
     VALUES(w.salon_id,w.subscription_id,'plan','open',w.plan_code,w.prepaid_months,w.current_period_end,w.current_period_end+make_interval(months=>w.prepaid_months),v_total,v_total,'plan:'||w.salon_id||':'||to_char(w.current_period_end,'YYYY-MM-DD'),now()+interval '7 days')
     ON CONFLICT(salon_id,idempotency_key) DO NOTHING RETURNING id INTO v_invoice;
    IF v_invoice IS NOT NULL THEN
     INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel)
      VALUES(w.salon_id,v_invoice,'plan',w.plan_code||' subscription',w.prepaid_months,w.base_monthly_gel,v_total);
     UPDATE public.subscriptions SET status='past_due',grace_ends_at=now()+interval '14 days',updated_at=now() WHERE salon_id=w.salon_id;
     v_count:=v_count+1; v_invoice:=NULL;
    END IF;
   END IF;
   UPDATE public.sms_wallet SET period_start=v_period,used_this_period=0,overage_count=0,sms_paused=false,updated_at=now() WHERE salon_id=w.salon_id;
  END IF;
 END LOOP;
 FOR w IN
  SELECT sub.salon_id,sub.id subscription_id,sub.plan_code,sub.prepaid_months,sub.current_period_end,
         pl.base_monthly_gel,pl.branch_limit,pl.discount_3mo,pl.discount_6mo,pl.discount_12mo
  FROM public.subscriptions sub JOIN public.plans pl ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code
  WHERE sub.status='active' AND sub.current_period_end<=now()
 LOOP
  v_total:=public.plan_period_total(w.base_monthly_gel,w.prepaid_months,w.discount_3mo,w.discount_6mo,w.discount_12mo);
  INSERT INTO public.invoices(salon_id,subscription_id,kind,status,plan_code,prepaid_months,period_start,period_end,subtotal_gel,total_gel,idempotency_key,due_at)
   VALUES(w.salon_id,w.subscription_id,'plan','open',w.plan_code,w.prepaid_months,w.current_period_end,w.current_period_end+make_interval(months=>w.prepaid_months),v_total,v_total,'plan:'||w.salon_id||':'||to_char(w.current_period_end,'YYYY-MM-DD'),now()+interval '7 days')
   ON CONFLICT(salon_id,idempotency_key) DO NOTHING RETURNING id INTO v_invoice;
  IF v_invoice IS NOT NULL THEN
   INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel)
    VALUES(w.salon_id,v_invoice,'plan',w.plan_code||' subscription',w.prepaid_months,w.base_monthly_gel,v_total);
   UPDATE public.subscriptions SET status='past_due',grace_ends_at=now()+interval '14 days',updated_at=now() WHERE salon_id=w.salon_id;
   v_count:=v_count+1; v_invoice:=NULL;
  END IF;
 END LOOP;
 UPDATE public.sms_wallet sw SET sms_paused=true FROM public.invoices i
  WHERE i.salon_id=sw.salon_id AND i.kind='usage' AND i.status='open' AND i.due_at<now()-interval '7 days';
 UPDATE public.subscriptions sub SET status='past_due',grace_ends_at=now(),updated_at=now() FROM public.invoices i
  WHERE i.salon_id=sub.salon_id AND i.kind='plan' AND i.status='open' AND i.due_at<now()-interval '7 days' AND sub.status<>'past_due';
 UPDATE public.salons s SET subscription_status='past_due',billing_past_due_at=now()
  FROM public.subscriptions sub WHERE sub.salon_id=s.id AND sub.status='past_due' AND sub.grace_ends_at<=now() AND s.subscription_status<>'past_due';
 UPDATE public.subscriptions SET status='canceled',updated_at=now() WHERE cancel_at_period_end AND current_period_end<=now();
 UPDATE public.salons s SET subscription_status='canceled' FROM public.subscriptions sub WHERE sub.salon_id=s.id AND sub.status='canceled';
 RETURN jsonb_build_object('usage_invoices_created',v_count,'processed_at',now());
END; $$;
REVOKE ALL ON FUNCTION public.process_billing_cycle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_billing_cycle() TO service_role;

-- 6. The safety switch: extend every running trial to a later date. Never shortens one.
CREATE OR REPLACE FUNCTION public.extend_trials(p_until timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
 IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 IF p_until IS NULL OR p_until <= now() OR p_until > now() + interval '90 days' THEN
  RAISE EXCEPTION 'The new end must be in the next 90 days' USING ERRCODE='22023';
 END IF;
 UPDATE public.subscriptions SET trial_ends_at=p_until, updated_at=now() WHERE status='trialing' AND trial_ends_at < p_until;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 UPDATE public.salons SET trial_ends_at=p_until WHERE subscription_status='trialing' AND (trial_ends_at IS NULL OR trial_ends_at < p_until);
 RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.extend_trials(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extend_trials(timestamptz) TO service_role;
