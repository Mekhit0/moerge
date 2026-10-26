import { NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await ctx.supabase.from("audit_log")
    .select("id,action,entity_type,entity_id,changed_fields,actor_id,created_at")
    .eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load the audit log." }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
