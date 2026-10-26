CREATE OR REPLACE FUNCTION public.normalize_georgian_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
DECLARE v_digits text;
BEGIN
  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(v_digits) = 9 AND v_digits LIKE '5%' THEN
    v_digits := '995' || v_digits;
  ELSIF length(v_digits) = 12 AND v_digits LIKE '9955%' THEN
    NULL;
  ELSIF length(v_digits) = 13 AND v_digits LIKE '009955%' THEN
    v_digits := substr(v_digits, 3);
  ELSE
    RETURN NULL;
  END IF;
  RETURN '+' || v_digits;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_georgian_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_georgian_phone(text) TO authenticated, service_role;

ALTER TABLE public.clients
  ADD COLUMN normalized_phone text GENERATED ALWAYS AS (public.normalize_georgian_phone(phone)) STORED,
  ADD COLUMN sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_unsubscribed_at timestamptz,
  ADD COLUMN preferred_language text NOT NULL DEFAULT 'ka' CHECK (preferred_language IN ('ka','en'));

CREATE UNIQUE INDEX clients_salon_normalized_phone_uidx
  ON public.clients(salon_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS uq_clients_salon_email;

ALTER TABLE public.salon_settings
  ADD COLUMN booking_cancel_deadline_hours integer NOT NULL DEFAULT 24
    CHECK (booking_cancel_deadline_hours BETWEEN 0 AND 720);

ALTER TABLE public.appointments
  ADD COLUMN self_service_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN (
    'booking_confirmation','reminder_24h','reminder_2h','cancel_confirmation',
    'reschedule_confirmation','recall','no_show_followup'
  )),
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  language text NOT NULL CHECK (language IN ('ka','en')),
  subject_template text,
  body_template text NOT NULL CHECK (length(trim(body_template)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id,message_type,channel,language)
);
CREATE INDEX notification_templates_lookup_idx
  ON public.notification_templates(salon_id,message_type,channel,language) WHERE is_active;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_templates_member_read ON public.notification_templates FOR SELECT TO authenticated
  USING (public.user_has_salon_access(salon_id));
