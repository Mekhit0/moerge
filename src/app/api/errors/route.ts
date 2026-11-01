import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { logAppError } from "@/lib/error-log";

const reportSchema = z.object({
  message: z.string().min(1).max(1000),
  path: z.string().max(300).regex(/^\//).optional(),
  digest: z.string().max(100).optional(),
});

/**
 * POST /api/errors: a page crashed in someone's browser. Public because the booking page has no
 * sign-in; small, validated and limited per visitor so it cannot be used to flood the log.
 */
export async function POST(request: NextRequest) {
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    if (!(await consumeServerRateLimit(createServiceClient(), `client-error:${getTrustedClientIp(request)}`, 20, 3600))) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  await logAppError({ source: "client", message: parsed.data.message, path: parsed.data.path, digest: parsed.data.digest });
  return NextResponse.json({ ok: true });
}
