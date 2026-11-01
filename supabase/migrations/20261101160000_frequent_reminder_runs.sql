-- Run the reminder and confirmation queue every 10 minutes instead of once a day.
-- Vercel's free plan only allows a daily cron, so Supabase's own scheduler (pg_cron) calls the
-- app's protected endpoint over HTTPS (pg_net). Both are included in the free plan.
--
-- The endpoint address and its secret are read from Supabase Vault at run time. Nothing secret is
-- stored in this file. Until both Vault entries exist (for example on a local database), the job
-- does nothing.
--   moarge_cron_url     https://www.moarge.com/api/cron/process-reminders
--   moarge_cron_secret  the same value as CRON_SECRET on Vercel

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.call_reminder_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'moarge_cron_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'moarge_cron_secret';
  IF v_url IS NULL OR v_secret IS NULL OR v_url !~ '^https://' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{"source":"supabase_pg_cron"}'::jsonb,
    timeout_milliseconds := 60000
  );
END; $$;
REVOKE ALL ON FUNCTION public.call_reminder_queue() FROM PUBLIC, anon, authenticated, service_role;

-- Replace any earlier copy of the job, then schedule it.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'moarge-reminder-queue';
SELECT cron.schedule('moarge-reminder-queue', '*/10 * * * *', 'SELECT public.call_reminder_queue();');

-- The old helper printed a cron command with the secret inside it. It is no longer needed.
DROP FUNCTION IF EXISTS public.configure_reminder_cron_job(text, text);
