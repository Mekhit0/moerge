-- This helper schedules a trusted platform endpoint and must never be callable
-- through the public Data API. Platform setup can use the service role only.
REVOKE EXECUTE ON FUNCTION public.configure_reminder_cron_job(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_reminder_cron_job(text, text)
  TO service_role;

-- RLS policies and authenticated RPCs use this membership predicate. Keep it
-- unavailable to anonymous callers while preserving authenticated access.
REVOKE EXECUTE ON FUNCTION public.user_has_salon_access(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_salon_access(uuid)
  TO authenticated, service_role;
