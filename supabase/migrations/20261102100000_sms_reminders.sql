-- SMS reminders through uBill.
--
-- * Salons choose which messages go by SMS: the day-before reminder (on by default), the two-hour
--   reminder and the booking confirmation (both off). Recall and no-show messages never go by SMS;
--   they are marketing and need their own consent first.
-- * SMS texts are short and carry the booking code instead of links, so most fit in one SMS.
-- * SMS are counted the way the provider bills them: 160 characters for plain Latin text, 70 for
--   Georgian (Unicode); longer messages are split into 153 or 67 character parts.
-- * Quota: the package's monthly SMS first, then bought SMS. No automatic extra charges: when both
--   run out the message is skipped and marked so.
-- * Delivery reports from uBill mark messages delivered or not delivered.
-- * A reminder whose visit has already started is never sent late.

-- Salon choices ----------------------------------------------------------------------------------
ALTER TABLE public.salon_settings
  ADD COLUMN sms_reminder_24h boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_reminder_2h boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_booking_confirmation boolean NOT NULL DEFAULT false;
GRANT SELECT (sms_reminder_24h, sms_reminder_2h, sms_booking_confirmation) ON public.salon_settings TO authenticated;

-- How many SMS parts a message costs and where they were taken from ----------------------------
ALTER TABLE public.notification_log
  ADD COLUMN sms_parts smallint CHECK (sms_parts IS NULL OR sms_parts BETWEEN 1 AND 20),
  ADD COLUMN sms_included_used integer NOT NULL DEFAULT 0 CHECK (sms_included_used >= 0),
  ADD COLUMN sms_prepaid_used integer NOT NULL DEFAULT 0 CHECK (sms_prepaid_used >= 0);
CREATE INDEX notification_log_sms_provider_idx ON public.notification_log(provider_message_id)
  WHERE channel = 'sms' AND provider_message_id IS NOT NULL;
CREATE INDEX notification_log_sms_reserved_idx ON public.notification_log(status) WHERE sms_quota_reserved;

