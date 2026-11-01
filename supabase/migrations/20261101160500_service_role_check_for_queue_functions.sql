-- Eight server-only functions recognised the service role only through the old
-- request.jwt.claim.role setting. Current PostgREST sets just request.jwt.claims (JSON), so these
-- functions refused every call: the reminder and confirmation queue, recording send results,
-- email webhooks, billing and the platform overview never ran in production.
-- 20261026183616_fix_service_role_jwt_claim_check.sql fixed the same problem for the rate limiter.
--
-- Each function keeps its body; only the role lookup is replaced with request_role(), which reads
-- the current setting and falls back to the old one.

CREATE OR REPLACE FUNCTION public.request_role()
RETURNS text LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;
REVOKE ALL ON FUNCTION public.request_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_role() TO authenticated, service_role;

DO $$
DECLARE
  v_fn record;
  v_def text;
  v_count integer := 0;
BEGIN
  FOR v_fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname IN ('claim_due_notifications', 'claim_due_reminders', 'platform_salon_overview', 'process_billing_cycle',
        'process_email_webhook_event', 'record_notification_result', 'record_reminder_send_result', 'reserve_sms_notification')
      AND p.prosrc LIKE '%request.jwt.claim.role%' AND p.prosrc NOT LIKE '%request.jwt.claims%'
  LOOP
    v_def := regexp_replace(
      pg_get_functiondef(v_fn.oid),
      'current_setting\(\s*''request\.jwt\.claim\.role''\s*,\s*true\s*\)',
      'public.request_role()',
      'g'
    );
    -- CREATE OR REPLACE keeps the existing owner and grants.
    EXECUTE v_def;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Updated % functions to read the role from request.jwt.claims', v_count;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.prosrc LIKE '%request.jwt.claim.role%' AND p.prosrc NOT LIKE '%request.jwt.claims%'
  ) THEN
    RAISE EXCEPTION 'A function still reads only request.jwt.claim.role';
  END IF;
END $$;
