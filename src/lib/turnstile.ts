import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing-token" | "rejected" | "unavailable" };

let warnedMissingSecret = false;

/**
 * Checks a Cloudflare Turnstile token. Turnstile is free and invisible to most visitors.
 * When TURNSTILE_SECRET_KEY is not set the check is skipped, and in production that is logged
 * loudly so it is not forgotten; the database rate limits and phone limits still apply.
 */
export async function verifyTurnstile(token: string | null | undefined, remoteIp: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.VERCEL_ENV === "production" && !warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error("TURNSTILE_SECRET_KEY is not set: public booking has no bot check.");
    }
    return { ok: true };
  }
  if (!token) return { ok: false, reason: "missing-token" };

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
