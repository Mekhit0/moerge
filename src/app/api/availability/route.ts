import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { isPublicBookingDateAllowed } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const wanted = params.get("service_id") ?? "";
  if (!isPublicBookingDateAllowed(date) || !wanted) return NextResponse.json({ error: "Choose a valid service and date within 90 days." }, { status: 400 });
  const { data: services } = await ctx.supabase.from("services").select("id,legacy_id").eq("salon_id", ctx.salonId).eq("is_active", true);
  const service = services?.find((item) => item.id === wanted || item.legacy_id === wanted);
  if (!service) return NextResponse.json({ error: "Service is unavailable." }, { status: 404 });
  const { data, error } = await ctx.supabase.rpc("get_available_slots", {
    p_salon_id: ctx.salonId,
    p_service_id: service.id,
    p_date: date,
    p_staff_id: params.get("staff_id") || null,
    p_exclude_appointment_id: params.get("exclude_appointment_id") || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}
