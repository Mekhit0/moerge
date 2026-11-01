import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformOwner } from "@/lib/platform";

export const dynamic = "force-dynamic";

type Row = { id: string; created_at: string; source: string; message: string; path: string | null; digest: string | null; salon_id: string | null; resolved_at: string | null };

/**
 * GET /api/platform/errors?show=open|all: errors grouped by what broke and where, newest first.
 * PATCH: mark a group as fixed (or open again).
 */
export async function GET(request: NextRequest) {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const showAll = new URL(request.url).searchParams.get("show") === "all";
  let query = owner.db.from("app_errors").select("id,created_at,source,message,path,digest,salon_id,resolved_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (!showAll) query = query.is("resolved_at", null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load errors." }, { status: 500 });

  const groups = new Map<string, { key: string; source: string; message: string; path: string | null; count: number; first_seen: string; last_seen: string; resolved: boolean; ids: string[]; salons: number }>();
  const salonSets = new Map<string, Set<string>>();
  for (const row of (data ?? []) as Row[]) {
    const key = `${row.source}|${row.path ?? ""}|${row.message}`;
    const group = groups.get(key) ?? { key, source: row.source, message: row.message, path: row.path, count: 0, first_seen: row.created_at, last_seen: row.created_at, resolved: Boolean(row.resolved_at), ids: [], salons: 0 };
    group.count += 1;
    group.ids.push(row.id);
    if (row.created_at < group.first_seen) group.first_seen = row.created_at;
    if (row.created_at > group.last_seen) group.last_seen = row.created_at;
    group.resolved = group.resolved && Boolean(row.resolved_at);
    if (row.salon_id) salonSets.set(key, (salonSets.get(key) ?? new Set()).add(row.salon_id));
    groups.set(key, group);
  }
  const list = [...groups.values()].map((group) => ({ ...group, salons: salonSets.get(group.key)?.size ?? 0 }))
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen));
  return NextResponse.json({ groups: list });
}

const patchSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000), resolved: z.boolean() });

export async function PATCH(request: NextRequest) {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await owner.db.from("app_errors")
    .update({ resolved_at: parsed.data.resolved ? new Date().toISOString() : null }).in("id", parsed.data.ids);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ success: true });
}
