import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";

const bodySchema = z.object({ code: z.string().regex(/^[a-z0-9]{7}$/) }).strict();

/** Stops a salon's offer SMS for the client behind the code in the message. Reminders keep going. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  let db;
  try {
    db = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  try {
    const allowed = await consumeServerRateLimit(db, `sms-optout:${getTrustedClientIp(request)}`, 20, 3600);
    if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  }
  const { data, error } = await db.rpc("sms_marketing_optout", { p_code: parsed.data.code });
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  if (data !== true) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
