import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import {
  createNotificationProvider,
  FakeNotificationProvider,
  processNotification,
  type NotificationJob,
} from "@/lib/notifications";

function timingSafeMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

async function processQueue(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!bearer || !timingSafeMatch(bearer, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server configuration error." }, { status: 500 });
  }

  const { error: billingError } = await supabase.rpc("process_billing_cycle");
  if (billingError) return NextResponse.json({ error: billingError.message }, { status: 500 });

  const { data, error } = await supabase.rpc("claim_due_notifications", { p_limit: 25 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appBaseUrl = getAppUrl();
  const jobs = (data ?? []) as Array<NotificationJob & { unsubscribe_token: string }>;
  const results = [];
  for (const row of jobs) {
    const job: NotificationJob = {
      ...row,
      unsubscribe_url: `${appBaseUrl}/unsubscribe?token=${encodeURIComponent(row.unsubscribe_token)}&channel=${row.channel}`,
    };
    const useFake = row.dry_run_mode || process.env.NOTIFICATION_PROVIDER === "fake";
    const provider = useFake ? new FakeNotificationProvider() : createNotificationProvider(row.channel);
    const result = await processNotification(job, provider);
    const { error: recordError } = await supabase.rpc("record_notification_result", {
      p_id: result.id,
      p_status: result.status,
      p_provider_message_id: result.providerMessageId,
      p_cost: result.cost,
      p_error: result.error,
      p_next_attempt_at: result.nextAttemptAt,
    });
    results.push({ ...result, recorded: !recordError });
  }
  return NextResponse.json({ ok: true, claimedCount: jobs.length, processed: results, timestamp: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return processQueue(request);
}

export async function POST(request: NextRequest) {
  return processQueue(request);
}
