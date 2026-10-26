ALTER TABLE public.sms_wallet ADD COLUMN sms_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_log ADD COLUMN sms_quota_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_reservation_type text CHECK (sms_reservation_type IS NULL OR sms_reservation_type IN ('included','prepaid','overage'));
ALTER TABLE public.plans ADD COLUMN sms_overage_rate_gel numeric(10,4) NOT NULL DEFAULT 0.05,
  ADD COLUMN discount_3mo smallint NOT NULL DEFAULT 5, ADD COLUMN discount_6mo smallint NOT NULL DEFAULT 10,
  ADD COLUMN discount_12mo smallint NOT NULL DEFAULT 15;

CREATE OR REPLACE FUNCTION public.reserve_sms_notification(p_notification_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n public.notification_log%ROWTYPE; w public.sms_wallet%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 SELECT * INTO n FROM public.notification_log WHERE id=p_notification_id FOR UPDATE;
 IF NOT FOUND OR n.channel<>'sms' THEN RETURN true; END IF;
 IF n.sms_quota_reserved THEN RETURN true; END IF;
 SELECT * INTO w FROM public.sms_wallet WHERE salon_id=n.salon_id FOR UPDATE;
 IF NOT FOUND OR w.sms_paused THEN RETURN false; END IF;
 IF w.used_this_period<w.included_quota THEN
  UPDATE public.sms_wallet SET used_this_period=used_this_period+1,updated_at=now() WHERE salon_id=n.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=true,sms_reservation_type='included' WHERE id=n.id;
  RETURN true;
 ELSIF w.prepaid_balance>0 THEN
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance-1,updated_at=now() WHERE salon_id=n.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=true,sms_reservation_type='prepaid' WHERE id=n.id;
  RETURN true;
 ELSIF (w.overage_count+1)*0.05<=w.overage_cap_gel THEN
  UPDATE public.sms_wallet SET overage_count=overage_count+1,updated_at=now() WHERE salon_id=n.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=true,sms_reservation_type='overage' WHERE id=n.id;
  RETURN true;
 END IF;
 RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_sms_notification(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reserve_sms_notification(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit integer DEFAULT 25)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied: claim_due_notifications is service role only' USING ERRCODE='42501'; END IF;
 UPDATE public.notification_log n SET status='suppressed',error='Salon plan is inactive',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status NOT IN ('active','trialing','past_due') AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='Salon trial has expired',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND s.trial_ends_at<=now() AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='SMS is unavailable during trial',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND n.channel='sms' AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='Notifications disabled by salon',updated_at=now() FROM public.salon_settings ss
  WHERE ss.salon_id=n.salon_id AND n.status IN ('pending','retry') AND ((n.message_type IN ('reminder_24h','reminder_2h','recall','no_show_followup') AND NOT ss.auto_reminders_enabled) OR (n.channel='email' AND n.message_type='booking_confirmation' AND NOT ss.send_booking_confirmation_email));
 UPDATE public.notification_log n SET status='suppressed',error='Client is archived or has withdrawn consent',updated_at=now() FROM public.clients c
  WHERE c.id=n.client_id AND n.status IN ('pending','retry') AND (c.is_archived OR (n.channel='sms' AND (NOT c.sms_consent OR c.sms_unsubscribed_at IS NOT NULL)) OR (n.channel='email' AND (NOT c.email_consent OR c.unsubscribed_at IS NOT NULL)));
 UPDATE public.notification_log SET status='retry',locked_at=NULL,next_attempt_at=now()+interval '15 minutes',error='Recovered after a worker interruption',updated_at=now() WHERE status='processing' AND locked_at<now()-interval '15 minutes';
 RETURN QUERY WITH candidates AS MATERIALIZED (
  SELECT n.id,n.channel,CASE WHEN n.channel='sms' THEN public.reserve_sms_notification(n.id) ELSE true END AS reserved
  FROM public.notification_log n JOIN public.salons s ON s.id=n.salon_id
  LEFT JOIN public.subscriptions sub ON sub.salon_id=s.id
  WHERE n.status IN ('pending','retry') AND n.scheduled_at<=now() AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=now())
   AND ((s.subscription_status='active') OR (s.subscription_status='trialing' AND s.trial_ends_at>now()) OR
     (s.subscription_status='past_due' AND sub.grace_ends_at>now()))
   AND (n.channel<>'sms' OR (s.subscription_status='active' AND EXISTS(SELECT 1 FROM public.sms_wallet w WHERE w.salon_id=s.id AND NOT w.sms_paused)))
  ORDER BY n.scheduled_at,n.created_at LIMIT GREATEST(1,LEAST(COALESCE(p_limit,25),100)) FOR UPDATE OF n SKIP LOCKED
 ), updated AS (
  UPDATE public.notification_log n SET status='processing',attempt_count=n.attempt_count+1,locked_at=now(),updated_at=now()
  FROM candidates c WHERE n.id=c.id AND c.reserved RETURNING n.*
 )
 SELECT jsonb_build_object('id',u.id,'salon_id',u.salon_id,'client_id',u.client_id,'appointment_id',u.appointment_id,'message_type',u.message_type,'channel',u.channel,'language',u.language,'recipient',u.recipient,'subject',u.subject,'body',u.body,'attempt_count',u.attempt_count,'max_attempts',u.max_attempts,'idempotency_key',u.idempotency_key,'timezone',ss.timezone,'salon_name',ss.salon_name,'reply_to',ss.verified_sender_email,'unsubscribe_token',c.unsubscribe_token,'dry_run_mode',ss.dry_run_mode,'client_allowed',CASE WHEN u.channel='sms' THEN c.sms_consent AND c.sms_unsubscribed_at IS NULL ELSE c.email_consent AND c.unsubscribed_at IS NULL END,'client_archived',c.is_archived)
 FROM updated u JOIN public.clients c ON c.id=u.client_id JOIN public.salon_settings ss ON ss.salon_id=u.salon_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_due_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.record_notification_result(p_id uuid,p_status text,p_provider_message_id text DEFAULT NULL,p_cost numeric DEFAULT NULL,p_error text DEFAULT NULL,p_next_attempt_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_row public.notification_log%ROWTYPE; v_final text;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied: record_notification_result is service role only' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM public.notification_log WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'processing' THEN RAISE EXCEPTION 'Notification job is not processing'; END IF;
 v_final:=CASE WHEN p_status='retry' AND v_row.attempt_count>=v_row.max_attempts THEN 'failed' ELSE p_status END;
 UPDATE public.notification_log SET status=v_final,provider_message_id=COALESCE(p_provider_message_id,provider_message_id),cost=COALESCE(p_cost,cost),error=p_error,
  next_attempt_at=CASE WHEN v_final='retry' THEN p_next_attempt_at ELSE NULL END,sent_at=CASE WHEN v_final IN ('sent','delivered') THEN now() ELSE sent_at END,
  locked_at=NULL,updated_at=now() WHERE id=p_id AND salon_id=v_row.salon_id;
 IF v_row.channel='sms' AND v_row.sms_quota_reserved AND v_final IN ('failed','suppressed') THEN
  UPDATE public.sms_wallet SET prepaid_balance=prepaid_balance+CASE WHEN v_row.sms_reservation_type='prepaid' THEN 1 ELSE 0 END,
    used_this_period=GREATEST(0,used_this_period-CASE WHEN v_row.sms_reservation_type='included' THEN 1 ELSE 0 END),
    overage_count=GREATEST(0,overage_count-CASE WHEN v_row.sms_reservation_type='overage' THEN 1 ELSE 0 END),updated_at=now() WHERE salon_id=v_row.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=false,sms_reservation_type=NULL WHERE id=v_row.id;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) TO service_role;

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



