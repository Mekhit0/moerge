import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformOwner } from "@/lib/platform";

const schema = z.object({ id: z.string().uuid(), resolved: z.boolean() });

/** PATCH /api/platform/feedback: mark a salon's feedback as done, or open it again. */
export async function PATCH(request: NextRequest) {
  const owner = await requirePlatformOwner();
  if ("response" in owner) return owner.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await owner.db.from("dashboard_feedback")
    .update({ resolved_at: parsed.data.resolved ? new Date().toISOString() : null }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ success: true });
}
