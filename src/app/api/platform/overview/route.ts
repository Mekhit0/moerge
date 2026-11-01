import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/platform";

export const dynamic = "force-dynamic";

/** Salons with their numbers, feedback from salons, and a summary for the admin panel. */
export async function GET() {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const { db } = owner;
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [overview, feedback, openErrors, failedMessages, sentMessages] = await Promise.all([
    db.rpc("platform_salon_overview", { p_limit: 200, p_offset: 0, p_since: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
    db.from("dashboard_feedback").select("id,salon_id,submitted_by,body,page_path,created_at,resolved_at").order("created_at", { ascending: false }).limit(200),
    db.from("app_errors").select("id", { count: "exact", head: true }).is("resolved_at", null).gte("created_at", dayAgo),
    db.from("notification_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", dayAgo),
    db.from("notification_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", dayAgo),
  ]);
  if (overview.error || feedback.error) return NextResponse.json({ error: "Could not load platform data." }, { status: 500 });

  // Names for feedback: which salon and who wrote it.
  const rows = feedback.data ?? [];
  const salonIds = [...new Set(rows.map((row) => row.salon_id))];
  const userIds = [...new Set(rows.map((row) => row.submitted_by))];
  const [salons, people] = await Promise.all([
    salonIds.length ? db.from("salons").select("id,name").in("id", salonIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    userIds.length ? db.from("user_profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string }> }),
  ]);
  const salonName = new Map((salons.data ?? []).map((row) => [row.id, row.name]));
  const person = new Map((people.data ?? []).map((row) => [row.id, row]));

  const salonRows = (overview.data ?? []) as Array<{ subscription_status: string | null; trial_ends_at: string | null; bookings_period: number }>;
  const weekAhead = Date.now() + 7 * 86_400_000;
  return NextResponse.json({
    summary: {
      salons: salonRows.length,
      trialing: salonRows.filter((row) => row.subscription_status === "trialing").length,
      trials_ending: salonRows.filter((row) => row.subscription_status === "trialing" && row.trial_ends_at && Date.parse(row.trial_ends_at) < weekAhead).length,
      bookings_30d: salonRows.reduce((sum, row) => sum + Number(row.bookings_period ?? 0), 0),
      open_feedback: rows.filter((row) => !row.resolved_at).length,
      errors_24h: openErrors.count ?? 0,
      messages_sent_24h: sentMessages.count ?? 0,
      messages_failed_24h: failedMessages.count ?? 0,
    },
    salons: overview.data ?? [],
    feedback: rows.map((row) => ({
      ...row,
      salon_name: salonName.get(row.salon_id) ?? null,
      author: person.get(row.submitted_by)?.full_name ?? null,
      author_email: person.get(row.submitted_by)?.email ?? null,
    })),
  });
}
