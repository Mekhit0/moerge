-- Come-back SMS: a marketing message some days after a completed visit, inviting the client back.
--
-- * Marketing needs its own consent (never pre-ticked) and a way to stop in every message.
-- * Only after a completed visit: the salon marked that the person really came, so a stranger who
--   typed someone else's number into the booking form cannot sign them up for offers.
-- * Sent at 11:00 Tbilisi time, the chosen number of days after the visit (the service's own
--   period first, then the salon's).
-- * Not sent to a client who already has a new booking; a newer visit replaces an older invitation.

-- Consent and the short stop code --------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN sms_marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_marketing_consent_at timestamptz,
  ADD COLUMN sms_optout_code text;

CREATE OR REPLACE FUNCTION public.generate_sms_optout_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_code text; v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; i integer;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE sms_optout_code = v_code) THEN RETURN v_code; END IF;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.generate_sms_optout_code() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_client_sms_optout_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.sms_optout_code IS NULL THEN NEW.sms_optout_code := public.generate_sms_optout_code(); END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_client_sms_optout_code() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER set_client_sms_optout_code BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_client_sms_optout_code();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.clients WHERE sms_optout_code IS NULL LOOP
    UPDATE public.clients SET sms_optout_code = public.generate_sms_optout_code() WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.clients ALTER COLUMN sms_optout_code SET NOT NULL;
CREATE UNIQUE INDEX clients_sms_optout_code_uidx ON public.clients(sms_optout_code);
ALTER TABLE public.clients ADD CONSTRAINT clients_sms_optout_code_format CHECK (sms_optout_code ~ '^[a-z0-9]{7}$');

-- Salon choice -----------------------------------------------------------------------------------
ALTER TABLE public.salon_settings
  ADD COLUMN sms_recall boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_recall_days integer NOT NULL DEFAULT 30 CHECK (sms_recall_days BETWEEN 7 AND 365);
GRANT SELECT (sms_recall, sms_recall_days) ON public.salon_settings TO authenticated;

