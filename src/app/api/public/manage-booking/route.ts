import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";

const tokenSchema = z.string().uuid();
const actionSchema = z.object({
  token: z.string().uuid(),
  action: z.enum(["cancel", "reschedule"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

async function loadAppointment(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const { data } = await supabase.from("appointments")
    .select("id,salon_id,client_id,treatment_date,treatment_time,starts_at,ends_at,status,service_name,staff_id,client:clients(full_name),staff:staff(full_name)")
    .eq("self_service_token", token).maybeSingle();
  if (!data) return null;
  const { data: settings } = await supabase.from("salon_settings")
    .select("salon_name,timezone,booking_cancel_deadline_hours")
    .eq("salon_id", data.salon_id).maybeSingle();
  const deadlineHours = settings?.booking_cancel_deadline_hours ?? 24;
  return {
    ...data,
    salon_name: settings?.salon_name ?? "moarge",
    timezone: settings?.timezone ?? "Asia/Tbilisi",
    can_manage: data.status === "scheduled" && Date.now() <= new Date(data.starts_at).getTime() - deadlineHours * 3600000,
    deadline_hours: deadlineHours,
  };
}

export async function GET(request: NextRequest) {
  const token = tokenSchema.safeParse(new URL(request.url).searchParams.get("token"));
  if (!token.success) return NextResponse.json({ error: "Invalid booking link." }, { status: 400 });
  const supabase = createServiceClient();
  if (!(await consumeServerRateLimit(supabase, `booking-manage:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const appointment = await loadAppointment(supabase, token.data);
  if (!appointment) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json({ appointment });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking update." }, { status: 400 });
  const supabase = createServiceClient();
  if (!(await consumeServerRateLimit(supabase, `booking-manage:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const appointment = await loadAppointment(supabase, parsed.data.token);
  if (!appointment) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!appointment.can_manage) return NextResponse.json({ error: "The salon's cancellation deadline has passed." }, { status: 410 });

  if (parsed.data.action === "cancel") {
    const { error } = await supabase.from("appointments").update({ status: "canceled" })
      .eq("id", appointment.id).eq("salon_id", appointment.salon_id).eq("status", "scheduled");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "canceled" });
  }
  if (!parsed.data.date || !parsed.data.time) return NextResponse.json({ error: "Choose a new date and time." }, { status: 400 });
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_salon_id: appointment.salon_id,
    p_appointment_id: appointment.id,
    p_date: parsed.data.date,
    p_start_time: `${parsed.data.time}:00`,
    p_staff_id: appointment.staff_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[] };
  if (!result?.success) return NextResponse.json({
    error: result?.error ?? "Could not reschedule.",
    available_slots: result?.available_slots ?? [],
  }, { status: result?.conflict ? 409 : 400 });
  return NextResponse.json({ success: true, status: "rescheduled" });
}
