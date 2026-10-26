import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
const canManage = ["owner", "admin"] as const;

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let query = ctx.supabase.from("staff_working_hours").select("*").eq("salon_id", ctx.salonId).order("weekday").order("start_time");
  const staffId = new URL(request.url).searchParams.get("staff_id");
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { staff_id?: string; rows?: Array<Record<string, unknown>> } | null;
  if (!body?.staff_id || !Array.isArray(body.rows) || body.rows.some((row) => !Number.isInteger(row.weekday) || Number(row.weekday) < 0 || Number(row.weekday) > 6 || typeof row.start_time !== "string" || typeof row.end_time !== "string" || row.end_time <= row.start_time)) {
    return NextResponse.json({ error: "Invalid working hours." }, { status: 400 });
  }
  const { error: deleteError } = await ctx.supabase.from("staff_working_hours").delete().eq("salon_id", ctx.salonId).eq("staff_id", body.staff_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  if (body.rows.length) {
    const { error } = await ctx.supabase.from("staff_working_hours").insert(body.rows.map((row) => ({
      salon_id: ctx.salonId, staff_id: body.staff_id, weekday: row.weekday,
      start_time: row.start_time, end_time: row.end_time, is_break: row.is_break === true,
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
