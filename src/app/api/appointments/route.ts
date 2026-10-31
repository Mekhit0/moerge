import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
import { appointmentInputSchema, clientInputSchema } from "@/lib/validation";
import { addCalendarDays } from "@/lib/scheduling";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !datePattern.test(from)) || (to && !datePattern.test(to)) || (from && to && (to < from || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 30))) {
    return NextResponse.json({ error: "Choose a valid date range of 31 days or less." }, { status: 400 });
  }
  let query = ctx.supabase.from("appointments")
    .select("*, client:clients(*), staff:staff(id,full_name,color)")
    .eq("salon_id", ctx.salonId).order("starts_at", { ascending: true });
  if (from) query = query.gte("treatment_date", from);
  if (to) query = query.lte("treatment_date", to);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  if (status && status !== "all") query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query.limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 }); }

  let clientCreated = false;
  if (typeof body.new_client === "object" && body.new_client !== null && !body.client_id) {
    const parsedClient = clientInputSchema.safeParse(body.new_client);
    if (!parsedClient.success) return NextResponse.json({ error: parsedClient.error.issues[0]?.message ?? "Invalid new client details." }, { status: 400 });
    const client = parsedClient.data;
    const { data: existing } = await ctx.supabase.from("clients").select("id")
      .eq("salon_id", ctx.salonId).eq("normalized_phone", client.phone).maybeSingle();
    if (existing) body.client_id = existing.id;
    else {
      const { data: created, error } = await ctx.supabase.from("clients").insert({
        salon_id: ctx.salonId, full_name: client.full_name, email: client.email,
        phone: client.phone, notes: client.notes, email_consent: client.email_consent,
        sms_consent: client.sms_consent, preferred_language: client.preferred_language,
        unsubscribed_at: client.email_consent ? null : new Date().toISOString(),
        sms_unsubscribed_at: client.sms_consent ? null : new Date().toISOString(),
        created_by: ctx.user.id,
      }).select("id").single();
      if (error || !created) return NextResponse.json({ error: error?.message ?? "Could not create client." }, { status: error?.code === "23505" ? 409 : 500 });
      body.client_id = created.id;
      clientCreated = true;
    }
  }
  const parsed = appointmentInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid appointment data." }, { status: 400 });
  const { data: services } = await ctx.supabase.from("services")
    .select("id,legacy_id,recall_days").eq("salon_id", ctx.salonId).eq("is_active", true);
  const service = services?.find((item) =>
    item.id === parsed.data.service_id || item.legacy_id === parsed.data.treatment_type
  );
  if (!service) return NextResponse.json({ error: "Please choose an active service." }, { status: 400 });

  const serviceClient = createServiceClient();
  const startTime = parsed.data.treatment_time.length === 5 ? `${parsed.data.treatment_time}:00` : parsed.data.treatment_time;
  const { data: created, error } = await serviceClient.rpc("create_appointment", {
    p_salon_id: ctx.salonId, p_service_id: service.id, p_date: parsed.data.treatment_date,
    p_start_time: startTime, p_staff_id: typeof body.staff_id === "string" ? body.staff_id : null,
    p_client_id: parsed.data.client_id, p_notes: parsed.data.notes ?? null,
    p_email_consent: false, p_sms_consent: false, p_language: "ka",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const outcome = created as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[]; appointment_id?: string };
  if (!outcome?.success) return NextResponse.json({
    conflict: outcome?.conflict, error: outcome?.error, available_slots: outcome?.available_slots ?? [],
  }, { status: outcome?.conflict ? 409 : 400 });

  let nextExpectedDate: string | null = null;
  if (parsed.data.status !== "scheduled") {
    if (parsed.data.status === "completed" && service.recall_days !== null) {
      nextExpectedDate = addCalendarDays(parsed.data.treatment_date, service.recall_days ?? 0);
    }
    const now = new Date().toISOString();
    const { error: statusError } = await serviceClient.from("appointments").update({
      status: parsed.data.status,
      arrived_at: parsed.data.status === "arrived" ? now : null,
      completed_at: parsed.data.status === "completed" ? now : null,
      next_expected_date: nextExpectedDate,
    }).eq("id", outcome.appointment_id).eq("salon_id", ctx.salonId);
    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });
  }
  if (nextExpectedDate) {
    await serviceClient.from("clients").update({
      last_completed_epilation_date: parsed.data.treatment_date,
      next_expected_appointment_date: nextExpectedDate,
    }).eq("id", parsed.data.client_id).eq("salon_id", ctx.salonId);
  }
  const { data: appointment, error: loadError } = await ctx.supabase.from("appointments")
    .select("*, client:clients(*), staff:staff(id,full_name,color)")
    .eq("id", outcome.appointment_id).eq("salon_id", ctx.salonId).single();
  if (loadError || !appointment) return NextResponse.json({ error: "Appointment created but could not be loaded." }, { status: 500 });
  return NextResponse.json({ appointment, client_created: clientCreated }, { status: 201 });
}
