import type { NextRequest } from "next/server";

/**
 * Best-effort visitor IP for rate limiting. On Vercel, x-real-ip is set by the platform and
 * cannot be supplied by the visitor, so it is preferred over x-forwarded-for.
 */
export function getTrustedClientIp(request: NextRequest): string {
  const xRealIp = request.headers.get("x-real-ip")?.trim();
  if (xRealIp) return xRealIp;

  const reqIp = (request as unknown as { ip?: string }).ip?.trim();
  if (reqIp) return reqIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const firstForwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  return "127.0.0.1";
}
