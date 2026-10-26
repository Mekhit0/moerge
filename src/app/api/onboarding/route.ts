import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { BILLING_CONFIG } from "@/lib/billing-plans";

const schema = z.object({
  salonName: z.string().trim().min(2).max(120),
  salonPhone: z.string().trim().min(7).max(40),
  salonAddress: z.string().trim().max(240).optional().default(""),
  timezone: z.string().trim().min(1).max(80),
  services: z.array(z.object({
    name_ka: z.string().trim().min(2).max(100),
    name_en: z.string().trim().min(2).max(100),
    price_gel: z.number().min(0).max(10000),
    duration_minutes: z.number().int().min(5).max(720),
    category: z.string().trim().min(1).max(80),
  })).min(1).max(30),
  staffNames: z.array(z.string().trim().min(2).max(120)).min(1).max(20),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine((value) => value.closeTime > value.openTime, {
  path: ["closeTime"], message: "Closing time must be after opening time.",
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ctx.settings.onboarding_completed_at) return NextResponse.json({ error: "Setup is already complete." }, { status: 409 });

  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid setup details." }, { status: 400 });

  const admin = createServiceClient();
  const { count: appointmentCount, error: appointmentError } = await admin.from("appointments")
    .select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId);
  if (appointmentError) return NextResponse.json({ error: "Could not verify salon setup status." }, { status: 500 });
  if ((appointmentCount ?? 0) > 0) return NextResponse.json({ error: "Setup cannot replace services after bookings exist." }, { status: 409 });

  const value = parsed.data;
  if (value.staffNames.length > BILLING_CONFIG.plans.business.staffIncluded) return NextResponse.json({ error: "A trial includes up to 7 staff members." }, { status: 422 });
  const { error: salonError } = await admin.from("salons").update({ name: value.salonName }).eq("id", ctx.salonId);
  if (salonError) return NextResponse.json({ error: salonError.message }, { status: 500 });

  const { error: settingsError } = await admin.from("salon_settings").update({
    salon_name: value.salonName,
    sender_display_name: value.salonName,
    salon_phone: value.salonPhone,
    salon_address: value.salonAddress || null,
    timezone: value.timezone,
    working_hours_start: value.openTime,
    working_hours_end: value.closeTime,
  }).eq("salon_id", ctx.salonId);
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });

  const { data: staff, error: staffReadError } = await admin.from("staff").select("id,sort_order")
    .eq("salon_id", ctx.salonId).order("sort_order").order("id");
  if (staffReadError) return NextResponse.json({ error: staffReadError.message }, { status: 500 });
  const staffIds: string[] = [];
  for (const [index, fullName] of value.staffNames.entries()) {
    const existing = staff?.[index];
    if (existing) {
      const { error } = await admin.from("staff").update({ full_name: fullName, is_active: true, sort_order: index }).eq("id", existing.id).eq("salon_id", ctx.salonId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      staffIds.push(existing.id);
    } else {
      const { data, error } = await admin.from("staff").insert({ salon_id: ctx.salonId, full_name: fullName, sort_order: index }).select("id").single();
      if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not add staff." }, { status: 500 });
      staffIds.push(data.id);
    }
  }
  const inactiveStaffIds = (staff ?? []).slice(value.staffNames.length).map((row) => row.id);
  if (inactiveStaffIds.length) {
    const { error } = await admin.from("staff").update({ is_active: false }).in("id", inactiveStaffIds).eq("salon_id", ctx.salonId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: assignmentsClearError } = await admin.from("staff_services").delete().eq("salon_id", ctx.salonId);
  if (assignmentsClearError) return NextResponse.json({ error: assignmentsClearError.message }, { status: 500 });
  const { error: hoursClearError } = await admin.from("staff_working_hours").delete().eq("salon_id", ctx.salonId);
  if (hoursClearError) return NextResponse.json({ error: hoursClearError.message }, { status: 500 });
  const { error: disableServicesError } = await admin.from("services").update({ is_active: false, is_online_bookable: false }).eq("salon_id", ctx.salonId);
  if (disableServicesError) return NextResponse.json({ error: disableServicesError.message }, { status: 500 });

  const { data: services, error: servicesError } = await admin.from("services").insert(value.services.map((service) => ({
    salon_id: ctx.salonId, ...service, is_active: true, is_online_bookable: true,
  }))).select("id");
  if (servicesError || !services) return NextResponse.json({ error: servicesError?.message ?? "Could not save services." }, { status: 500 });

  const { error: serviceAssignmentsError } = await admin.from("staff_services").insert(
    staffIds.flatMap((staff_id) => services.map((service) => ({ salon_id: ctx.salonId, staff_id, service_id: service.id })))
  );
  if (serviceAssignmentsError) return NextResponse.json({ error: serviceAssignmentsError.message }, { status: 500 });
  const { error: hoursError } = await admin.from("staff_working_hours").insert(
    staffIds.flatMap((staff_id) => value.workingDays.map((weekday) => ({
      salon_id: ctx.salonId, staff_id, weekday, start_time: value.openTime, end_time: value.closeTime,
    })))
  );
  if (hoursError) return NextResponse.json({ error: hoursError.message }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const bookingUrl = `${appUrl}/book?salon=${encodeURIComponent(ctx.salonSlug)}`;
  const { error: completeError } = await admin.from("salon_settings")
    .update({ onboarding_completed_at: new Date().toISOString(), booking_url: bookingUrl })
    .eq("salon_id", ctx.salonId);
  if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

  return NextResponse.json({ success: true, bookingUrl });
}