-- Keep in sync with smsParts() in src/lib/sms.ts. Only a safe subset of plain characters counts as
-- the 160-character alphabet; anything else (Georgian letters included) is billed as Unicode.
CREATE OR REPLACE FUNCTION public.sms_segments(p_text text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE v_len integer;
BEGIN
  IF p_text IS NULL OR p_text = '' THEN RETURN 0; END IF;
  v_len := char_length(p_text);
  IF p_text ~ '^[A-Za-z0-9 @$_!"#%&''()*+,./:;<=>?\n\r-]*$' THEN
    RETURN CASE WHEN v_len <= 160 THEN 1 ELSE ceil(v_len / 153.0)::integer END;
  END IF;
  RETURN CASE WHEN v_len <= 70 THEN 1 ELSE ceil(v_len / 67.0)::integer END;
END; $$;
REVOKE ALL ON FUNCTION public.sms_segments(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_segments(text) TO service_role;

-- Short SMS texts ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_sms_template(p_message_type text, p_language text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE p_language
    WHEN 'ka' THEN CASE p_message_type
      WHEN 'booking_confirmation' THEN '{{salon_name}}: ჯავშანი {{date}} {{time}}. {{service_name}}. კოდი {{booking_code}}'
      WHEN 'reminder_24h' THEN '{{salon_name}}: ხვალ {{time}}-ზე გელოდებით. {{service_name}}. კოდი {{booking_code}}'
      WHEN 'reminder_2h' THEN '{{salon_name}}: დღეს {{time}}-ზე გელოდებით. {{service_name}}'
      WHEN 'cancel_confirmation' THEN '{{salon_name}}: {{date}} {{time}}-ის ჯავშანი გაუქმდა.'
      WHEN 'reschedule_confirmation' THEN '{{salon_name}}: ჯავშანი გადატანილია, {{date}} {{time}}. კოდი {{booking_code}}'
      WHEN 'recall' THEN '{{salon_name}}: დროა შემდეგი ვიზიტის. {{booking_link}}'
      ELSE '{{salon_name}}: ვერ გნახეთ. ახალი დრო: {{booking_link}}'
    END
    ELSE CASE p_message_type
      WHEN 'booking_confirmation' THEN '{{salon_name}}: booked for {{date}} {{time}}. {{service_name}}. Code {{booking_code}}'
      WHEN 'reminder_24h' THEN '{{salon_name}}: see you tomorrow at {{time}}. {{service_name}}. Code {{booking_code}}'
      WHEN 'reminder_2h' THEN '{{salon_name}}: see you today at {{time}}. {{service_name}}'
      WHEN 'cancel_confirmation' THEN '{{salon_name}}: your booking for {{date}} {{time}} is canceled.'
      WHEN 'reschedule_confirmation' THEN '{{salon_name}}: moved to {{date}} {{time}}. Code {{booking_code}}'
      WHEN 'recall' THEN '{{salon_name}}: time for your next visit. {{booking_link}}'
      ELSE '{{salon_name}}: we missed you. Pick a new time: {{booking_link}}'
    END
  END;
$$;
REVOKE ALL ON FUNCTION public.default_sms_template(text, text) FROM PUBLIC, anon, authenticated;

-- No SMS has ever been sent, so every salon gets the short texts.
UPDATE public.notification_templates
SET body_template = public.default_sms_template(message_type, language), updated_at = now()
WHERE channel = 'sms';

-- New salons: runs after trg_seed_notification_templates (triggers fire in name order).
CREATE OR REPLACE FUNCTION public.use_short_sms_templates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.notification_templates
  SET body_template = public.default_sms_template(message_type, language)
  WHERE salon_id = NEW.salon_id AND channel = 'sms';
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.use_short_sms_templates() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_short_sms_templates ON public.salon_settings;
CREATE TRIGGER trg_short_sms_templates AFTER INSERT ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION public.use_short_sms_templates();

-- Queueing: SMS only for the messages the salon switched on -----------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_appointment_notification(
  p_appointment_id uuid, p_message_type text, p_scheduled_at timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.notification_log(salon_id,client_id,appointment_id,message_type,channel,language,recipient,subject,body,scheduled_at,sms_parts)
  SELECT m.salon_id, m.client_id, m.appointment_id, p_message_type, m.channel, m.language, m.recipient, m.subject, m.body, p_scheduled_at,
    CASE WHEN m.channel = 'sms' THEN LEAST(20, GREATEST(1, public.sms_segments(m.body))) END
  FROM (
    SELECT a.salon_id, c.id AS client_id, a.id AS appointment_id, ch.channel,
      COALESCE(c.preferred_language,'ka') AS language,
      CASE WHEN ch.channel='sms' THEN c.normalized_phone ELSE c.normalized_email END AS recipient,
      tpl.subject_template AS subject,
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(tpl.body_template,
        '{{client_name}}',c.full_name),'{{salon_name}}',ss.salon_name),'{{service_name}}',COALESCE(s.name_ka,s.name_en,a.service_name,'ვიზიტი')),
        '{{local_start}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'YYYY-MM-DD HH24:MI')),
        '{{time}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'HH24:MI')),
        '{{date}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'DD.MM')),
        '{{booking_code}}',COALESCE(a.booking_code,'')),
        '{{manage_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/manage-booking?token=' || a.self_service_token::text),
        '{{booking_link}}',ss.booking_url),'{{salon_address}}',COALESCE(ss.salon_address,'')),
        '{{unsubscribe_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/unsubscribe?token=' || c.unsubscribe_token::text || '&channel=' || ch.channel) AS body
    FROM public.appointments a
    JOIN public.clients c ON c.id=a.client_id
    JOIN public.salon_settings ss ON ss.salon_id=a.salon_id
    LEFT JOIN public.services s ON s.id::text=a.service_id AND s.salon_id=a.salon_id
    CROSS JOIN (VALUES ('sms'),('email')) ch(channel)
    JOIN public.notification_templates tpl ON tpl.salon_id=a.salon_id AND tpl.message_type=p_message_type
      AND tpl.channel=ch.channel AND tpl.language=COALESCE(c.preferred_language,'ka') AND tpl.is_active
    WHERE a.id=p_appointment_id AND (
      (ch.channel='sms' AND c.sms_consent AND c.sms_unsubscribed_at IS NULL AND c.normalized_phone IS NOT NULL
        AND ((p_message_type='reminder_24h' AND ss.sms_reminder_24h)
          OR (p_message_type='reminder_2h' AND ss.sms_reminder_2h)
          OR (p_message_type='booking_confirmation' AND ss.sms_booking_confirmation)))
      OR (ch.channel='email' AND c.email_consent AND c.unsubscribed_at IS NULL AND c.email IS NOT NULL)
    )
  ) m
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_notification(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

-- Quota ------------------------------------------------------------------------------------------
-- Takes the message's parts from this month's package SMS first, then from bought SMS.
CREATE OR REPLACE FUNCTION public.reserve_sms_notification(p_notification_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n public.notification_log%ROWTYPE; w public.sms_wallet%ROWTYPE; v_parts integer; v_included integer; v_prepaid integer;
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
  SELECT * INTO n FROM public.notification_log WHERE id=p_notification_id FOR UPDATE;
  IF NOT FOUND OR n.channel<>'sms' OR n.sms_quota_reserved THEN RETURN true; END IF;
  v_parts := GREATEST(1, COALESCE(n.sms_parts, public.sms_segments(n.body)));
  SELECT * INTO w FROM public.sms_wallet WHERE salon_id=n.salon_id FOR UPDATE;
  IF NOT FOUND OR w.sms_paused THEN RETURN false; END IF;
  v_included := LEAST(v_parts, GREATEST(0, w.included_quota - w.used_this_period));
  v_prepaid := v_parts - v_included;
  IF v_prepaid > w.prepaid_balance THEN RETURN false; END IF;
  UPDATE public.sms_wallet SET used_this_period=used_this_period+v_included, prepaid_balance=prepaid_balance-v_prepaid, updated_at=now()
    WHERE salon_id=n.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=true, sms_parts=v_parts, sms_included_used=v_included, sms_prepaid_used=v_prepaid,
    sms_reservation_type=CASE WHEN v_prepaid>0 THEN 'prepaid' ELSE 'included' END
    WHERE id=n.id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_sms_notification(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Gives back the SMS held for a message that was never sent.
CREATE OR REPLACE FUNCTION public.release_sms_reservation(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE n public.notification_log%ROWTYPE;
BEGIN
  SELECT * INTO n FROM public.notification_log WHERE id=p_notification_id FOR UPDATE;
  IF NOT FOUND OR NOT n.sms_quota_reserved THEN RETURN; END IF;
  UPDATE public.sms_wallet SET used_this_period=GREATEST(0, used_this_period-n.sms_included_used),
    prepaid_balance=prepaid_balance+n.sms_prepaid_used, updated_at=now()
    WHERE salon_id=n.salon_id;
  UPDATE public.notification_log SET sms_quota_reserved=false, sms_included_used=0, sms_prepaid_used=0, sms_reservation_type=NULL
    WHERE id=n.id;
END; $$;
REVOKE ALL ON FUNCTION public.release_sms_reservation(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The worker's queue ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit integer DEFAULT 25)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE r record; v_ids uuid[] := '{}';
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied: claim_due_notifications is service role only' USING ERRCODE='42501'; END IF;

  UPDATE public.notification_log n SET status='suppressed',error='Salon plan is inactive',updated_at=now() FROM public.salons s
   WHERE s.id=n.salon_id AND s.subscription_status NOT IN ('active','trialing','past_due') AND n.status IN ('pending','retry');
  UPDATE public.notification_log n SET status='suppressed',error='Salon trial has expired',updated_at=now() FROM public.salons s
   WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND s.trial_ends_at<=now() AND n.status IN ('pending','retry');
  UPDATE public.notification_log n SET status='suppressed',error='Notifications disabled by salon',updated_at=now() FROM public.salon_settings ss
   WHERE ss.salon_id=n.salon_id AND n.status IN ('pending','retry') AND (
     (n.channel='email' AND ((n.message_type IN ('reminder_24h','reminder_2h','recall','no_show_followup') AND NOT ss.auto_reminders_enabled)
       OR (n.message_type='booking_confirmation' AND NOT ss.send_booking_confirmation_email)))
     OR (n.channel='sms' AND NOT ((n.message_type='reminder_24h' AND ss.sms_reminder_24h)
       OR (n.message_type='reminder_2h' AND ss.sms_reminder_2h)
       OR (n.message_type='booking_confirmation' AND ss.sms_booking_confirmation))));
  UPDATE public.notification_log n SET status='suppressed',error='Client is archived or has withdrawn consent',updated_at=now() FROM public.clients c
   WHERE c.id=n.client_id AND n.status IN ('pending','retry') AND (c.is_archived OR (n.channel='sms' AND (NOT c.sms_consent OR c.sms_unsubscribed_at IS NOT NULL)) OR (n.channel='email' AND (NOT c.email_consent OR c.unsubscribed_at IS NOT NULL)));
  -- A reminder that could not go out before the visit started is not sent late.
  UPDATE public.notification_log n SET status='suppressed',error='The visit has already started',updated_at=now() FROM public.appointments a
   WHERE a.id=n.appointment_id AND n.status IN ('pending','retry') AND n.message_type IN ('reminder_24h','reminder_2h','booking_confirmation') AND a.starts_at<=now();
  -- SMS held for messages that will not be sent go back to the salon.
  FOR r IN SELECT id FROM public.notification_log WHERE sms_quota_reserved AND status IN ('suppressed','canceled') LOOP
    PERFORM public.release_sms_reservation(r.id);
  END LOOP;
  UPDATE public.notification_log SET status='retry',locked_at=NULL,next_attempt_at=now()+interval '15 minutes',error='Recovered after a worker interruption',updated_at=now()
   WHERE status='processing' AND locked_at<now()-interval '15 minutes';

  FOR r IN
    SELECT n.id, n.channel, s.subscription_status FROM public.notification_log n JOIN public.salons s ON s.id=n.salon_id
    LEFT JOIN public.subscriptions sub ON sub.salon_id=s.id
    WHERE n.status IN ('pending','retry') AND n.scheduled_at<=now() AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=now())
      AND ((s.subscription_status='active') OR (s.subscription_status='trialing' AND s.trial_ends_at>now()) OR
        (s.subscription_status='past_due' AND sub.grace_ends_at>now()))
    ORDER BY n.scheduled_at, n.created_at
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,25),100))
    FOR UPDATE OF n SKIP LOCKED
  LOOP
    IF r.channel='sms' AND NOT public.reserve_sms_notification(r.id) THEN
      -- SMS come with paid packages; a trial has none.
      UPDATE public.notification_log
      SET status='suppressed', error=CASE WHEN r.subscription_status='trialing' THEN 'SMS starts with a paid plan' ELSE 'No SMS left' END, updated_at=now()
      WHERE id=r.id;
    ELSE
      UPDATE public.notification_log SET status='processing', attempt_count=attempt_count+1, locked_at=now(), updated_at=now() WHERE id=r.id;
      v_ids := v_ids || r.id;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT jsonb_build_object('id',u.id,'salon_id',u.salon_id,'client_id',u.client_id,'appointment_id',u.appointment_id,'message_type',u.message_type,
    'channel',u.channel,'language',u.language,'recipient',u.recipient,'subject',u.subject,'body',u.body,'attempt_count',u.attempt_count,
    'max_attempts',u.max_attempts,'idempotency_key',u.idempotency_key,'timezone',ss.timezone,'salon_name',ss.salon_name,
    'reply_to',ss.verified_sender_email,'unsubscribe_token',c.unsubscribe_token,'dry_run_mode',ss.dry_run_mode,'sms_parts',u.sms_parts,
    'client_allowed',CASE WHEN u.channel='sms' THEN c.sms_consent AND c.sms_unsubscribed_at IS NULL ELSE c.email_consent AND c.unsubscribed_at IS NULL END,
    'client_archived',c.is_archived)
  FROM public.notification_log u JOIN public.clients c ON c.id=u.client_id JOIN public.salon_settings ss ON ss.salon_id=u.salon_id
  WHERE u.id = ANY(v_ids);
END; $$;
REVOKE ALL ON FUNCTION public.claim_due_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(integer) TO service_role;

-- Results: a sent SMS is spent for good; one that never went out is given back.
CREATE OR REPLACE FUNCTION public.record_notification_result(p_id uuid, p_status text, p_provider_message_id text DEFAULT NULL, p_cost numeric DEFAULT NULL, p_error text DEFAULT NULL, p_next_attempt_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row public.notification_log%ROWTYPE; v_final text;
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Access denied: record_notification_result is service role only' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.notification_log WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'processing' THEN RAISE EXCEPTION 'Notification job is not processing'; END IF;
  v_final := CASE WHEN p_status='retry' AND v_row.attempt_count>=v_row.max_attempts THEN 'failed' ELSE p_status END;
  UPDATE public.notification_log SET status=v_final, provider_message_id=COALESCE(p_provider_message_id,provider_message_id), cost=COALESCE(p_cost,cost), error=p_error,
    next_attempt_at=CASE WHEN v_final='retry' THEN p_next_attempt_at ELSE NULL END,
    sent_at=CASE WHEN v_final IN ('sent','delivered') THEN now() ELSE sent_at END,
    sms_quota_reserved=CASE WHEN v_final IN ('sent','delivered') THEN false ELSE sms_quota_reserved END,
    locked_at=NULL, updated_at=now()
    WHERE id=p_id;
  IF v_row.channel='sms' AND v_final IN ('failed','suppressed') THEN
    PERFORM public.release_sms_reservation(p_id);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) TO service_role;

-- Delivery reports from uBill: 1 received, 2 not delivered, 4 error. 0 and 3 are interim.
CREATE OR REPLACE FUNCTION public.record_sms_delivery(p_provider_message_id text, p_status_id integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
  IF p_status_id NOT IN (1, 2, 4) OR p_provider_message_id IS NULL OR p_provider_message_id = '' THEN RETURN 0; END IF;
  UPDATE public.notification_log
  SET status=CASE WHEN p_status_id=1 THEN 'delivered' ELSE 'failed' END,
      error=CASE WHEN p_status_id=1 THEN NULL ELSE 'Not delivered to the phone' END,
      updated_at=now()
  WHERE channel='sms' AND provider_message_id=p_provider_message_id
    AND (status='sent' OR (status='failed' AND p_status_id=1));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.record_sms_delivery(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_sms_delivery(text, integer) TO service_role;
