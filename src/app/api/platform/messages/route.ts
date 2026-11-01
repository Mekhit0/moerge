import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * Message delivery across all salons for the last 7 days: counts by status and channel, and the
 * latest messages that failed or are waiting to retry. Recipients are not shown.
 */
export async function GET() {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const { db } = owner;
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [recent, problems] = await Promise.all([
    db.from("notification_log").select("status,channel").gte("created_at", since).limit(5000),
    db.from("notification_log").select("id,salon_id,message_type,channel,status,attempt_count,error,created_at")
      .in("status", ["failed", "retry"]).order("created_at", { ascending: false }).limit(50),
  ]);
  if (recent.error || problems.error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });

  const counts: Record<string, Record<string, number>> = {};
  for (const row of recent.data ?? []) {
    counts[row.channel] ??= {};
    counts[row.channel][row.status] = (counts[row.channel][row.status] ?? 0) + 1;
  }
  const salonIds = [...new Set((problems.data ?? []).map((row) => row.salon_id))];
  const { data: salons } = salonIds.length
    ? await db.from("salons").select("id,name").in("id", salonIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const names = new Map((salons ?? []).map((row) => [row.id, row.name]));

  return NextResponse.json({
    counts,
    problems: (problems.data ?? []).map((row) => ({ ...row, salon_name: names.get(row.salon_id) ?? null, error: (row.error ?? "").slice(0, 300) })),
  });
}
