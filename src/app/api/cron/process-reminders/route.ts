import { NextRequest, NextResponse } from "next/server";
import {
  createAdminOrRpcSupabaseClient,
  getAuthenticatedSalonContext,
} from "@/lib/supabase/server";
import {
  ClaimedReminderJob,
  createResendTransport,
  processClaimedReminder,
} from "@/lib/reminder-worker";

async function handleProcessDueReminders(request: NextRequest) {
  const configuredSecret =
    process.env.CRON_SECRET || "lumiere-salon-cron-secret-2026-secure";
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let isCronAuthenticated =
    bearerToken.length > 0 && bearerToken === configuredSecret;
  let targetSalonId: string | null = null;

  // Also allow authenticated salon staff to trigger due reminders for their own salon
  if (!isCronAuthenticated) {
    const staffCtx = await getAuthenticatedSalonContext();
    if (staffCtx) {
      isCronAuthenticated = true;
      targetSalonId = staffCtx.salonId;
    }
  }

  if (!isCronAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized cron invocation." },
      { status: 401 }
    );
  }

  const supabase = createAdminOrRpcSupabaseClient();

  const { data: claimedData, error: claimError } = await supabase.rpc(
    "claim_due_reminders",
    {
      p_cron_secret: "lumiere-salon-cron-secret-2026-secure",
      p_limit: 25,
      p_salon_id: targetSalonId,
      p_specific_reminder_id: null,
    }
  );

  if (claimError) {
    return NextResponse.json(
      { error: `Failed to claim due reminders: ${claimError.message}` },
      { status: 500 }
    );
  }

  const jobs = (claimedData ?? []) as ClaimedReminderJob[];
  const processedResults = [];

  for (const job of jobs) {
    const transport = createResendTransport(
      job.resend_api_key ?? process.env.RESEND_API_KEY
    );
    const res = await processClaimedReminder(job, { transport });

    await supabase.rpc("record_reminder_send_result", {
      p_cron_secret: "lumiere-salon-cron-secret-2026-secure",
      p_reminder_id: res.reminderId,
      p_outcome: res.outcome,
      p_provider_message_id: res.providerMessageId,
      p_recipient_email: res.recipientEmail,
      p_subject: res.subject,
      p_error_message: res.errorMessage,
      p_next_retry_at: res.nextRetryAtIso,
      p_status_code: res.statusCode,
      p_is_dry_run: res.isDryRun,
      p_raw_payload: {
        processed_at: new Date().toISOString(),
        attempt_count: job.attempt_count,
      },
    });

    processedResults.push(res);
  }

  return NextResponse.json({
    ok: true,
    claimedCount: jobs.length,
    processed: processedResults,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return handleProcessDueReminders(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDueReminders(request);
}
