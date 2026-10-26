-- Trial sends email only. Notification jobs remain queued/suppressed for SMS until paid activation.
CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit integer DEFAULT 25)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied: claim_due_notifications is service role only' USING ERRCODE='42501'; END IF;
 UPDATE public.notification_log n SET status='suppressed',error='Salon plan is inactive',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status NOT IN ('active','trialing') AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='Salon trial has expired',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND s.trial_ends_at<=now() AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='SMS is unavailable during trial',updated_at=now() FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND n.channel='sms' AND n.status IN ('pending','retry');
 UPDATE public.notification_log n SET status='suppressed',error='Notifications disabled by salon',updated_at=now() FROM public.salon_settings ss
  WHERE ss.salon_id=n.salon_id AND n.status IN ('pending','retry') AND ((n.message_type IN ('reminder_24h','reminder_2h','recall','no_show_followup') AND NOT ss.auto_reminders_enabled) OR (n.channel='email' AND n.message_type='booking_confirmation' AND NOT ss.send_booking_confirmation_email));
 UPDATE public.notification_log n SET status='suppressed',error='Client is archived or has withdrawn consent',updated_at=now() FROM public.clients c
  WHERE c.id=n.client_id AND n.status IN ('pending','retry') AND (c.is_archived OR (n.channel='sms' AND (NOT c.sms_consent OR c.sms_unsubscribed_at IS NOT NULL)) OR (n.channel='email' AND (NOT c.email_consent OR c.unsubscribed_at IS NOT NULL)));
 UPDATE public.notification_log SET status='retry',locked_at=NULL,next_attempt_at=now()+interval '15 minutes',error='Recovered after a worker interruption',updated_at=now() WHERE status='processing' AND locked_at<now()-interval '15 minutes';
 RETURN QUERY WITH claimed AS (
  SELECT n.id FROM public.notification_log n JOIN public.salons s ON s.id=n.salon_id
  WHERE n.status IN ('pending','retry') AND n.scheduled_at<=now() AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=now())
   AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))
   AND (n.channel<>'sms' OR s.subscription_status='active')
  ORDER BY n.scheduled_at,n.created_at LIMIT GREATEST(1,LEAST(COALESCE(p_limit,25),100)) FOR UPDATE OF n SKIP LOCKED
 ), updated AS (UPDATE public.notification_log n SET status='processing',attempt_count=n.attempt_count+1,locked_at=now(),updated_at=now() FROM claimed c WHERE n.id=c.id RETURNING n.*)
 SELECT jsonb_build_object('id',u.id,'salon_id',u.salon_id,'client_id',u.client_id,'appointment_id',u.appointment_id,'message_type',u.message_type,'channel',u.channel,'language',u.language,'recipient',u.recipient,'subject',u.subject,'body',u.body,'attempt_count',u.attempt_count,'max_attempts',u.max_attempts,'idempotency_key',u.idempotency_key,'timezone',ss.timezone,'salon_name',ss.salon_name,'reply_to',ss.verified_sender_email,'unsubscribe_token',c.unsubscribe_token,'dry_run_mode',ss.dry_run_mode,'client_allowed',CASE WHEN u.channel='sms' THEN c.sms_consent AND c.sms_unsubscribed_at IS NULL ELSE c.email_consent AND c.unsubscribed_at IS NULL END,'client_archived',c.is_archived)
 FROM updated u JOIN public.clients c ON c.id=u.client_id JOIN public.salon_settings ss ON ss.salon_id=u.salon_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_due_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(integer) TO service_role;

-- Expired trials and past-due subscriptions are read-only across salon data tables.
CREATE OR REPLACE FUNCTION public.enforce_salon_subscription_writable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_salon uuid; v_status text; v_trial_end timestamptz; v_grace_end timestamptz;
BEGIN
 v_salon:=CASE WHEN TG_OP='DELETE' THEN OLD.salon_id ELSE NEW.salon_id END;
 SELECT status,trial_ends_at,grace_ends_at INTO v_status,v_trial_end,v_grace_end FROM public.subscriptions WHERE salon_id=v_salon;
 IF v_status='active' OR (v_status='trialing' AND v_trial_end>now()) OR (v_status='past_due' AND v_grace_end>now()) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Salon subscription is read-only' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION public.enforce_salon_subscription_writable() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['salon_settings','clients','staff','services','staff_services','staff_working_hours','time_off','resources','service_resources','salon_branches'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS enforce_subscription_writable ON public.%I',t);
  EXECUTE format('CREATE TRIGGER enforce_subscription_writable BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_salon_subscription_writable()',t);
 END LOOP;
END $$;

