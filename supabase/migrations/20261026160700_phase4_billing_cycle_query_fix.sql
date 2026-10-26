CREATE OR REPLACE FUNCTION public.process_billing_cycle()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE w record; v_period timestamptz; v_invoice uuid; v_extra integer; v_sms integer; v_total numeric; v_count integer:=0;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 v_period:=date_trunc('month',now());
 FOR w IN SELECT sw.*,sub.plan_code,pl.base_monthly_gel,pl.extra_staff_monthly_gel,pl.sms_overage_rate_gel,sub.id subscription_id,sub.prepaid_months,sub.current_period_end
  FROM public.sms_wallet sw JOIN public.subscriptions sub ON sub.salon_id=sw.salon_id JOIN public.plans pl ON pl.salon_id=sw.salon_id AND pl.code=sub.plan_code
 LOOP
  IF w.period_start<v_period THEN
   SELECT GREATEST((SELECT count(*)::integer FROM public.staff st WHERE st.salon_id=w.salon_id AND st.is_active)-pl.staff_limit,0)::integer INTO v_extra FROM public.plans pl WHERE pl.salon_id=w.salon_id AND pl.code=w.plan_code;
   v_sms:=w.overage_count;
   v_total:=v_extra*w.extra_staff_monthly_gel+v_sms*w.sms_overage_rate_gel;
   IF v_total>0 THEN
    INSERT INTO public.invoices(salon_id,subscription_id,kind,status,period_start,period_end,subtotal_gel,total_gel,idempotency_key,due_at)
     VALUES(w.salon_id,w.subscription_id,'usage','open',w.period_start,v_period,v_total,v_total,'usage:'||w.salon_id||':'||to_char(w.period_start,'YYYY-MM'),now()+interval '7 days')
     ON CONFLICT(salon_id,idempotency_key) DO NOTHING RETURNING id INTO v_invoice;
    IF v_invoice IS NOT NULL AND v_extra>0 THEN INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel) VALUES(w.salon_id,v_invoice,'extra_staff','Additional active staff',v_extra,w.extra_staff_monthly_gel,v_extra*w.extra_staff_monthly_gel); END IF;
    IF v_invoice IS NOT NULL AND v_sms>0 THEN INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel) VALUES(w.salon_id,v_invoice,'sms_overage','SMS overage',v_sms,w.sms_overage_rate_gel,v_sms*w.sms_overage_rate_gel); END IF;
    v_count:=v_count+1; v_invoice:=NULL;
   END IF;
   IF w.current_period_end IS NOT NULL AND w.current_period_end<=now() AND EXISTS(SELECT 1 FROM public.subscriptions WHERE salon_id=w.salon_id AND status='active') THEN
    v_total:=w.base_monthly_gel*w.prepaid_months*(1-CASE w.prepaid_months WHEN 3 THEN 0.05 WHEN 6 THEN 0.10 WHEN 12 THEN 0.15 ELSE 0 END);
    INSERT INTO public.invoices(salon_id,subscription_id,kind,status,plan_code,prepaid_months,period_start,period_end,subtotal_gel,total_gel,idempotency_key,due_at)
     VALUES(w.salon_id,w.subscription_id,'plan','open',w.plan_code,w.prepaid_months,w.current_period_end,w.current_period_end+make_interval(months=>w.prepaid_months),v_total,v_total,'plan:'||w.salon_id||':'||to_char(w.current_period_end,'YYYY-MM-DD'),now()+interval '7 days')
     ON CONFLICT(salon_id,idempotency_key) DO NOTHING RETURNING id INTO v_invoice;
    IF v_invoice IS NOT NULL THEN
     INSERT INTO public.invoice_lines(salon_id,invoice_id,line_type,description,quantity,unit_price_gel,total_gel) VALUES(w.salon_id,v_invoice,'plan',w.plan_code||' subscription',w.prepaid_months,w.base_monthly_gel,v_total);
     UPDATE public.subscriptions SET status='past_due',grace_ends_at=now()+interval '14 days',updated_at=now() WHERE salon_id=w.salon_id;
     v_count:=v_count+1; v_invoice:=NULL;
    END IF;
   END IF;   UPDATE public.sms_wallet SET period_start=v_period,used_this_period=0,overage_count=0,sms_paused=false,updated_at=now() WHERE salon_id=w.salon_id;
  END IF;
 END LOOP;
 UPDATE public.sms_wallet sw SET sms_paused=true FROM public.invoices i WHERE i.salon_id=sw.salon_id AND i.kind='usage' AND i.status='open' AND i.due_at<now()-interval '7 days';
 UPDATE public.subscriptions sub SET status='past_due',grace_ends_at=now(),updated_at=now() FROM public.invoices i
  WHERE i.salon_id=sub.salon_id AND i.kind='plan' AND i.status='open' AND i.due_at<now()-interval '7 days' AND sub.status<>'past_due';
 UPDATE public.salons s SET subscription_status='past_due',billing_past_due_at=now() FROM public.subscriptions sub WHERE sub.salon_id=s.id AND sub.status='past_due' AND sub.grace_ends_at<=now() AND s.subscription_status<>'past_due';
 UPDATE public.subscriptions SET status='canceled',updated_at=now() WHERE cancel_at_period_end AND current_period_end<=now();
 UPDATE public.salons s SET subscription_status='canceled' FROM public.subscriptions sub WHERE sub.salon_id=s.id AND sub.status='canceled';
 RETURN jsonb_build_object('usage_invoices_created',v_count,'processed_at',now());
END; $$;
REVOKE ALL ON FUNCTION public.process_billing_cycle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_billing_cycle() TO service_role;




