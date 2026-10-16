-- ==============================================================================
-- Migration: 20261016000003_cron_schedule_template.sql
-- Description: Supabase Cron (pg_cron + pg_net) setup instructions and helper
--              to automatically invoke the reminder processing endpoint every
--              15 minutes without requiring any browser tab to be open.
-- ==============================================================================

-- Helper function to configure pg_cron + pg_net once the production URL is deployed:
CREATE OR REPLACE FUNCTION public.configure_reminder_cron_job(
  p_app_base_url TEXT,
  p_cron_secret TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Requires pg_cron and pg_net extensions enabled in Supabase Dashboard -> Database -> Extensions
  -- Example usage in Supabase SQL Editor after deploying to Vercel:
  -- SELECT public.configure_reminder_cron_job('https://your-salon-app.vercel.app', 'your-cron-secret');
  RETURN format(
    E'SELECT cron.schedule(\n' ||
    E'  ''salon-process-due-reminders'',\n' ||
    E'  ''*/15 * * * *'',\n' ||
    E'  $cron$\n' ||
    E'  SELECT net.http_post(\n' ||
    E'    url := %L,\n' ||
    E'    headers := jsonb_build_object(\n' ||
    E'      ''Content-Type'', ''application/json'',\n' ||
    E'      ''Authorization'', %L\n' ||
    E'    ),\n' ||
    E'    body := ''{"source":"supabase_pg_cron"}''::jsonb\n' ||
    E'  );\n' ||
    E'  $cron$\n' ||
    E');',
    rtrim(p_app_base_url, '/') || '/api/cron/process-reminders',
    'Bearer ' || p_cron_secret
  );
END;
$$;