CREATE POLICY notification_templates_admin_write ON public.notification_templates FOR ALL TO authenticated
  USING (public.user_is_salon_admin(salon_id)) WITH CHECK (public.user_is_salon_admin(salon_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  message_type text NOT NULL CHECK (message_type IN (
    'booking_confirmation','reminder_24h','reminder_2h','cancel_confirmation',
    'reschedule_confirmation','recall','no_show_followup'
  )),
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  language text NOT NULL CHECK (language IN ('ka','en')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','processing','retry','sent','delivered','failed','suppressed','canceled'
  )),
  provider_message_id text,
  cost numeric(10,4),
  error text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  sent_at timestamptz,
  idempotency_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_log_due_idx ON public.notification_log(status,scheduled_at,next_attempt_at)
  WHERE status IN ('pending','retry');
CREATE INDEX notification_log_salon_client_idx ON public.notification_log(salon_id,client_id,created_at DESC);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_log_member_read ON public.notification_log FOR SELECT TO authenticated
  USING (public.user_has_salon_access(salon_id));
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

CREATE OR REPLACE FUNCTION public.suppress_notifications_after_consent_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.is_archived OR (OLD.email_consent AND NOT NEW.email_consent) OR
    (OLD.unsubscribed_at IS NULL AND NEW.unsubscribed_at IS NOT NULL) THEN
    UPDATE public.notification_log SET status='suppressed',error='Email consent withdrawn or client archived',updated_at=now()
      WHERE client_id=NEW.id AND channel='email' AND status IN ('pending','retry');
  END IF;
  IF NEW.is_archived OR (OLD.sms_consent AND NOT NEW.sms_consent) OR
    (OLD.sms_unsubscribed_at IS NULL AND NEW.sms_unsubscribed_at IS NOT NULL) THEN
    UPDATE public.notification_log SET status='suppressed',error='SMS consent withdrawn or client archived',updated_at=now()
      WHERE client_id=NEW.id AND channel='sms' AND status IN ('pending','retry');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.suppress_notifications_after_consent_change() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER trg_suppress_notifications_after_consent_change
AFTER UPDATE OF email_consent,unsubscribed_at,sms_consent,sms_unsubscribed_at,is_archived ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.suppress_notifications_after_consent_change();

CREATE OR REPLACE FUNCTION public.seed_notification_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_templates(salon_id,message_type,channel,language,subject_template,body_template)
  SELECT NEW.salon_id,t.message_type,c.channel,l.language,
    CASE WHEN c.channel='email' THEN CASE l.language
      WHEN 'ka' THEN CASE t.message_type
        WHEN 'booking_confirmation' THEN 'ჯავშანი დადასტურებულია'
        WHEN 'reminder_24h' THEN 'ხვალ გაქვთ ვიზიტი'
        WHEN 'reminder_2h' THEN 'ვიზიტი 2 საათში იწყება'
        WHEN 'cancel_confirmation' THEN 'ჯავშანი გაუქმებულია'
        WHEN 'reschedule_confirmation' THEN 'ჯავშანი გადატანილია'
        WHEN 'recall' THEN 'დროა შემდეგი ვიზიტის დაგეგმვა'
        ELSE 'გელოდებით შემდეგ ვიზიტზე'
      END
      ELSE CASE t.message_type
        WHEN 'booking_confirmation' THEN 'Booking confirmed'
        WHEN 'reminder_24h' THEN 'Your visit is tomorrow'
        WHEN 'reminder_2h' THEN 'Your visit starts in 2 hours'
        WHEN 'cancel_confirmation' THEN 'Booking canceled'
        WHEN 'reschedule_confirmation' THEN 'Booking rescheduled'
        WHEN 'recall' THEN 'Time to plan your next visit'
        ELSE 'We hope to see you again'
      END END ELSE NULL END,
    CASE l.language
      WHEN 'ka' THEN CASE t.message_type
        WHEN 'booking_confirmation' THEN 'გამარჯობა, {{client_name}}. {{salon_name}}-ში თქვენი {{service_name}} დაჯავშნილია {{local_start}}-ზე. დეტალები: {{manage_link}} {{unsubscribe_link}}'
        WHEN 'reminder_24h' THEN 'შეხსენება: ხვალ {{local_start}}-ზე გაქვთ {{service_name}} {{salon_name}}-ში. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'reminder_2h' THEN 'შეხსენება: {{service_name}} იწყება 2 საათში, {{local_start}}-ზე. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'cancel_confirmation' THEN 'თქვენი {{local_start}}-ის ჯავშანი გაუქმებულია. {{salon_name}} {{unsubscribe_link}}'
        WHEN 'reschedule_confirmation' THEN 'თქვენი ჯავშანი გადატანილია {{local_start}}-ზე. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'recall' THEN 'გამარჯობა, {{client_name}}. დროა დაგეგმოთ შემდეგი {{service_name}} {{salon_name}}-ში. {{booking_link}} {{unsubscribe_link}}'
        ELSE 'ვერ გნახეთ დაგეგმილ ვიზიტზე. ახალი დროის ასარჩევად: {{booking_link}} {{unsubscribe_link}}'
      END
      ELSE CASE t.message_type
        WHEN 'booking_confirmation' THEN 'Hi {{client_name}}, your {{service_name}} at {{salon_name}} is booked for {{local_start}}. Details: {{manage_link}} {{unsubscribe_link}}'
        WHEN 'reminder_24h' THEN 'Reminder: your {{service_name}} at {{salon_name}} is tomorrow at {{local_start}}. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'reminder_2h' THEN 'Reminder: your {{service_name}} starts in 2 hours at {{local_start}}. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'cancel_confirmation' THEN 'Your booking for {{local_start}} has been canceled. {{salon_name}} {{unsubscribe_link}}'
        WHEN 'reschedule_confirmation' THEN 'Your booking has been moved to {{local_start}}. {{manage_link}} {{unsubscribe_link}}'
        WHEN 'recall' THEN 'Hi {{client_name}}, it is time to plan your next {{service_name}} at {{salon_name}}. {{booking_link}} {{unsubscribe_link}}'
        ELSE 'We missed you at your appointment. Choose a new time: {{booking_link}} {{unsubscribe_link}}'
      END
    END
  FROM (VALUES
    ('booking_confirmation'),('reminder_24h'),('reminder_2h'),('cancel_confirmation'),
    ('reschedule_confirmation'),('recall'),('no_show_followup')
  ) t(message_type)
  CROSS JOIN (VALUES ('sms'),('email')) c(channel)
  CROSS JOIN (VALUES ('ka'),('en')) l(language)
  ON CONFLICT (salon_id,message_type,channel,language) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_notification_templates() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_seed_notification_templates ON public.salon_settings;
CREATE TRIGGER trg_seed_notification_templates AFTER INSERT ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION public.seed_notification_templates();

INSERT INTO public.notification_templates(salon_id,message_type,channel,language,subject_template,body_template)
SELECT s.id,t.message_type,c.channel,l.language,
  CASE WHEN c.channel='email' THEN CASE WHEN l.language='ka' THEN 'შეხსენება moarge-დან' ELSE 'A note from moarge' END END,
  CASE l.language WHEN 'ka' THEN 'გამარჯობა, {{client_name}}. თქვენი {{service_name}} {{salon_name}}-ში. {{local_start}} {{manage_link}} {{booking_link}}'
  ELSE 'Hi {{client_name}}. Your {{service_name}} at {{salon_name}}. {{local_start}} {{manage_link}} {{booking_link}}' END
FROM public.salons s
CROSS JOIN (VALUES ('booking_confirmation'),('reminder_24h'),('reminder_2h'),('cancel_confirmation'),('reschedule_confirmation'),('recall'),('no_show_followup')) t(message_type)
CROSS JOIN (VALUES ('sms'),('email')) c(channel)
CROSS JOIN (VALUES ('ka'),('en')) l(language)
ON CONFLICT (salon_id,message_type,channel,language) DO NOTHING;
UPDATE public.notification_templates
SET body_template=body_template || ' {{unsubscribe_link}}'
WHERE body_template NOT LIKE '%{{unsubscribe_link}}%';

CREATE OR REPLACE FUNCTION public.enqueue_appointment_notification(
  p_appointment_id uuid,p_message_type text,p_scheduled_at timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.notification_log(salon_id,client_id,appointment_id,message_type,channel,language,recipient,subject,body,scheduled_at)
  SELECT a.salon_id,c.id,a.id,p_message_type,ch.channel,
    COALESCE(c.preferred_language,'ka'),
    CASE WHEN ch.channel='sms' THEN c.normalized_phone ELSE c.normalized_email END,
    tpl.subject_template,
    replace(replace(replace(replace(replace(replace(replace(replace(tpl.body_template,
      '{{client_name}}',c.full_name),'{{salon_name}}',ss.salon_name),'{{service_name}}',COALESCE(s.name_ka,s.name_en,a.service_name,'ვიზიტი')),
      '{{local_start}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'YYYY-MM-DD HH24:MI')),'{{manage_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/manage-booking?token=' || a.self_service_token::text),
      '{{booking_link}}',ss.booking_url),'{{salon_address}}',COALESCE(ss.salon_address,'')),
      '{{unsubscribe_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/unsubscribe?token=' || c.unsubscribe_token::text || '&channel=' || ch.channel),
    p_scheduled_at
  FROM public.appointments a
  JOIN public.clients c ON c.id=a.client_id
  JOIN public.salon_settings ss ON ss.salon_id=a.salon_id
  LEFT JOIN public.services s ON s.id::text=a.service_id AND s.salon_id=a.salon_id
  CROSS JOIN (VALUES ('sms'),('email')) ch(channel)
  JOIN public.notification_templates tpl ON tpl.salon_id=a.salon_id AND tpl.message_type=p_message_type
    AND tpl.channel=ch.channel AND tpl.language=COALESCE(c.preferred_language,'ka') AND tpl.is_active
  WHERE a.id=p_appointment_id AND (
    (ch.channel='sms' AND c.sms_consent AND c.sms_unsubscribed_at IS NULL AND c.normalized_phone IS NOT NULL)
    OR (ch.channel='email' AND c.email_consent AND c.unsubscribed_at IS NULL AND c.email IS NOT NULL)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_notification(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.schedule_appointment_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_recall_days integer;
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
    SELECT recall_days INTO v_recall_days FROM public.services WHERE id=NULLIF(NEW.service_id,'')::uuid AND salon_id=NEW.salon_id;
    IF v_recall_days IS NOT NULL THEN
      PERFORM public.enqueue_appointment_notification(NEW.id,'recall',GREATEST(now(),NEW.ends_at)+make_interval(days=>v_recall_days));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_appointment_notifications() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_schedule_appointment_notifications ON public.appointments;
CREATE TRIGGER trg_schedule_appointment_notifications
  AFTER INSERT OR UPDATE OF status,starts_at ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_appointment_notifications();

CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_limit integer DEFAULT 25)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: claim_due_notifications is service role only' USING ERRCODE='42501';
  END IF;
  UPDATE public.notification_log n SET status='suppressed',error='Salon trial has expired',updated_at=now()
  FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status NOT IN ('active','trialing')
    AND n.status IN ('pending','retry');
  UPDATE public.notification_log n SET status='suppressed',error='Salon trial has expired',updated_at=now()
  FROM public.salons s
  WHERE s.id=n.salon_id AND s.subscription_status='trialing' AND s.trial_ends_at<=now()
    AND n.status IN ('pending','retry');
  UPDATE public.notification_log n SET status='suppressed',error='Notifications disabled by salon',updated_at=now()
  FROM public.salon_settings ss
  WHERE ss.salon_id=n.salon_id AND n.status IN ('pending','retry') AND (
    (n.message_type IN ('reminder_24h','reminder_2h','recall','no_show_followup') AND NOT ss.auto_reminders_enabled)
    OR (n.channel='email' AND n.message_type='booking_confirmation' AND NOT ss.send_booking_confirmation_email)
  );
  UPDATE public.notification_log n SET status='suppressed',error='Client is archived or has withdrawn consent',updated_at=now()
  FROM public.clients c
  WHERE c.id=n.client_id AND n.status IN ('pending','retry') AND (
    c.is_archived OR (n.channel='sms' AND (NOT c.sms_consent OR c.sms_unsubscribed_at IS NOT NULL))
    OR (n.channel='email' AND (NOT c.email_consent OR c.unsubscribed_at IS NOT NULL))
  );
  UPDATE public.notification_log SET status='retry',locked_at=NULL,
    next_attempt_at=now()+interval '15 minutes',error='Recovered after a worker interruption',updated_at=now()
  WHERE status='processing' AND locked_at<now()-interval '15 minutes';
  RETURN QUERY
  WITH claimed AS (
    SELECT n.id FROM public.notification_log n
    JOIN public.salons s ON s.id=n.salon_id
    WHERE n.status IN ('pending','retry') AND n.scheduled_at<=now()
      AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=now())
      AND (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))
    ORDER BY n.scheduled_at,n.created_at
    LIMIT GREATEST(1,LEAST(COALESCE(p_limit,25),100))
    FOR UPDATE OF n SKIP LOCKED
  ), updated AS (
    UPDATE public.notification_log n SET status='processing',attempt_count=n.attempt_count+1,locked_at=now(),updated_at=now()
    FROM claimed c WHERE n.id=c.id RETURNING n.*
  )
  SELECT jsonb_build_object(
    'id',u.id,'salon_id',u.salon_id,'client_id',u.client_id,'appointment_id',u.appointment_id,
    'message_type',u.message_type,'channel',u.channel,'language',u.language,'recipient',u.recipient,
    'subject',u.subject,'body',u.body,'attempt_count',u.attempt_count,'max_attempts',u.max_attempts,
      'idempotency_key',u.idempotency_key,'timezone',ss.timezone,'salon_name',ss.salon_name,
    'reply_to',ss.verified_sender_email,'unsubscribe_token',c.unsubscribe_token,
    'dry_run_mode',ss.dry_run_mode,'client_allowed',CASE WHEN u.channel='sms'
      THEN c.sms_consent AND c.sms_unsubscribed_at IS NULL
      ELSE c.email_consent AND c.unsubscribed_at IS NULL END,
    'client_archived',c.is_archived
  )
  FROM updated u JOIN public.clients c ON c.id=u.client_id
  JOIN public.salon_settings ss ON ss.salon_id=u.salon_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.record_notification_result(
  p_id uuid,p_status text,p_provider_message_id text DEFAULT NULL,p_cost numeric DEFAULT NULL,
  p_error text DEFAULT NULL,p_next_attempt_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.notification_log%rowtype;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied: record_notification_result is service role only' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_row FROM public.notification_log WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_row.status<>'processing' THEN RAISE EXCEPTION 'Notification job is not processing'; END IF;
  UPDATE public.notification_log SET
    status=CASE WHEN p_status='retry' AND v_row.attempt_count>=v_row.max_attempts THEN 'failed' ELSE p_status END,
    provider_message_id=COALESCE(p_provider_message_id,provider_message_id),
    cost=COALESCE(p_cost,cost),error=p_error,next_attempt_at=CASE WHEN p_status='retry' AND v_row.attempt_count<v_row.max_attempts THEN p_next_attempt_at ELSE NULL END,
    sent_at=CASE WHEN p_status IN ('sent','delivered') THEN now() ELSE sent_at END,
    locked_at=NULL,updated_at=now()
  WHERE id=p_id AND salon_id=v_row.salon_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_result(uuid,text,text,numeric,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.unsubscribe_client_notification_by_token(p_token uuid,p_channel text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_client public.clients%rowtype; v_count integer;
BEGIN
  IF p_channel NOT IN ('sms','email') THEN RETURN jsonb_build_object('success',false,'error','Invalid channel'); END IF;
  SELECT * INTO v_client FROM public.clients WHERE unsubscribe_token=p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Invalid unsubscribe token'); END IF;
  IF p_channel='sms' THEN
    UPDATE public.clients SET sms_consent=false,sms_unsubscribed_at=COALESCE(sms_unsubscribed_at,now()) WHERE id=v_client.id;
  ELSE
    UPDATE public.clients SET email_consent=false,unsubscribed_at=COALESCE(unsubscribed_at,now()) WHERE id=v_client.id;
  END IF;
  UPDATE public.notification_log SET status='suppressed',error='Client unsubscribed',updated_at=now()
    WHERE client_id=v_client.id AND channel=p_channel AND status IN ('pending','retry');
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN jsonb_build_object('success',true,'channel',p_channel,'client_name',v_client.full_name,'canceled_notifications',v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.unsubscribe_client_notification_by_token(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_client_notification_by_token(uuid,text) TO service_role;

-- Replace the email-only 21-day flow with service-specific recall notifications.
UPDATE public.reminders SET status='canceled',canceled_at=now(),cancel_reason='Replaced by channel-aware notification outbox'
WHERE status IN ('scheduled','processing');
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.id,a.status,a.starts_at,a.ends_at,sv.recall_days
    FROM public.appointments a
    LEFT JOIN public.services sv ON sv.id::text=a.service_id AND sv.salon_id=a.salon_id
  LOOP
    IF r.status='scheduled' THEN
      IF r.starts_at-interval '24 hours'>now() THEN
        PERFORM public.enqueue_appointment_notification(r.id,'reminder_24h',r.starts_at-interval '24 hours');
      END IF;
      IF r.starts_at-interval '2 hours'>now() THEN
        PERFORM public.enqueue_appointment_notification(r.id,'reminder_2h',r.starts_at-interval '2 hours');
      END IF;
    ELSIF r.status='completed' AND r.recall_days IS NOT NULL THEN
      PERFORM public.enqueue_appointment_notification(r.id,'recall',GREATEST(now(),r.ends_at)+make_interval(days=>r.recall_days));
    END IF;
  END LOOP;
END;
$$;

DROP FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text,boolean);
CREATE FUNCTION public.create_appointment(
  p_salon_id uuid,p_service_id uuid,p_date date,p_start_time time,p_staff_id uuid,
  p_client_id uuid DEFAULT NULL,p_full_name text DEFAULT NULL,p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,p_notes text DEFAULT NULL,p_email_consent boolean DEFAULT false,
  p_sms_consent boolean DEFAULT false,p_language text DEFAULT 'ka'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_slot record; v_service public.services%rowtype; v_client_id uuid; v_client_email text;
  v_appointment public.appointments%rowtype; v_resource_id uuid; v_email_count integer;
  v_phone text; v_name text; v_incoming_email text;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR NOT public.user_has_salon_access(p_salon_id)) THEN
    RAISE EXCEPTION 'Salon access required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.salons s WHERE s.id=p_salon_id AND
    (s.subscription_status='active' OR (s.subscription_status='trialing' AND s.trial_ends_at>now()))) THEN
    RETURN jsonb_build_object('success',false,'error','Salon subscription is not active.');
  END IF;
  SELECT * INTO v_service FROM public.services WHERE id=p_service_id AND salon_id=p_salon_id AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Selected service is unavailable.'); END IF;
  SELECT * INTO v_slot FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id) s WHERE s.slot_time=p_start_time LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','This time is no longer available.',
      'available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
  END IF;
  SELECT sr.resource_id INTO v_resource_id FROM public.service_resources sr
    JOIN public.resources r ON r.id=sr.resource_id AND r.is_active
    WHERE sr.service_id=v_service.id AND NOT EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.resource_id=sr.resource_id
      AND a.status IN ('scheduled','completed','arrived')
      AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_slot.starts_at,v_slot.ends_at,'[)')
    ) ORDER BY sr.resource_id LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.service_resources WHERE service_id=v_service.id) AND v_resource_id IS NULL THEN
    RETURN jsonb_build_object('success',false,'conflict',true,'error','No required resource is available at this time.');
  END IF;
  v_incoming_email:=NULLIF(lower(trim(p_email)),'');
  IF v_incoming_email IS NOT NULL THEN
    INSERT INTO public.booking_email_daily_limits(email_hash,booking_date,booking_count)
    VALUES(encode(digest(v_incoming_email,'sha256'),'hex'),
      (now() AT TIME ZONE (SELECT timezone FROM public.salon_settings WHERE salon_id=p_salon_id))::date,1)
    ON CONFLICT(email_hash,booking_date) DO UPDATE
      SET booking_count=public.booking_email_daily_limits.booking_count+1
      WHERE public.booking_email_daily_limits.booking_count<3
    RETURNING booking_count INTO v_email_count;
    IF v_email_count IS NULL THEN RETURN jsonb_build_object('success',false,'error','This email has reached the daily booking limit.'); END IF;
  END IF;
  IF p_client_id IS NOT NULL THEN
    SELECT id,email INTO v_client_id,v_client_email FROM public.clients WHERE id=p_client_id AND salon_id=p_salon_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Client not found.'); END IF;
  ELSE
    v_name:=trim(COALESCE(p_full_name,''));
    v_phone:=public.normalize_georgian_phone(COALESCE(p_phone,''));
    IF length(v_name)<2 OR v_phone IS NULL THEN RETURN jsonb_build_object('success',false,'error','Name and a valid Georgian mobile number are required.'); END IF;
    INSERT INTO public.clients(salon_id,full_name,email,phone,email_consent,sms_consent,preferred_language,unsubscribed_at,sms_unsubscribed_at)
    VALUES(p_salon_id,v_name,v_incoming_email,v_phone,COALESCE(p_email_consent,false),
      COALESCE(p_sms_consent,false),CASE WHEN p_language IN ('ka','en') THEN p_language ELSE 'ka' END,
      CASE WHEN p_email_consent THEN NULL ELSE now() END,CASE WHEN p_sms_consent THEN NULL ELSE now() END)
    ON CONFLICT (salon_id,normalized_phone) WHERE normalized_phone IS NOT NULL
    DO UPDATE SET full_name=excluded.full_name,email=COALESCE(excluded.email,public.clients.email),
      email_consent=public.clients.email_consent OR excluded.email_consent,
      unsubscribed_at=CASE WHEN excluded.email_consent THEN NULL ELSE public.clients.unsubscribed_at END,
      sms_consent=public.clients.sms_consent OR excluded.sms_consent,
      sms_unsubscribed_at=CASE WHEN excluded.sms_consent THEN NULL ELSE public.clients.sms_unsubscribed_at END,
      preferred_language=excluded.preferred_language,is_archived=false,archived_at=NULL
    RETURNING id,email INTO v_client_id,v_client_email;
  END IF;
  INSERT INTO public.appointments(salon_id,client_id,treatment_date,treatment_time,treatment_type,status,notes,
    staff_id,resource_id,starts_at,ends_at,service_id,service_name,price_gel,duration_minutes,
    price_snapshot,duration_snapshot_minutes,buffer_snapshot_minutes,is_epilation)
  VALUES(p_salon_id,v_client_id,p_date,p_start_time,COALESCE(v_service.legacy_id,v_service.category),'scheduled',
    p_notes,v_slot.staff_id,v_resource_id,v_slot.starts_at,v_slot.ends_at,v_service.id::text,v_service.name_en,
    v_service.price_gel,v_service.duration_minutes,v_service.price_gel,v_service.duration_minutes,
    v_service.buffer_minutes,v_service.recall_days IS NOT NULL) RETURNING * INTO v_appointment;
  RETURN jsonb_build_object('success',true,'appointment_id',v_appointment.id,'client_id',v_client_id,
    'salon_id',p_salon_id,'salon_name',(SELECT name FROM public.salons WHERE id=p_salon_id),
    'treatment_date',p_date,'treatment_time',p_start_time,'treatment_type',COALESCE(v_service.legacy_id,v_service.category),
    'service_name',v_service.name_en,'service_id',v_service.id,'staff_id',v_slot.staff_id,
    'staff_name',v_slot.staff_name,'client_email',v_client_email,'price_gel',v_service.price_gel,
    'duration_minutes',v_service.duration_minutes,'manage_token',v_appointment.self_service_token);
EXCEPTION WHEN exclusion_violation THEN
  RETURN jsonb_build_object('success',false,'conflict',true,'error','This time was booked by another request.',
    'available_slots',COALESCE((SELECT jsonb_agg(slot_time) FROM public.get_available_slots(p_salon_id,p_service_id,p_date,p_staff_id)),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text,boolean,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,date,time,uuid,uuid,text,text,text,text,boolean,boolean,text) TO service_role;
