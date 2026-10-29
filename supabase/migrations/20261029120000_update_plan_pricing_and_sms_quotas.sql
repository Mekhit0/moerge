UPDATE public.plans
SET base_monthly_gel = CASE code
      WHEN 'business' THEN 60
      WHEN 'multi_branch' THEN 150
      ELSE base_monthly_gel
    END,
    included_sms = CASE code
      WHEN 'business' THEN 1000
      WHEN 'multi_branch' THEN 3000
      ELSE included_sms
    END
WHERE code IN ('business', 'multi_branch');

UPDATE public.sms_wallet wallet
SET included_quota = CASE subscription.plan_code
      WHEN 'business' THEN 1000
      WHEN 'multi_branch' THEN 3000
      ELSE wallet.included_quota
    END
FROM public.subscriptions subscription
WHERE wallet.salon_id = subscription.salon_id
  AND subscription.status = 'active'
  AND subscription.plan_code IN ('business', 'multi_branch');

CREATE OR REPLACE FUNCTION public.initialize_salon_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_plan uuid;
BEGIN
 INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_staff,included_sms,extra_staff_monthly_gel)
 VALUES(NEW.id,'business','ბიზნესი','Business',60,1,50,7,1000,9),(NEW.id,'multi_branch','მრავალი ფილიალი','Multi-branch',150,999,50,50,3000,9)
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
  UPDATE public.subscriptions SET plan_id=v_plan,plan_code=i.plan_code,status='active',prepaid_months=i.prepaid_months,current_period_start=now(),current_period_end=now()+make_interval(months=>i.prepaid_months),grace_ends_at=NULL,trial_ends_at=now() WHERE salon_id=i.salon_id;
  UPDATE public.salons SET subscription_tier=CASE WHEN i.plan_code='business' THEN 'professional' ELSE 'enterprise' END,subscription_status='active',trial_ends_at=now(),subscription_period_ends_at=now()+make_interval(months=>i.prepaid_months),billing_past_due_at=NULL WHERE id=i.salon_id;
  UPDATE public.sms_wallet SET included_quota=CASE i.plan_code WHEN 'business' THEN 1000 WHEN 'multi_branch' THEN 3000 ELSE included_quota END,sms_paused=false WHERE salon_id=i.salon_id;
 ELSIF i.kind='sms_pack' THEN
  SELECT quantity INTO ln FROM public.invoice_lines WHERE invoice_id=i.id AND line_type='sms_pack' LIMIT 1;
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance+COALESCE(ln.quantity,0)::integer WHERE salon_id=i.salon_id;
 ELSIF i.kind='usage' THEN
  UPDATE public.sms_wallet SET sms_paused=false WHERE salon_id=i.salon_id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.complete_fake_payment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_fake_payment(uuid,uuid) TO service_role;
