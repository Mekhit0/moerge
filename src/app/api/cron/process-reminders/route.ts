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
import { logAppError } from "@/lib/error-log";
import { sendErrorDigest } from "@/lib/error-alert";
import { UBILL_LOW_BALANCE, ubillBalance } from "@/lib/sms";

// Vercel's free plan allows up to 60 seconds; stop claiming new work well before that.
export const maxDuration = 60;
const BATCH_SIZE = 25;
const TIME_BUDGET_MS = 40_000;

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
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  // Supabase's scheduler calls every 10 minutes for messages; billing stays on Vercel's daily run.
  const body = await request.json().catch(() => null) as { source?: string } | null;
  const frequentRun = body?.source === "supabase_pg_cron";
  if (!frequentRun) {
    const { error: billingError } = await supabase.rpc("process_billing_cycle");
    if (billingError) {
      await logAppError({ source: "cron", message: `Billing cycle failed: ${billingError.message}`, path: "/api/cron/process-reminders" });
      return NextResponse.json({ error: "Billing cycle failed." }, { status: 500 });
    }
  }

  // Work through the queue in batches until it is empty or the time budget is used up.
  const appBaseUrl = getAppUrl();
  const startedAt = Date.now();
  const counts: Record<string, number> = {};
  let claimed = 0;
  let unrecorded = 0;
  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data, error } = await supabase.rpc("claim_due_notifications", { p_limit: BATCH_SIZE });
    if (error) {
      await logAppError({ source: "cron", message: `Message queue failed: ${error.message}`, path: "/api/cron/process-reminders" });
      return NextResponse.json({ error: "Could not read the message queue.", claimed, counts }, { status: 500 });
    }
    const jobs = (data ?? []) as Array<NotificationJob & { unsubscribe_token: string }>;
    claimed += jobs.length;
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
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      if (recordError) unrecorded += 1;
    }
    if (jobs.length < BATCH_SIZE) break;
  }
  if (unrecorded > 0) {
    await logAppError({ source: "cron", message: `${unrecorded} message results could not be saved`, path: "/api/cron/process-reminders" });
  }
  // Once a day: a low uBill balance goes into the error log, so the owner gets the hourly alert email.
  if (!frequentRun && process.env.UBILL_API_KEY) {
    const left = await ubillBalance().catch(() => null);
    if (left === null) await logAppError({ source: "cron", message: "Could not read the uBill SMS balance", path: "/api/cron/process-reminders" });
    else if (left < UBILL_LOW_BALANCE) await logAppError({ source: "cron", message: `uBill SMS balance is low: ${left} SMS left. Top up at my.ubill.ge`, path: "/api/cron/process-reminders" });
  }
  // Errors from the whole app: at most one email an hour to the platform owner.
  const alerted = await sendErrorDigest(supabase).catch(() => 0);
  return NextResponse.json({ ok: true, claimed, counts, unrecorded, alerted, timestamp: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  return processQueue(request);
}

export async function POST(request: NextRequest) {
  return processQueue(request);
}
