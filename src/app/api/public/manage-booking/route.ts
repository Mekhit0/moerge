import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { getTrustedClientIp } from "@/lib/client-ip";
import { isPublicBookingDateAllowed } from "@/lib/validation";

const tokenSchema = z.string().uuid();
const actionSchema = z.object({
  token: z.string().uuid(),
  action: z.enum(["cancel", "reschedule"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

async function loadAppointment(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const { data } = await supabase.from("appointments")
    .select("id,salon_id,client_id,service_id,booking_code,treatment_date,treatment_time,starts_at,ends_at,status,service_name,staff_id,client:clients(full_name),staff:staff(full_name)")
    .eq("self_service_token", token).maybeSingle();
  if (!data) return null;
  const { data: settings } = await supabase.from("salon_settings")
    .select("salon_name,timezone,booking_cancel_deadline_hours,salon_phone")
    .eq("salon_id", data.salon_id).maybeSingle();
  const deadlineHours = settings?.booking_cancel_deadline_hours ?? 24;
  return {
    ...data,
    salon_name: settings?.salon_name ?? "moarge",
    salon_phone: settings?.salon_phone ?? null,
    timezone: settings?.timezone ?? "Asia/Tbilisi",
    can_manage: data.status === "scheduled" && Date.now() <= new Date(data.starts_at).getTime() - deadlineHours * 3600000,
    deadline_hours: deadlineHours,
  };
}

function publicView(appointment: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>) {
  // Internal ids stay on the server; the page only needs what it displays.
  const { id: _id, salon_id: _salonId, client_id: _clientId, service_id: _serviceId, staff_id: _staffId, ...rest } = appointment;
  return rest;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const token = tokenSchema.safeParse(params.get("token"));
  if (!token.success) return NextResponse.json({ error: "Invalid booking link." }, { status: 400 });
  const supabase = createServiceClient();
  if (!(await consumeServerRateLimit(supabase, `booking-manage:${getTrustedClientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const appointment = await loadAppointment(supabase, token.data);
  if (!appointment) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // With ?date=, also return the free times for the same service and specialist on that day.
  const date = params.get("date");
  if (date) {
    if (!appointment.can_manage) return NextResponse.json({ error: "The salon's change deadline has passed." }, { status: 410 });
    if (!isPublicBookingDateAllowed(date) || !appointment.service_id) {
      return NextResponse.json({ error: "Choose a date within the next 90 days." }, { status: 400 });
    }
    const { data: slots, error } = await supabase.rpc("get_available_slots", {
      p_salon_id: appointment.salon_id,
      p_service_id: appointment.service_id,
      p_date: date,
      p_staff_id: appointment.staff_id,
      p_exclude_appointment_id: appointment.id,
    });
    if (error) return NextResponse.json({ error: "Could not load free times." }, { status: 500 });
    const times = Array.from(new Set(((slots ?? []) as Array<{ slot_time: string }>)
      .map((slot) => String(slot.slot_time).slice(0, 5)))).sort();
    return NextResponse.json({ appointment: publicView(appointment), slots: times });
  }

  return NextResponse.json({ appointment: publicView(appointment) });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking update." }, { status: 400 });
  const supabase = createServiceClient();
  if (!(await consumeServerRateLimit(supabase, `booking-manage:${getTrustedClientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const appointment = await loadAppointment(supabase, parsed.data.token);
  if (!appointment) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!appointment.can_manage) return NextResponse.json({ error: "The salon's cancellation deadline has passed." }, { status: 410 });

  if (parsed.data.action === "cancel") {
    const { error } = await supabase.from("appointments").update({ status: "canceled" })
      .eq("id", appointment.id).eq("salon_id", appointment.salon_id).eq("status", "scheduled");
    if (error) return NextResponse.json({ error: "Could not cancel the booking." }, { status: 500 });
    return NextResponse.json({ success: true, status: "canceled" });
  }
  if (!parsed.data.date || !parsed.data.time) return NextResponse.json({ error: "Choose a new date and time." }, { status: 400 });
  if (!isPublicBookingDateAllowed(parsed.data.date)) return NextResponse.json({ error: "Choose a date within the next 90 days." }, { status: 400 });
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_salon_id: appointment.salon_id,
    p_appointment_id: appointment.id,
    p_date: parsed.data.date,
    p_start_time: `${parsed.data.time}:00`,
    p_staff_id: appointment.staff_id,
  });
  if (error) return NextResponse.json({ error: "Could not move the booking." }, { status: 500 });
  const result = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[] };
  if (!result?.success) return NextResponse.json({
    error: result?.error ?? "Could not reschedule.",
    available_slots: result?.available_slots ?? [],
  }, { status: result?.conflict ? 409 : 400 });
  return NextResponse.json({ success: true, status: "rescheduled" });
}
