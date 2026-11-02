-- Clients get messages by SMS only. Email confirmations and reminders to clients are switched off:
-- salons told us clients do not read them. Account emails (sign-in, invites) are not affected.

-- Queue SMS only; same as 20261102100000_sms_reminders.sql without the email channel.
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
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(tpl.body_template,
        '{{client_name}}',c.full_name),'{{salon_name}}',ss.salon_name),'{{service_name}}',COALESCE(s.name_ka,s.name_en,a.service_name,'ვიზიტი')),
        '{{local_start}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'YYYY-MM-DD HH24:MI')),
        '{{time}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'HH24:MI')),
        '{{date}}',to_char(a.starts_at AT TIME ZONE ss.timezone,'DD.MM')),
        '{{booking_code}}',COALESCE(a.booking_code,'')),
        '{{manage_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/manage-booking?token=' || a.self_service_token::text),
        '{{booking_link}}',ss.booking_url),'{{salon_address}}',COALESCE(ss.salon_address,'')),
        '{{unsubscribe_link}}',regexp_replace(ss.booking_url,'/book.*$','') || '/unsubscribe?token=' || c.unsubscribe_token::text || '&channel=sms') AS body
    FROM public.appointments a
    JOIN public.clients c ON c.id=a.client_id
    JOIN public.salon_settings ss ON ss.salon_id=a.salon_id
    LEFT JOIN public.services s ON s.id::text=a.service_id AND s.salon_id=a.salon_id
    JOIN public.notification_templates tpl ON tpl.salon_id=a.salon_id AND tpl.message_type=p_message_type
      AND tpl.channel='sms' AND tpl.language=COALESCE(c.preferred_language,'ka') AND tpl.is_active
    WHERE a.id=p_appointment_id
      AND c.sms_consent AND c.sms_unsubscribed_at IS NULL AND c.normalized_phone IS NOT NULL
      AND ((p_message_type='reminder_24h' AND ss.sms_reminder_24h)
        OR (p_message_type='reminder_2h' AND ss.sms_reminder_2h)
        OR (p_message_type='booking_confirmation' AND ss.sms_booking_confirmation))
  ) m
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_notification(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

-- Emails already waiting to go out are not sent.
UPDATE public.notification_log
SET status='canceled', error='Client emails are switched off', updated_at=now()
WHERE channel='email' AND status IN ('pending','retry');

-- The old recall-email switches no longer do anything; keep them off so nothing reads them as on.
UPDATE public.salon_settings SET auto_reminders_enabled=false, send_booking_confirmation_email=false;
ALTER TABLE public.salon_settings ALTER COLUMN auto_reminders_enabled SET DEFAULT false;
ALTER TABLE public.salon_settings ALTER COLUMN send_booking_confirmation_email SET DEFAULT false;
