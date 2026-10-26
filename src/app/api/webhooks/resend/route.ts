import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAndParseResendWebhook } from "@/lib/webhook-processor";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-real-ip") ||
    (request as unknown as { ip?: string }).ip ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "webhook";

  const rawBody = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  let parsedEvent;
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
    }
    parsedEvent = verifyAndParseResendWebhook({
      rawBody,
      headers: { svixId, svixTimestamp, svixSignature },
      webhookSecret,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey || serviceRoleKey.length < 10) {
    return NextResponse.json(
      { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required" },
      { status: 500 }
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    if (!(await consumeServerRateLimit(supabase, `webhook:resend:${clientIp}`, 120, 60))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("process_email_webhook_event", {
    p_provider_message_id: parsedEvent.providerMessageId,
    p_event_type: parsedEvent.type,
    p_error_message: parsedEvent.errorMessage,
    p_raw_payload: parsedEvent.rawPayload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    event: parsedEvent.type,
    result: data,
  });
}
