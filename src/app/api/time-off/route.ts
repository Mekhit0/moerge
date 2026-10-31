import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
const canManage = ["owner", "admin"] as const;

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await ctx.supabase.from("time_off").select("*").eq("salon_id", ctx.salonId).order("starts_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ time_off: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.starts_at !== "string" || typeof body.ends_at !== "string" || !Number.isFinite(Date.parse(body.starts_at)) || !Number.isFinite(Date.parse(body.ends_at)) || Date.parse(body.ends_at) <= Date.parse(body.starts_at)) return NextResponse.json({ error: "Choose a valid time-off range." }, { status: 400 });
  const staffId = typeof body.staff_id === "string" && body.staff_id ? body.staff_id : null;
  if (staffId) {
    // The master must belong to this salon; never trust an id sent by the browser.
    const { data: member } = await ctx.supabase.from("staff").select("id").eq("id", staffId).eq("salon_id", ctx.salonId).maybeSingle();
    if (!member) return NextResponse.json({ error: "სპეციალისტი ვერ მოიძებნა. / Specialist not found." }, { status: 404 });
  }
  const { data, error } = await ctx.supabase.from("time_off").insert({ salon_id: ctx.salonId, staff_id: staffId, starts_at: body.starts_at, ends_at: body.ends_at, reason: typeof body.reason === "string" ? body.reason.slice(0, 300) : null }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ time_off: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, canManage)) return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Time-off id is required." }, { status: 400 });
  const { error } = await ctx.supabase.from("time_off").delete().eq("id", id).eq("salon_id", ctx.salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
