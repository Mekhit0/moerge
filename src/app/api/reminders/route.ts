import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") ?? "all";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  let query = ctx.supabase
    .from("reminders")
    .select(
      `
      *,
      client:clients(id, full_name, email, is_archived, email_consent),
      appointment:appointments(id, treatment_date, treatment_time, treatment_type, status)
    `
    )
    .eq("salon_id", ctx.salonId)
    .order("scheduled_for_date", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (dateFrom) {
    query = query.gte("scheduled_for_date", dateFrom);
  }
  if (dateTo) {
    query = query.lte("scheduled_for_date", dateTo);
  }

  const { data: reminders, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: logs } = await ctx.supabase
    .from("email_logs")
    .select("*")
    .eq("salon_id", ctx.salonId)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({
    reminders: reminders ?? [],
    emailLogs: logs ?? [],
  });
}
