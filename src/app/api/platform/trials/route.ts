import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformOwner } from "@/lib/platform";

export const dynamic = "force-dynamic";

const schema = z.object({ until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * POST { until: "YYYY-MM-DD" }: every running trial lasts until the end of that day, Tbilisi time.
 * The safety switch for when card payments are not ready. It never shortens a trial.
 */
export async function POST(request: NextRequest) {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const end = new Date(`${parsed.data.until}T00:00:00+04:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const { data, error } = await owner.db.rpc("extend_trials", { p_until: end.toISOString() });
  if (error) return NextResponse.json({ error: error.message.includes("90 days") ? "Choose a date within the next 90 days." : "Could not extend trials." }, { status: 400 });
  return NextResponse.json({ extended: data ?? 0, until: end.toISOString() });
}
