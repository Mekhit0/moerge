import { NextRequest, NextResponse } from "next/server";
import { createAdminOrRpcSupabaseClient } from "@/lib/supabase/server";
import {
  parseResendPayloadObject,
  verifyAndParseResendWebhook,
} from "@/lib/webhook-processor";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "webhook";
  const rl = checkRateLimit(`webhook:resend:${clientIp}`, 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const rawBody = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  let parsedEvent;
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    const devBypassHeader = request.headers.get("x-dev-webhook-secret")?.trim();
    const cronSecret =
      process.env.CRON_SECRET || "lumiere-salon-cron-secret-2026-secure";

    // In local dev/testing without RESEND_WEBHOOK_SECRET, allow signed test simulation with x-dev-webhook-secret === CRON_SECRET
    if (!webhookSecret && devBypassHeader && devBypassHeader === cronSecret) {
      parsedEvent = parseResendPayloadObject(JSON.parse(rawBody));
    } else {
      parsedEvent = verifyAndParseResendWebhook({
        rawBody,
        headers: {
          svixId,
          svixTimestamp,
          svixSignature,
        },
        webhookSecret,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminOrRpcSupabaseClient();
  const { data, error } = await supabase.rpc("process_email_webhook_event", {
    p_cron_secret: "lumiere-salon-cron-secret-2026-secure",
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
