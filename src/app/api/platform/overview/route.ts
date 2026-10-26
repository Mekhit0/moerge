import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const ownerId = process.env.PLATFORM_OWNER_USER_ID?.trim();
  if (!ownerId) return NextResponse.json({ error: "Platform owner is not configured." }, { status: 503 });
  const session = await createServerSupabaseClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user || user.id !== ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = createServiceClient();
  const [overview, feedback] = await Promise.all([
    db.rpc("platform_salon_overview", { p_limit: 100, p_offset: 0, p_since: new Date(Date.now() - 30 * 86400000).toISOString() }),
    db.from("dashboard_feedback").select("id,salon_id,submitted_by,body,page_path,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  if (overview.error || feedback.error) return NextResponse.json({ error: "Could not load platform data." }, { status: 500 });
  return NextResponse.json({ salons: overview.data ?? [], feedback: feedback.data ?? [] });
}
