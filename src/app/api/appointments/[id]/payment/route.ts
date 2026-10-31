import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole, OFFICE_ONLY_ERROR } from "@/lib/supabase/server";
import { changeVisitStatus, loadVisit } from "@/lib/visit-server";

const money = z.number().finite().min(0).max(100000);

const paySchema = z.object({
  price_gel: money.nullable().optional(),
  discount_gel: money,
  tip_gel: money,
  cash_gel: money,
  card_gel: money,
});

const voidSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().trim().min(2).max(300),
});

const PAYMENT_FIELDS = "id,appointment_id,price_gel,discount_gel,total_gel,tip_gel,cash_gel,card_gel,created_at,voided_at";

/** Database errors from the payment functions, in words the salon understands. */
function paymentError(message: string): { status: number; error: string } {
  if (/already paid/i.test(message)) return { status: 409, error: "ვიზიტი უკვე გადახდილია. / This visit is already paid." };
  if (/add up/i.test(message)) return { status: 400, error: "ნაღდი და ბარათი ჯამში უნდა უდრიდეს გადასახდელს. / Cash and card must add up to the total." };
  if (/not valid/i.test(message)) return { status: 400, error: "თანხები არასწორია. / The amounts are not valid." };
  if (/owner or an admin/i.test(message)) return { status: 403, error: "გადახდის გაუქმება მხოლოდ მფლობელს ან ადმინს შეუძლია. / Only the owner or an admin can undo a payment." };
  if (/already undone/i.test(message)) return { status: 409, error: "გადახდა უკვე გაუქმებულია. / This payment is already undone." };
  if (/not found/i.test(message)) return { status: 404, error: "ვიზიტი ვერ მოიძებნა. / Visit not found." };
  return { status: 500, error: "გადახდა ვერ შეინახა. სცადეთ თავიდან. / The payment could not be saved. Please try again." };
}

/** Take payment. A visit that is booked or arrived is marked done first. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });

  const { id } = await context.params;
  const parsed = paySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "თანხები არასწორია. / The amounts are not valid." }, { status: 400 });
  }

  const visit = await loadVisit(ctx, id);
  if (!visit) return NextResponse.json({ error: "ვიზიტი ვერ მოიძებნა. / Visit not found." }, { status: 404 });
  let visitAfter: Record<string, unknown> = { ...visit };
  if (visit.status !== "completed") {
    const done = await changeVisitStatus(ctx, visit, "completed");
    if (!done.ok) return NextResponse.json({ error: done.error }, { status: done.status });
    visitAfter = done.visit;
  }

  const { data, error } = await ctx.supabase.rpc("record_visit_payment", {
    p_appointment_id: id,
    p_price_gel: parsed.data.price_gel ?? null,
    p_discount_gel: parsed.data.discount_gel,
    p_tip_gel: parsed.data.tip_gel,
    p_cash_gel: parsed.data.cash_gel,
    p_card_gel: parsed.data.card_gel,
  }).select(PAYMENT_FIELDS).single();
  if (error) {
    const mapped = paymentError(error.message);
    return NextResponse.json({ error: mapped.error, visit: visitAfter }, { status: mapped.status });
  }
  return NextResponse.json({ payment: data, visit: visitAfter });
}

/** Undo a payment (owner or admin, with a reason). */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: OFFICE_ONLY_ERROR }, { status: 403 });

  const { id } = await context.params;
  const parsed = voidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "მიუთითეთ მიზეზი. / Enter a reason." }, { status: 400 });

  const { data: payment } = await ctx.supabase.from("visit_payments").select("id")
    .eq("id", parsed.data.payment_id).eq("appointment_id", id).eq("salon_id", ctx.salonId).maybeSingle();
  if (!payment) return NextResponse.json({ error: "გადახდა ვერ მოიძებნა. / Payment not found." }, { status: 404 });

  const { error } = await ctx.supabase.rpc("void_visit_payment", { p_payment_id: payment.id, p_reason: parsed.data.reason });
  if (error) {
    const mapped = paymentError(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
  return NextResponse.json({ ok: true });
}
