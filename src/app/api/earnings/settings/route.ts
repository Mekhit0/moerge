import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";

const settingsSchema = z.union([
  z.object({ admins_see_earnings: z.boolean() }),
  z.object({ staff_id: z.string().uuid(), commission_percent: z.number().min(0).max(100) }),
]);

/**
 * PATCH /api/earnings/settings (owner only): a master's commission % or whether admins see earnings.
 * The database refuses these changes from anyone but the owner as well.
 */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "მხოლოდ მფლობელს შეუძლია. / Only the owner can do this." }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "პროცენტი 0-დან 100-მდე. / Use a percent from 0 to 100." }, { status: 400 });

  const result = "admins_see_earnings" in parsed.data
    ? await ctx.supabase.from("salon_settings").update({ admins_see_earnings: parsed.data.admins_see_earnings })
      .eq("salon_id", ctx.salonId).select("salon_id")
    : await ctx.supabase.from("staff").update({ commission_percent: Math.round(parsed.data.commission_percent * 100) / 100 })
      .eq("salon_id", ctx.salonId).eq("id", parsed.data.staff_id).select("id");
  if (result.error || !result.data?.length) {
    return NextResponse.json({ error: "ცვლილება ვერ შეინახა. / The change could not be saved." }, { status: result.error?.code === "42501" ? 403 : 400 });
  }
  return NextResponse.json({ success: true });
}
