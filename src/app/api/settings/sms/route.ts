import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const smsChoicesSchema = z.object({
  sms_reminder_24h: z.boolean().optional(),
  sms_reminder_2h: z.boolean().optional(),
  sms_booking_confirmation: z.boolean().optional(),
  sms_recall: z.boolean().optional(),
  sms_recall_days: z.number().int().min(7).max(365).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Nothing to change.");

/** Which messages the salon sends by SMS. Owners and admins only; the salon comes from the session. */
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = smsChoicesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("salon_settings")
    .update(parsed.data)
    .eq("salon_id", ctx.salonId)
    .select("sms_reminder_24h,sms_reminder_2h,sms_booking_confirmation,sms_recall,sms_recall_days")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ choices: data });
}