-- The text: short links, and how to stop ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_sms_template(p_message_type text, p_language text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE p_language
    WHEN 'ka' THEN CASE p_message_type
      WHEN 'booking_confirmation' THEN '{{salon_name}}: ჯავშანი {{date}} {{time}}. {{service_name}}. კოდი {{booking_code}}'
      WHEN 'reminder_24h' THEN '{{salon_name}}: ხვალ {{time}}-ზე გელოდებით. {{service_name}}. კოდი {{booking_code}}'
      WHEN 'reminder_2h' THEN '{{salon_name}}: დღეს {{time}}-ზე გელოდებით. {{service_name}}'
      WHEN 'cancel_confirmation' THEN '{{salon_name}}: {{date}} {{time}}-ის ჯავშანი გაუქმდა.'
      WHEN 'reschedule_confirmation' THEN '{{salon_name}}: ჯავშანი გადატანილია, {{date}} {{time}}. კოდი {{booking_code}}'
      WHEN 'recall' THEN '{{salon_name}}: დროა ახალი ვიზიტის. ჩაწერა: {{short_booking_link}} შეწყვეტა: {{optout_link}}'
      ELSE '{{salon_name}}: ვერ გნახეთ. ახალი დრო: {{booking_link}}'
    END
    ELSE CASE p_message_type
      WHEN 'booking_confirmation' THEN '{{salon_name}}: booked for {{date}} {{time}}. {{service_name}}. Code {{booking_code}}'
      WHEN 'reminder_24h' THEN '{{salon_name}}: see you tomorrow at {{time}}. {{service_name}}. Code {{booking_code}}'
      WHEN 'reminder_2h' THEN '{{salon_name}}: see you today at {{time}}. {{service_name}}'
      WHEN 'cancel_confirmation' THEN '{{salon_name}}: your booking for {{date}} {{time}} is canceled.'
      WHEN 'reschedule_confirmation' THEN '{{salon_name}}: moved to {{date}} {{time}}. Code {{booking_code}}'
      WHEN 'recall' THEN '{{salon_name}}: time for your next visit. Book: {{short_booking_link}} Stop: {{optout_link}}'
      ELSE '{{salon_name}}: we missed you. Pick a new time: {{booking_link}}'
    END
  END;
$$;
REVOKE ALL ON FUNCTION public.default_sms_template(text, text) FROM PUBLIC, anon, authenticated;
UPDATE public.notification_templates SET body_template = public.default_sms_template(message_type, language), updated_at = now()
WHERE channel = 'sms' AND message_type = 'recall';

-- Queueing ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_appointment_notification(
  p_appointment_id uuid, p_message_type text, p_scheduled_at timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.notification_log(salon_id,client_id,appointment_id,message_type,channel,language,recipient,subject,body,scheduled_at,sms_parts)
  SELECT m.salon_id, m.client_id, m.appointment_id, p_message_type, 'sms', m.language, m.recipient, NULL, m.body, p_scheduled_at,
    LEAST(20, GREATEST(1, public.sms_segments(m.body)))
  FROM (
    SELECT a.salon_id, c.id AS client_id, a.id AS appointment_id,
      COALESCE(c.preferred_language,'ka') AS language,
      c.normalized_phone AS recipient,
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(tpl.body_template,
        '{{client_name}}',c.full_name),'{{salon_name}}',ss.salon_name),'{{service_name}}',COALESCE(s.name_ka,s.name_en,a.service_name,'ვიზიტი')),
        '{{local_start}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'YYYY-MM-DD HH24:MI')),
        '{{time}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'HH24:MI')),
        '{{date}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'DD.MM')),
        '{{booking_code}}',COALESCE(a.booking_code,'')),
        '{{manage_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/manage-booking?token=' || a.self_service_token::text),
        '{{short_booking_link}}',regexp_replace(ss.booking_url,'^https?://(www\.)?([^/]+).*$','\2') || '/b/' || sa.slug),
        '{{optout_link}}',regexp_replace(ss.booking_url,'^https?://(www\.)?([^/]+).*$','\2') || '/s/' || c.sms_optout_code),
        '{{booking_link}}',ss.booking_url),'{{salon_address}}',COALESCE(ss.salon_address,'')),
        '{{unsubscribe_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/unsubscribe?token=' || c.unsubscribe_token::text || '&channel=sms') AS body
    FROM public.appointments a
    JOIN public.clients c ON c.id=a.client_id
    JOIN public.salons sa ON sa.id=a.salon_id
    JOIN public.salon_settings ss ON ss.salon_id=a.salon_id
    LEFT JOIN public.services s ON s.id::text=a.service_id AND s.salon_id=a.salon_id
    JOIN public.notification_templates tpl ON tpl.salon_id=a.salon_id AND tpl.message_type=p_message_type
      AND tpl.channel='sms' AND tpl.language=COALESCE(c.preferred_language,'ka') AND tpl.is_active
    WHERE a.id=p_appointment_id
      AND c.sms_unsubscribed_at IS NULL AND c.normalized_phone IS NOT NULL AND NOT c.is_archived
      AND ((c.sms_consent AND ((p_message_type='reminder_24h' AND ss.sms_reminder_24h)
          OR (p_message_type='reminder_2h' AND ss.sms_reminder_2h)
          OR (p_message_type='booking_confirmation' AND ss.sms_booking_confirmation)))
        OR (p_message_type='recall' AND ss.sms_recall AND c.sms_marketing_consent))
  ) m
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_notification(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

-- Same as the phase 3 trigger, with the come-back SMS scheduled on completion.
CREATE OR REPLACE FUNCTION public.schedule_appointment_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_days integer; v_tz text; v_recall boolean; v_default_days integer;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status='scheduled' THEN
      PERFORM public.enqueue_appointment_notification(NEW.id,'booking_confirmation',now());
      IF NEW.starts_at-interval '24 hours'>now() THEN PERFORM public.enqueue_appointment_notification(NEW.id,'reminder_24h',NEW.starts_at-interval '24 hours'); END IF;
      IF NEW.starts_at-interval '2 hours'>now() THEN PERFORM public.enqueue_appointment_notification(NEW.id,'reminder_2h',NEW.starts_at-interval '2 hours'); END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='canceled' THEN
    UPDATE public.notification_log SET status='canceled',updated_at=now(),error='Appointment canceled'
      WHERE appointment_id=NEW.id AND message_type IN ('reminder_24h','reminder_2h') AND status IN ('pending','retry');
    PERFORM public.enqueue_appointment_notification(NEW.id,'cancel_confirmation',now());
  ELSIF OLD.starts_at IS DISTINCT FROM NEW.starts_at AND NEW.status='scheduled' THEN
    UPDATE public.notification_log SET status='canceled',updated_at=now(),error='Appointment rescheduled'
      WHERE appointment_id=NEW.id AND message_type IN ('reminder_24h','reminder_2h') AND status IN ('pending','retry');
    PERFORM public.enqueue_appointment_notification(NEW.id,'reschedule_confirmation',now());
    IF NEW.starts_at-interval '24 hours'>now() THEN PERFORM public.enqueue_appointment_notification(NEW.id,'reminder_24h',NEW.starts_at-interval '24 hours'); END IF;
    IF NEW.starts_at-interval '2 hours'>now() THEN PERFORM public.enqueue_appointment_notification(NEW.id,'reminder_2h',NEW.starts_at-interval '2 hours'); END IF;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='no_show' THEN
    PERFORM public.enqueue_appointment_notification(NEW.id,'no_show_followup',now());
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed' THEN
    SELECT ss.sms_recall, ss.sms_recall_days, ss.timezone INTO v_recall, v_default_days, v_tz
      FROM public.salon_settings ss WHERE ss.salon_id=NEW.salon_id;
    IF v_recall THEN
      SELECT recall_days INTO v_days FROM public.services WHERE id=NULLIF(NEW.service_id,'')::uuid AND salon_id=NEW.salon_id;
      v_days := COALESCE(v_days, v_default_days);
      -- A newer visit replaces any invitation still waiting for this client.
      UPDATE public.notification_log SET status='canceled', error='Replaced by a newer visit', updated_at=now()
        WHERE client_id=NEW.client_id AND salon_id=NEW.salon_id AND message_type='recall' AND status IN ('pending','retry');
      PERFORM public.enqueue_appointment_notification(NEW.id,'recall',
        ((((COALESCE(NEW.ends_at, now()) AT TIME ZONE COALESCE(v_tz,'Asia/Tbilisi'))::date + v_days) + time '11:00') AT TIME ZONE COALESCE(v_tz,'Asia/Tbilisi')));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.schedule_appointment_notifications() FROM PUBLIC,anon,authenticated,service_role;

-- The worker's queue: as in 20261102100000_sms_reminders.sql, plus the come-back SMS rules.
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
     n.channel='email'
     OR (n.channel='sms' AND NOT ((n.message_type='reminder_24h' AND ss.sms_reminder_24h)
       OR (n.message_type='reminder_2h' AND ss.sms_reminder_2h)
       OR (n.message_type='booking_confirmation' AND ss.sms_booking_confirmation)
       OR (n.message_type='recall' AND ss.sms_recall))));
  UPDATE public.notification_log n SET status='suppressed',error='Client is archived or has withdrawn consent',updated_at=now() FROM public.clients c
   WHERE c.id=n.client_id AND n.status IN ('pending','retry') AND (c.is_archived OR (n.channel='sms' AND (c.sms_unsubscribed_at IS NOT NULL
     OR (n.message_type='recall' AND NOT c.sms_marketing_consent) OR (n.message_type<>'recall' AND NOT c.sms_consent))));
  -- A reminder that could not go out before the visit started is not sent late.
  UPDATE public.notification_log n SET status='suppressed',error='The visit has already started',updated_at=now() FROM public.appointments a
   WHERE a.id=n.appointment_id AND n.status IN ('pending','retry') AND n.message_type IN ('reminder_24h','reminder_2h','booking_confirmation') AND a.starts_at<=now();
  -- No invitation to come back to a client who has already booked again.
  UPDATE public.notification_log n SET status='suppressed',error='Client already booked',updated_at=now()
   WHERE n.status IN ('pending','retry') AND n.message_type='recall' AND n.scheduled_at<=now()
     AND EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id=n.client_id AND a.salon_id=n.salon_id AND a.status='scheduled' AND a.starts_at>now());
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
    'client_allowed',CASE WHEN u.channel<>'sms' THEN false
      WHEN u.message_type='recall' THEN c.sms_marketing_consent AND c.sms_unsubscribed_at IS NULL
      ELSE c.sms_consent AND c.sms_unsubscribed_at IS NULL END,
    'client_archived',c.is_archived)
  FROM public.notification_log u JOIN public.clients c ON c.id=u.client_id JOIN public.salon_settings ss ON ss.salon_id=u.salon_id
  WHERE u.id = ANY(v_ids);
