import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { appointmentInputSchema, isEpilationTreatment } from "@/lib/validation";
import {
  addCalendarDays,
  evaluateSmartSlotAvailability,
  planReminderReconciliation,
} from "@/lib/scheduling";
import { Reminder } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: existingAppt, error: fetchErr } = await ctx.supabase
    .from("appointments")
    .select("*, client:clients(*), reminders(*)")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (fetchErr || !existingAppt) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mergedPayload = {
    client_id: (body.client_id as string | undefined) ?? existingAppt.client_id,
    treatment_date:
      (body.treatment_date as string | undefined) ?? existingAppt.treatment_date,
    treatment_time:
      (body.treatment_time as string | undefined) ?? existingAppt.treatment_time,
    treatment_type:
      (body.treatment_type as string | undefined) ?? existingAppt.treatment_type,
    status: (body.status as string | undefined) ?? existingAppt.status,
    notes: body.notes !== undefined ? body.notes : existingAppt.notes,
    service_id: body.service_id !== undefined ? body.service_id : existingAppt.service_id,
    service_name: body.service_name !== undefined ? body.service_name : existingAppt.service_name,
    price_gel: body.price_gel !== undefined ? body.price_gel : existingAppt.price_gel,
    duration_minutes: body.duration_minutes !== undefined ? body.duration_minutes : existingAppt.duration_minutes,
    is_epilation: body.is_epilation !== undefined ? body.is_epilation : existingAppt.is_epilation,
  };

  const parsed = appointmentInputSchema.safeParse(mergedPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid appointment update." },
      { status: 400 }
    );
  }

  // Resolve custom service metadata if present in salon catalog
  const customServices = Array.isArray(ctx.settings.custom_services)
    ? ctx.settings.custom_services
    : [];
  const matchedService = customServices.find(
    (s) =>
      s.id === parsed.data.service_id ||
      s.id === parsed.data.treatment_type ||
      s.type === parsed.data.treatment_type
  );

  const durationMinutes =
    parsed.data.duration_minutes ??
    matchedService?.duration_minutes ??
    existingAppt.duration_minutes ??
    45;

  const isEpilation =
    parsed.data.is_epilation !== undefined
      ? parsed.data.is_epilation
      : (matchedService?.is_epilation ?? isEpilationTreatment(parsed.data.treatment_type));

  const serviceId = parsed.data.service_id ?? matchedService?.id ?? existingAppt.service_id ?? null;
  const serviceName =
    parsed.data.service_name ??
    (matchedService ? (matchedService.name_ka || matchedService.name_en) : existingAppt.service_name ?? null);
  const priceGel = parsed.data.price_gel ?? matchedService?.price_gel ?? existingAppt.price_gel ?? null;

  const intervalDays = ctx.settings.reminder_interval_days || 21;
  const timeZone = ctx.settings.timezone || "Asia/Tbilisi";

  const nextExpectedDate =
    parsed.data.status === "completed" && isEpilation
      ? addCalendarDays(parsed.data.treatment_date, intervalDays)
      : null;

  const normalizedTime =
    parsed.data.treatment_time.length === 5
      ? `${parsed.data.treatment_time}:00`
      : parsed.data.treatment_time;

  // Smart availability conflict check when appointment is scheduled/completed and date or time changed
  const dateOrTimeChanged =
    parsed.data.treatment_date !== existingAppt.treatment_date ||
    normalizedTime.slice(0, 5) !== String(existingAppt.treatment_time).slice(0, 5);

  if (
    dateOrTimeChanged &&
    parsed.data.status !== "canceled" &&
    parsed.data.status !== "missed" &&
    !body.force_overlap
  ) {
    const { data: sameDayAppts } = await ctx.supabase
      .from("appointments")
      .select("id, treatment_time")
      .eq("salon_id", ctx.salonId)
      .eq("treatment_date", parsed.data.treatment_date)
      .neq("id", id)
      .in("status", ["scheduled", "completed"]);

    const bookedTimes = (sameDayAppts ?? []).map((a) => String(a.treatment_time));
    const check = evaluateSmartSlotAvailability(normalizedTime, bookedTimes, durationMinutes);
    if (!check.isAvailable) {
      return NextResponse.json(
        {
          conflict: true,
          conflicting_time: check.conflictingTime,
          available_slots: check.availableSlots,
          error: `Time slot ${normalizedTime.slice(0, 5)} is unavailable (conflicts with ${check.conflictingTime} appointment). Suggested free slots: ${check.availableSlots.join(", ") || "none"}.`,
          error_ka: `დრო ${normalizedTime.slice(0, 5)} დაკავებულია (ემთხვევა ${check.conflictingTime} ჯავშანს). თავისუფალი საათებია: ${check.availableSlots.join(", ") || "არ არის"}.`,
        },
        { status: 409 }
      );
    }
  }

  const { data: updatedAppt, error: updateErr } = await ctx.supabase
    .from("appointments")
    .update({
      treatment_date: parsed.data.treatment_date,
      treatment_time: normalizedTime,
      treatment_type: parsed.data.treatment_type,
      is_epilation: isEpilation,
      status: parsed.data.status,
      completed_at:
        parsed.data.status === "completed"
          ? existingAppt.completed_at ?? new Date().toISOString()
          : null,
      next_expected_date: nextExpectedDate,
      notes: parsed.data.notes,
      service_id: serviceId,
      service_name: serviceName,
      price_gel: priceGel,
      duration_minutes: durationMinutes,
    })
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .select("*")
    .single();

  if (updateErr || !updatedAppt) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Failed to update appointment." },
      { status: 500 }
    );
  }

  const client = existingAppt.client;
  const existingReminders = (existingAppt.reminders ?? []) as Reminder[];

  // Reconcile reminder so editing/rescheduling/canceling never creates duplicates
  const reconciliation = planReminderReconciliation({
    salonId: ctx.salonId,
    appointmentId: updatedAppt.id,
    treatmentDate: updatedAppt.treatment_date,
    treatmentType: updatedAppt.treatment_type,
    status: updatedAppt.status,
    client: {
      is_archived: client?.is_archived ?? false,
      email_consent: client?.email_consent ?? true,
      unsubscribed_at: client?.unsubscribed_at ?? null,
    },
    existingReminders,
    intervalDays,
    timeZone,
  });

  if (reconciliation.action === "create") {
    const { data: newRem } = await ctx.supabase
      .from("reminders")
      .insert({
        salon_id: ctx.salonId,
        client_id: updatedAppt.client_id,
        appointment_id: updatedAppt.id,
        scheduled_for_date: reconciliation.scheduledForDate,
        scheduled_send_at: reconciliation.scheduledSendAtIso,
        status: "scheduled",
        idempotency_key: reconciliation.idempotencyKey,
        attempt_count: 0,
        max_attempts: 3,
      })
      .select("*")
      .maybeSingle();

    if (newRem && client) {
      await ctx.supabase.from("email_logs").insert({
        salon_id: ctx.salonId,
        reminder_id: newRem.id,
        client_id: client.id,
        appointment_id: updatedAppt.id,
        recipient_email: client.email,
        subject: ctx.settings.email_subject,
        event_type: "scheduled",
        idempotency_key: reconciliation.idempotencyKey,
        attempt_number: 0,
        status_code: 200,
        is_dry_run: ctx.settings.dry_run_mode,
      });
    }
  } else if (reconciliation.action === "update_existing") {
    await ctx.supabase
      .from("reminders")
      .update({
        scheduled_for_date: reconciliation.scheduledForDate,
        scheduled_send_at: reconciliation.scheduledSendAtIso,
        idempotency_key: reconciliation.idempotencyKey,
        next_retry_at: null,
        failure_reason: null,
      })
      .eq("id", reconciliation.reminderId)
      .eq("salon_id", ctx.salonId);
  } else if (reconciliation.action === "cancel_existing") {
    await ctx.supabase
      .from("reminders")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: reconciliation.cancelReason,
      })
      .eq("id", reconciliation.reminderId)
      .eq("salon_id", ctx.salonId);
  }

  // Update client's next expected date if completed epilation
  if (parsed.data.status === "completed" && isEpilation && nextExpectedDate) {
    await ctx.supabase
      .from("clients")
      .update({
        last_completed_epilation_date: parsed.data.treatment_date,
        next_expected_appointment_date: nextExpectedDate,
      })
      .eq("id", updatedAppt.client_id)
      .eq("salon_id", ctx.salonId);
  }

  const { data: refreshed } = await ctx.supabase
    .from("appointments")
    .select("*, client:clients(id, full_name, email, phone, is_archived, email_consent), reminders(*)")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .single();

  return NextResponse.json({
    appointment: refreshed ?? updatedAppt,
    reconciliation,
  });
}
