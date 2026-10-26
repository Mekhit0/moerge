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
  UPDATE public.sms_wallet SET included_quota=CASE WHEN i.plan_code='business' THEN 500 ELSE 1500 END,sms_paused=false WHERE salon_id=i.salon_id;
 ELSIF i.kind='sms_pack' THEN
  SELECT quantity INTO ln FROM public.invoice_lines WHERE invoice_id=i.id AND line_type='sms_pack' LIMIT 1;
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance+COALESCE(ln.quantity,0)::integer WHERE salon_id=i.salon_id;
 ELSIF i.kind='usage' THEN
  UPDATE public.sms_wallet SET sms_paused=false WHERE salon_id=i.salon_id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.complete_fake_payment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_fake_payment(uuid,uuid) TO service_role;
