import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logAppError } from "@/lib/error-log";

/**
 * uBill calls this when an SMS changes status (received, not delivered...). It sends a GET with
 * the callback key we set in uBill's API settings; anything without that key is refused.
 */
function sameSecret(given: string, expected: string): boolean {
  const left = crypto.createHash("sha256").update(given).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const expected = process.env.UBILL_CALLBACK_KEY?.trim();
  if (!expected) return NextResponse.json({ error: "Callback is not configured." }, { status: 503 });
  const params = request.nextUrl.searchParams;
  if (!sameSecret(params.get("key") ?? "", expected)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const smsId = params.get("smsID") ?? "";
  const statusId = Number(params.get("statusID"));
  if (!/^\d{1,20}$/.test(smsId) || !Number.isInteger(statusId) || statusId < 0 || statusId > 9) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    const db = createServiceClient();
    const { error } = await db.rpc("record_sms_delivery", { p_provider_message_id: smsId, p_status_id: statusId });
    if (error) throw new Error(error.message);
  } catch (cause) {
    await logAppError({ source: "server", message: `uBill delivery report not saved: ${cause instanceof Error ? cause.message : "unknown"}`, path: "/api/webhooks/ubill" });
    // A 5xx lets uBill try again later.
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return new NextResponse("OK", { status: 200 });
}
