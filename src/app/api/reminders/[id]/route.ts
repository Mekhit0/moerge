import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
  getAuthenticatedSalonContext,
} from "@/lib/supabase/server";
import { isValidCalendarDate } from "@/lib/validation";
import {
  generateReminderIdempotencyKey,
  zonedDateTimeToUtc,
} from "@/lib/scheduling";
import {
  ClaimedReminderJob,
  createResendTransport,
  processClaimedReminder,
} from "@/lib/reminder-worker";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: reminder } = await ctx.supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (!reminder) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action as string | undefined;

  if (action === "cancel") {
    if (reminder.status !== "scheduled") {
      return NextResponse.json(
        { error: `Cannot cancel a reminder with status "${reminder.status}".` },
        { status: 400 }
      );
    }

    const reason =
      typeof body.cancel_reason === "string" && body.cancel_reason.trim()
        ? body.cancel_reason.trim()
        : "Canceled manually by salon staff";

    const { data: canceled, error } = await ctx.supabase
      .from("reminders")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: reason,
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("salon_id", ctx.salonId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder: canceled });
  }

  if (action === "reschedule") {
    if (!["scheduled", "failed", "canceled"].includes(reminder.status)) {
      return NextResponse.json(
        {
          error: `Cannot reschedule a reminder that is already "${reminder.status}".`,
        },
        { status: 400 }
      );
    }

    const newDate = String(body.scheduled_for_date ?? "").trim();
    if (!isValidCalendarDate(newDate)) {
      return NextResponse.json(
        { error: "Please provide a valid YYYY-MM-DD date to reschedule." },
        { status: 400 }
      );
    }

    const sendAtUtc = zonedDateTimeToUtc(
      newDate,
      ctx.settings.timezone || "UTC",
      9,
      0
    );
    const newIdempotencyKey = generateReminderIdempotencyKey(
      ctx.salonId,
      reminder.appointment_id,
      newDate
    );

    const { data: rescheduled, error } = await ctx.supabase
      .from("reminders")
      .update({
        scheduled_for_date: newDate,
        scheduled_send_at: sendAtUtc.toISOString(),
        status: "scheduled",
        idempotency_key: newIdempotencyKey,
        canceled_at: null,
        cancel_reason: null,
        failure_reason: null,
        is_permanent_failure: false,
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("salon_id", ctx.salonId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder: rescheduled });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

/**
 * POST /api/reminders/[id] -> Manual retry or immediate send for an eligible reminder
 * without creating duplicate reminder records.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`reminder:retry:${ctx.user.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying again." },
      { status: 429 }
    );
  }

  const { id } = await context.params;

  const { data: existing } = await ctx.supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  if (["sent", "delivered", "processing"].includes(existing.status)) {
    return NextResponse.json(
      {
        error: `Reminder is already "${existing.status}". Duplicate sends are blocked.`,
      },
      { status: 409 }
    );
  }

  if (existing.status === "bounced" || existing.is_permanent_failure) {
    return NextResponse.json(
      {
        error:
          "This reminder failed permanently (e.g., hard bounce or invalid recipient). Update the client's email address first.",
      },
      { status: 400 }
    );
  }

  // If max attempts was previously exhausted on a temporary failure, allow 1 manual retry
  if (existing.attempt_count >= existing.max_attempts) {
    await ctx.supabase
      .from("reminders")
      .update({
        max_attempts: existing.attempt_count + 1,
        status: "scheduled",
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("salon_id", ctx.salonId);
  }

  let adminClient;
  try {
    adminClient = createServiceClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Service client unavailable";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: claimedData, error: claimError } = await adminClient.rpc(
    "claim_due_reminders",
    {
      p_limit: 1,
      p_salon_id: ctx.salonId,
      p_specific_reminder_id: id,
    }
  );

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  const jobs = (claimedData ?? []) as ClaimedReminderJob[];
  if (jobs.length === 0) {
    return NextResponse.json(
      { error: "Reminder is not eligible for retry or is currently locked." },
      { status: 409 }
    );
  }

  const transport = createResendTransport();
  const result = await processClaimedReminder(jobs[0], { transport });

  await adminClient.rpc("record_reminder_send_result", {
    p_reminder_id: result.reminderId,
    p_outcome: result.outcome,
    p_provider_message_id: result.providerMessageId,
    p_recipient_email: result.recipientEmail,
    p_subject: result.subject,
    p_error_message: result.errorMessage,
    p_next_retry_at: result.nextRetryAtIso,
    p_status_code: result.statusCode,
    p_is_dry_run: result.isDryRun,
    p_raw_payload: {
      triggered_by: "manual_staff_retry",
      staff_user_id: ctx.user.id,
    },
  });

  const { data: updatedReminder } = await ctx.supabase
    .from("reminders")
    .select("*")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .single();

  return NextResponse.json({
    result,
    reminder: updatedReminder,
  });
}
