import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { appointmentInputSchema, clientInputSchema } from "@/lib/validation";
import { addCalendarDays, planReminderReconciliation } from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  let query = ctx.supabase.from("appointments").select("*, client:clients(*), staff:staff(id,full_name,color), reminders(*)")
    .eq("salon_id", ctx.salonId).order("starts_at", { ascending: true });
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  if (status && status !== "all") query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 }); }
  if (typeof body.new_client === "object" && body.new_client !== null && !body.client_id) {
    const newClient = clientInputSchema.safeParse(body.new_client);
    if (!newClient.success) return NextResponse.json({ error: newClient.error.issues[0]?.message ?? "Invalid new client details." }, { status: 400 });
    const normalizedEmail = newClient.data.email.toLowerCase();
    const { data: existing } = await ctx.supabase.from("clients").select("id").eq("salon_id", ctx.salonId).ilike("email", normalizedEmail).maybeSingle();
    if (existing) body.client_id = existing.id;
    else {
      const { data: created, error: createError } = await ctx.supabase.from("clients").insert({
        salon_id: ctx.salonId, full_name: newClient.data.full_name, email: normalizedEmail,
        phone: newClient.data.phone, notes: newClient.data.notes,
        email_consent: newClient.data.email_consent, created_by: ctx.user.id,
      }).select("id").single();
      if (createError || !created) return NextResponse.json({ error: createError?.message ?? "Failed to create client." }, { status: 500 });
      body.client_id = created.id;
    }
  }
  const parsed = appointmentInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid appointment data." }, { status: 400 });

  const wantedId = parsed.data.service_id ?? parsed.data.treatment_type;
  const { data: services } = await ctx.supabase.from("services")
    .select("id,legacy_id,name_ka,name_en,price_gel,duration_minutes,recall_days")
    .eq("salon_id", ctx.salonId).eq("is_active", true);
  const service = services?.find((item) => item.id === wantedId || item.legacy_id === wantedId || item.legacy_id === parsed.data.treatment_type);
  if (!service) return NextResponse.json({ error: "Please choose an active service." }, { status: 400 });
  const time = parsed.data.treatment_time.length === 5 ? `${parsed.data.treatment_time}:00` : parsed.data.treatment_time;
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("create_appointment", {
    p_salon_id: ctx.salonId,
    p_service_id: service.id,
    p_date: parsed.data.treatment_date,
    p_start_time: time,
    p_staff_id: typeof body.staff_id === "string" ? body.staff_id : null,
    p_client_id: parsed.data.client_id,
    p_full_name: null,
    p_phone: null,
    p_email: null,
    p_notes: parsed.data.notes ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[]; appointment_id?: string };
  if (!result?.success) return NextResponse.json({ conflict: result?.conflict, error: result?.error, available_slots: result?.available_slots ?? [] }, { status: result?.conflict ? 409 : 400 });
  let nextExpectedDate: string | null = null;
  if (parsed.data.status !== "scheduled") {
    const interval = service.recall_days ?? ctx.settings.reminder_interval_days;
    if (parsed.data.status === "completed" && service.recall_days !== null) nextExpectedDate = addCalendarDays(parsed.data.treatment_date, interval);
    const { error: statusError } = await serviceClient.from("appointments").update({
      status: parsed.data.status,
      arrived_at: parsed.data.status === "arrived" ? new Date().toISOString() : null,
      completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
      next_expected_date: nextExpectedDate,
    }).eq("id", result.appointment_id).eq("salon_id", ctx.salonId);
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
  }
  const { data: appointment, error: loadError } = await ctx.supabase.from("appointments")
    .select("*, client:clients(*), staff:staff(id,full_name,color), reminders(*)")
    .eq("id", result.appointment_id).eq("salon_id", ctx.salonId).single();
  if (loadError || !appointment) return NextResponse.json({ error: "Appointment created but could not be loaded." }, { status: 500 });
  let reminder = null;
  if (appointment.status === "completed" && service.recall_days !== null && appointment.client) {
    const client = appointment.client as { is_archived: boolean; email_consent: boolean; unsubscribed_at: string | null; id: string; email: string | null };
    const intervalDays = service.recall_days ?? ctx.settings.reminder_interval_days;
    const reconciliation = planReminderReconciliation({
      salonId: ctx.salonId, appointmentId: appointment.id, treatmentDate: appointment.treatment_date,
      treatmentType: appointment.treatment_type, status: appointment.status,
      client: { is_archived: client.is_archived, email_consent: client.email_consent, unsubscribed_at: client.unsubscribed_at },
      existingReminders: [], intervalDays, timeZone: ctx.settings.timezone || "Asia/Tbilisi",
    });
    if (reconciliation.action === "create") {
      const { data: created } = await ctx.supabase.from("reminders").insert({
        salon_id: ctx.salonId, client_id: appointment.client_id, appointment_id: appointment.id,
        scheduled_for_date: reconciliation.scheduledForDate, scheduled_send_at: reconciliation.scheduledSendAtIso,
        status: "scheduled", idempotency_key: reconciliation.idempotencyKey, attempt_count: 0, max_attempts: 3,
      }).select("*").maybeSingle();
      reminder = created;
    }
    if (nextExpectedDate) await ctx.supabase.from("clients").update({ last_completed_epilation_date: appointment.treatment_date, next_expected_appointment_date: nextExpectedDate }).eq("id", client.id).eq("salon_id", ctx.salonId);
  }
  return NextResponse.json({ appointment: { ...appointment, reminders: reminder ? [reminder] : appointment.reminders }, client_created: Boolean(body.new_client), reminder }, { status: 201 });
}
