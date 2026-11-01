import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";

const mergeSchema = z.object({ keep_id: z.string().uuid(), merge_id: z.string().uuid() });

/**
 * POST /api/clients/merge
 * Joins a duplicate client card into another one. Visits, payments, messages and notes move over;
 * the duplicate card is deleted. The database function checks both cards belong to this salon.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });
  const parsed = mergeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.keep_id === parsed.data.merge_id) {
    return NextResponse.json({ error: "აირჩიეთ ორი სხვადასხვა კლიენტი. / Choose two different clients." }, { status: 400 });
  }
  const { error } = await ctx.supabase.rpc("merge_clients", { p_keep: parsed.data.keep_id, p_merge: parsed.data.merge_id });
  if (error) {
    return NextResponse.json({
      error: error.code === "P0002"
        ? "კლიენტი ვერ მოიძებნა. / Client not found."
        : "გაერთიანება ვერ მოხერხდა. / The clients could not be merged.",
    }, { status: error.code === "P0002" ? 404 : 400 });
  }
  return NextResponse.json({ client_id: parsed.data.keep_id });
}
