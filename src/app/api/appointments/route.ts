import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import {
  appointmentInputSchema,
  clientInputSchema,
  isEpilationTreatment,
} from "@/lib/validation";
import {
  addCalendarDays,
  evaluateSmartSlotAvailability,
  generateDynamicTimeSlots,
  planReminderReconciliation,
} from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "all";
  const clientId = searchParams.get("clientId");

  let query = ctx.supabase
    .from("appointments")
    .select(
      `
      *,
      client:clients(id, full_name, email, phone, is_archived, email_consent),
      reminders(*)
    `
    )
    .eq("salon_id", ctx.salonId)
    .order("treatment_date", { ascending: false })
    .order("treatment_time", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  // Support inline quick-add client creation directly from the Appointment modal
  let resolvedClientId =
    typeof body.client_id === "string" ? body.client_id : "";

  if (!resolvedClientId && body.new_client && typeof body.new_client === "object") {
    const newClientParsed = clientInputSchema.safeParse(body.new_client);
    if (!newClientParsed.success) {
      return NextResponse.json(
        {
          error:
            newClientParsed.error.issues[0]?.message ??
            "კლიენტის მონაცემები არასწორია / Invalid new client details.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = newClientParsed.data.email.trim().toLowerCase();

    // Check if client with this email already exists in this salon
    const { data: existingClient } = await ctx.supabase
      .from("clients")
      .select("*")
      .eq("salon_id", ctx.salonId)
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingClient) {
      resolvedClientId = existingClient.id;
      if (existingClient.is_archived) {
        await ctx.supabase
          .from("clients")
          .update({ is_archived: false })
          .eq("id", existingClient.id);
      }
    } else {
      const { data: createdClient, error: createClientErr } = await ctx.supabase
        .from("clients")
        .insert({
          salon_id: ctx.salonId,
          full_name: newClientParsed.data.full_name,
          email: normalizedEmail,
          phone: newClientParsed.data.phone,
          notes: newClientParsed.data.notes,
          email_consent: newClientParsed.data.email_consent,
          unsubscribed_at: newClientParsed.data.email_consent
            ? null
            : new Date().toISOString(),
          created_by: ctx.user.id,
        })
        .select("*")
        .single();

      if (createClientErr || !createdClient) {
        return NextResponse.json(
          {
            error:
              createClientErr?.message ??
              "ახალი კლიენტის შექმნა ვერ მოხერხდა / Failed to create client.",
          },
          { status: 500 }
        );
      }
      resolvedClientId = createdClient.id;
    }
  }

  const parsed = appointmentInputSchema.safeParse({
    ...body,
    client_id: resolvedClientId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid appointment data.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  // Verify the client belongs to this salon
  const { data: client, error: clientErr } = await ctx.supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (clientErr || !client) {
    return NextResponse.json(
      { error: "Selected client does not exist in your salon." },
      { status: 404 }
    );
  }

  // Resolve custom service details if present in salon catalog
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
    45;

  const isEpilation =
    parsed.data.is_epilation !== undefined
      ? parsed.data.is_epilation
      : (matchedService?.is_epilation ?? isEpilationTreatment(parsed.data.treatment_type));

  const serviceId = parsed.data.service_id ?? matchedService?.id ?? null;
  const serviceName =
    parsed.data.service_name ??
    (matchedService ? (matchedService.name_ka || matchedService.name_en) : null);
  const priceGel = parsed.data.price_gel ?? matchedService?.price_gel ?? null;

  // Smart slot conflict check on the same date with dynamic duration
  if (
    ["scheduled", "completed"].includes(parsed.data.status) &&
    body.force_overlap !== true
  ) {
    const { data: sameDayAppts } = await ctx.supabase
      .from("appointments")
      .select("id, treatment_time, status")
      .eq("salon_id", ctx.salonId)
      .eq("treatment_date", parsed.data.treatment_date)
      .in("status", ["scheduled", "completed"]);

    const bookedTimes = (sameDayAppts ?? []).map((a) =>
      String(a.treatment_time).slice(0, 5)
    );
    const candidateSlots = generateDynamicTimeSlots(
      ctx.settings.working_hours_start || "10:00",
      ctx.settings.working_hours_end || "20:00",
      ctx.settings.slot_interval_minutes || 60
    );
    const evalSlot = evaluateSmartSlotAvailability(
      parsed.data.treatment_time,
      bookedTimes,
      durationMinutes,
      candidateSlots
    );

    if (!evalSlot.isAvailable) {
      return NextResponse.json(
        {
          conflict: true,
          conflicting_time: evalSlot.conflictingTime,
          available_slots: evalSlot.availableSlots,
          error: `Time ${evalSlot.requestedTime} on ${parsed.data.treatment_date} is unavailable (conflicts with ${evalSlot.conflictingTime} booking). Suggested free times: ${evalSlot.availableSlots.join(", ") || "none"}.`,
          error_ka: `დრო ${evalSlot.requestedTime} (${parsed.data.treatment_date}) დაკავებულია (ემთხვევა ${evalSlot.conflictingTime}-ის ჯავშანს). თავისუფალი დროები: ${evalSlot.availableSlots.join(", ") || "არ არის"}.`,
        },
        { status: 409 }
      );
    }
  }

  const intervalDays =
    matchedService?.reminder_days ?? ctx.settings.reminder_interval_days ?? 21;
  const timeZone = ctx.settings.timezone || "Asia/Tbilisi";

  const nextExpectedDate =
    parsed.data.status === "completed" && isEpilation
      ? addCalendarDays(parsed.data.treatment_date, intervalDays)
      : null;

  const normalizedTime =
    parsed.data.treatment_time.length === 5
      ? `${parsed.data.treatment_time}:00`
      : parsed.data.treatment_time;

  const { data: appointment, error: apptErr } = await ctx.supabase
    .from("appointments")
    .insert({
      salon_id: ctx.salonId,
      client_id: client.id,
      treatment_date: parsed.data.treatment_date,
      treatment_time: normalizedTime,
      treatment_type: parsed.data.treatment_type,
      is_epilation: isEpilation,
      status: parsed.data.status,
      completed_at:
        parsed.data.status === "completed" ? new Date().toISOString() : null,
      next_expected_date: nextExpectedDate,
      notes: parsed.data.notes,
      created_by: ctx.user.id,
      service_id: serviceId,
      service_name: serviceName,
      price_gel: priceGel,
      duration_minutes: durationMinutes,
    })
    .select("*")
    .single();

  if (apptErr || !appointment) {
    return NextResponse.json(
      { error: apptErr?.message ?? "Failed to create appointment." },
      { status: 500 }
    );
  }

  // Reconcile 21-day reminder if appointment was created as completed
  const reconciliation = planReminderReconciliation({
    salonId: ctx.salonId,
    appointmentId: appointment.id,
    treatmentDate: appointment.treatment_date,
    treatmentType: appointment.treatment_type,
    status: appointment.status,
    client: {
      is_archived: client.is_archived,
      email_consent: client.email_consent,
      unsubscribed_at: client.unsubscribed_at,
    },
    existingReminders: [],
    intervalDays,
    timeZone,
  });

  let createdReminder = null;

  if (reconciliation.action === "create") {
    const { data: rem } = await ctx.supabase
      .from("reminders")
      .insert({
        salon_id: ctx.salonId,
        client_id: client.id,
        appointment_id: appointment.id,
        scheduled_for_date: reconciliation.scheduledForDate,
        scheduled_send_at: reconciliation.scheduledSendAtIso,
        status: "scheduled",
        idempotency_key: reconciliation.idempotencyKey,
        attempt_count: 0,
        max_attempts: 3,
      })
      .select("*")
      .single();

    createdReminder = rem;

    if (rem) {
      await ctx.supabase.from("email_logs").insert({
        salon_id: ctx.salonId,
        reminder_id: rem.id,
        client_id: client.id,
        appointment_id: appointment.id,
        recipient_email: client.email,
        subject: ctx.settings.email_subject,
        event_type: "scheduled",
        idempotency_key: reconciliation.idempotencyKey,
        attempt_number: 0,
        status_code: 200,
        is_dry_run: ctx.settings.dry_run_mode,
      });
    }
  }

  // Update client's last completed epilation date & next expected appointment date
  if (parsed.data.status === "completed" && isEpilation && nextExpectedDate) {
    await ctx.supabase
      .from("clients")
      .update({
        last_completed_epilation_date: parsed.data.treatment_date,
        next_expected_appointment_date: nextExpectedDate,
      })
      .eq("id", client.id)
      .eq("salon_id", ctx.salonId);
  }

  return NextResponse.json(
    {
      appointment: {
        ...appointment,
        client,
        reminders: createdReminder ? [createdReminder] : [],
      },
      client_created: Boolean(body.new_client),
      reminder: createdReminder,
      reconciliation,
    },
    { status: 201 }
  );
}
