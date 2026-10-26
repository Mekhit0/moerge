import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeServerRateLimit(
  supabase: SupabaseClient,
  rateKey: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_public_request_limit", {
    p_rate_key: rateKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Database rate limiter is unavailable.");
  return data === true;
}
