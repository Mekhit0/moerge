-- Platform admin panel: our own error log (instead of a paid error service) and a "done" mark for
-- salon feedback. Only the server (service role) reads or writes these; the admin panel reaches
-- them through server routes that check the platform owner.

CREATE TABLE public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('server', 'client', 'cron')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  path text CHECK (path IS NULL OR char_length(path) <= 300),
  digest text CHECK (digest IS NULL OR char_length(digest) <= 100),
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alerted_at timestamptz,
  resolved_at timestamptz
);
CREATE INDEX app_errors_created_idx ON public.app_errors (created_at DESC);
CREATE INDEX app_errors_unalerted_idx ON public.app_errors (created_at) WHERE alerted_at IS NULL;
CREATE INDEX app_errors_salon_idx ON public.app_errors (salon_id);
CREATE INDEX app_errors_user_idx ON public.app_errors (user_id);

-- Row level security with no policies: signed-in users and visitors can neither read nor write.
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_errors FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_errors TO service_role;

-- Old entries are not needed forever; keep 90 days.
CREATE OR REPLACE FUNCTION public.prune_app_errors()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DELETE FROM public.app_errors WHERE created_at < now() - interval '90 days';
$$;
REVOKE ALL ON FUNCTION public.prune_app_errors() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'moarge-prune-app-errors';
SELECT cron.schedule('moarge-prune-app-errors', '30 3 * * *', 'SELECT public.prune_app_errors();');

ALTER TABLE public.dashboard_feedback ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
