import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
import { changeVisitStatus, loadVisit } from "@/lib/visit-server";

const bodySchema = z.object({
  status: z.enum(["scheduled", "arrived", "completed", "no_show", "canceled"]),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const visit = await loadVisit(ctx, id);
  if (!visit) return NextResponse.json({ error: "ვიზიტი ვერ მოიძებნა. / Visit not found." }, { status: 404 });

  // Masters mark their own visits arrived, done or no-show; canceling stays with the salon office.
  const touchesCancel = parsed.data.status === "canceled" || visit.status === "canceled";
  if (touchesCancel && !requireRole(ctx, ["owner", "admin"])) {
    return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });
  }

  const result = await changeVisitStatus(ctx, visit, parsed.data.status);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ visit: result.visit });
}
