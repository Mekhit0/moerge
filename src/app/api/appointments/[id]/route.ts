import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
import { appointmentInputSchema } from "@/lib/validation";
import { addCalendarDays } from "@/lib/scheduling";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });

  const { id } = await context.params;

  const { data: existingAppt, error: fetchErr } = await ctx.supabase
    .from("appointments")
    .select("*, client:clients(*)")
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

  // A paid visit stays done until its payment is undone (same rule as the visit status endpoint).
  if (existingAppt.status === "completed" && parsed.data.status !== "completed") {
    const { count: activePayments } = await ctx.supabase.from("visit_payments").select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId).eq("appointment_id", id).is("voided_at", null);
    if ((activePayments ?? 0) > 0) {
      return NextResponse.json({ error: "ვიზიტი უკვე გადახდილია. ჯერ გააუქმეთ გადახდა. / This visit is paid. Undo the payment first." }, { status: 409 });
    }
  }

  const wantedService = parsed.data.service_id ?? existingAppt.service_id;
  const { data: salonServices } = await ctx.supabase.from("services").select("id,legacy_id,name_ka,name_en,price_gel,duration_minutes,recall_days").eq("salon_id", ctx.salonId);
  const matchedService = salonServices?.find((service) => service.id === wantedService || service.legacy_id === wantedService || service.legacy_id === parsed.data.treatment_type);

  const durationMinutes = matchedService?.duration_minutes ?? existingAppt.duration_minutes ?? 45;
  const isEpilation = matchedService?.recall_days !== null && matchedService?.recall_days !== undefined;

  let serviceId = matchedService?.id ?? parsed.data.service_id ?? existingAppt.service_id ?? null;
  if (serviceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serviceId)) {
    const { data: relationalService } = await ctx.supabase.from("services").select("id").eq("salon_id", ctx.salonId).eq("legacy_id", serviceId).maybeSingle();
    if (relationalService) serviceId = relationalService.id;
  }
  const serviceName = matchedService?.name_en ?? existingAppt.service_name ?? null;
  const priceGel = matchedService?.price_gel ?? existingAppt.price_gel ?? null;

  const intervalDays =
    matchedService?.recall_days ?? ctx.settings.reminder_interval_days ?? 21;
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

  if (dateOrTimeChanged || (typeof body.staff_id === "string" && body.staff_id !== existingAppt.staff_id)) {
    let existingServiceId = existingAppt.service_id;
    if (existingServiceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingServiceId)) {
      const { data: relationalExisting } = await ctx.supabase.from("services").select("id").eq("salon_id", ctx.salonId).eq("legacy_id", existingServiceId).maybeSingle();
      existingServiceId = relationalExisting?.id ?? existingServiceId;
    }
    if (serviceId !== existingServiceId) {
      return NextResponse.json({ error: "Changing a booked service requires creating a new appointment." }, { status: 400 });
    }
    const serviceClient = createServiceClient();
    const { data: rescheduled, error: scheduleError } = await serviceClient.rpc("reschedule_appointment", {
      p_salon_id: ctx.salonId,
      p_appointment_id: id,
      p_date: parsed.data.treatment_date,
      p_start_time: normalizedTime,
      p_staff_id: typeof body.staff_id === "string" ? body.staff_id : existingAppt.staff_id,
    });
    if (scheduleError) return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    const outcome = rescheduled as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[] };
    if (!outcome?.success) return NextResponse.json({ conflict: outcome?.conflict, error: outcome?.error, available_slots: outcome?.available_slots ?? [] }, { status: outcome?.conflict ? 409 : 400 });
  }

  const { data: updatedAppt, error: updateErr } = await ctx.supabase
    .from("appointments")
    .update({
      treatment_date: parsed.data.treatment_date,
      treatment_time: normalizedTime,
      treatment_type: parsed.data.treatment_type,
      is_epilation: isEpilation,
      status: parsed.data.status,
      arrived_at: parsed.data.status === "arrived" ? existingAppt.arrived_at ?? new Date().toISOString() : null,
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

  if (parsed.data.status === "completed" && matchedService?.recall_days !== null && matchedService?.recall_days !== undefined && nextExpectedDate) {
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
    .select("*, client:clients(id, full_name, email, phone, is_archived, email_consent, sms_consent)")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .single();

  return NextResponse.json({
    appointment: refreshed ?? updatedAppt,
  });
}
