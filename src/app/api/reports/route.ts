import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { isValidCalendarDate } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || to < from ||
      new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime() > 366 * 86_400_000) {
    return NextResponse.json({ error: "Choose a valid date range of up to one year." }, { status: 400 });
  }
  const { data, error } = await ctx.supabase.rpc("get_salon_reports", {
    p_salon_id: ctx.salonId, p_start_date: from, p_end_date: to,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report: data });
}