END; $$;
REVOKE ALL ON FUNCTION public.claim_due_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(integer) TO service_role;

-- Stopping offers from the link in the SMS. Called only by the server, which rate-limits it.
CREATE OR REPLACE FUNCTION public.sms_optout_lookup(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_result jsonb;
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('salon_name', COALESCE(ss.salon_name, s.name), 'subscribed', c.sms_marketing_consent)
    INTO v_result
  FROM public.clients c JOIN public.salons s ON s.id=c.salon_id LEFT JOIN public.salon_settings ss ON ss.salon_id=c.salon_id
  WHERE c.sms_optout_code=p_code;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.sms_optout_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_optout_lookup(text) TO service_role;

CREATE OR REPLACE FUNCTION public.sms_marketing_optout(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_client uuid;
BEGIN
  IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
  UPDATE public.clients SET sms_marketing_consent=false, sms_marketing_consent_at=NULL WHERE sms_optout_code=p_code RETURNING id INTO v_client;
  IF v_client IS NULL THEN RETURN false; END IF;
  UPDATE public.notification_log SET status='canceled', error='Client stopped offers', updated_at=now()
    WHERE client_id=v_client AND message_type='recall' AND status IN ('pending','retry');
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.sms_marketing_optout(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_marketing_optout(text) TO service_role;
