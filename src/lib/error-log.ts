import "server-only";
import { createServiceClient } from "./supabase/server";

export type ErrorSource = "server" | "client" | "cron";

/** Trims and removes anything that looks like a token or key before an error is stored. */
export function cleanErrorText(text: string, max: number): string {
  return text
    .replace(/\b(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}|re_[A-Za-z0-9_]{10,}|sk_[A-Za-z0-9_]{10,}|whsec_[A-Za-z0-9]{10,})\b/g, "[redacted]")
    .replace(/(token|secret|password|apikey|api_key|key)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || "Unknown error";
}

/**
 * Saves an error to our own log (the platform admin panel shows it, and an hourly email goes out).
 * Never throws: logging must not break the request that is already failing.
 */
export async function logAppError(input: {
  source: ErrorSource;
  message: string;
  path?: string | null;
  digest?: string | null;
  salonId?: string | null;
  userId?: string | null;
}): Promise<void> {
  try {
    const db = createServiceClient();
    await db.from("app_errors").insert({
      source: input.source,
      message: cleanErrorText(input.message, 500),
      path: input.path ? cleanErrorText(input.path.split("?")[0], 300) : null,
      digest: input.digest ? input.digest.slice(0, 100) : null,
      salon_id: input.salonId ?? null,
      user_id: input.userId ?? null,
    });
  } catch {
    // Nothing else to do: the log itself is unavailable.
  }
}
