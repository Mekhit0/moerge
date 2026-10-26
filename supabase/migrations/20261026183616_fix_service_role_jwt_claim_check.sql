-- PostgREST exposes JWT claims through request.jwt.claims. Keep the legacy
-- single-claim setting as a fallback for older PostgREST versions.
CREATE OR REPLACE FUNCTION public.consume_public_request_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allowed boolean;
  v_bucket timestamptz;
  v_role text;
BEGIN
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  IF v_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit < 1 OR p_window_seconds < 1 OR p_rate_key IS NULL OR length(p_rate_key) > 300 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  IF p_window_seconds = 86400 THEN
    v_bucket := date_trunc('day', now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi';
  ELSE
    v_bucket := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  END IF;

  INSERT INTO public.public_booking_rate_limit_counters(salon_id, rate_key, bucket_start, request_count)
  VALUES (NULL, md5(p_rate_key), v_bucket, 1)
  ON CONFLICT (rate_key, bucket_start) DO UPDATE
    SET request_count = public.public_booking_rate_limit_counters.request_count + 1
    WHERE public.public_booking_rate_limit_counters.request_count < p_limit
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_public_request_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_request_limit(text, integer, integer)
  TO service_role;
