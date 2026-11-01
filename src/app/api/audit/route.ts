import { NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await ctx.supabase.from("audit_log")
    .select("id,action,entity_type,entity_id,changed_fields,actor_id,created_at")
    .eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Could not load the audit log." }, { status: 500 });

  // Names of the people who made changes; only team members of this salon are visible.
  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = actorIds.length
    ? await ctx.supabase.from("user_profiles").select("id,full_name").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return NextResponse.json({ entries: (data ?? []).map((row) => ({ ...row, actor_name: row.actor_id ? names.get(row.actor_id) ?? null : null })) });
}
