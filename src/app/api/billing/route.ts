import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { BILLING_CONFIG, PAYABLE_MONTHS, SELLABLE_PLANS, billingOpen, planInfo, quotePlan, quoteSmsPacks, type PaidPlan, type QuoteLine } from "@/lib/billing-plans";
import { EARLY_BIRD, PRICING_STARTS_AT, REFUND, currentOffer } from "@/lib/pricing";
import { getPaymentProvider } from "@/lib/payment-provider";
import { getAppUrl } from "@/lib/app-url";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const BILLING_CLOSED = { error: "ფასიანი პაკეტები 1 დეკემბრიდან იწყება. / Paid plans start on 1 December." };

type Db = ReturnType<typeof createServiceClient>;

/** The first 20 salons to pay for a plan in December get 20% off that first payment. */
async function earlyBirdPercent(db: Db, salonId: string): Promise<number> {
  if (!currentOffer().earlyBird) return 0;
  const { data: paid } = await db.from("invoices").select("salon_id").eq("kind", "plan").eq("status", "paid").gte("paid_at", PRICING_STARTS_AT.toISOString());
  const salons = new Set((paid ?? []).map((row) => row.salon_id as string));
  if (salons.has(salonId)) return 0;
  const { count: before } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("kind", "plan").eq("status", "paid");
  if ((before ?? 0) > 0 || salons.size >= EARLY_BIRD.salons) return 0;
  return EARLY_BIRD.discountPercent;
}

function paymentsEnabled(): boolean {
  try { getPaymentProvider(); return true; } catch { return false; }
}

async function context() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!requireRole(ctx, ["owner", "admin"])) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ctx };
}

export async function GET() {
  if (!billingOpen()) return NextResponse.json(BILLING_CLOSED, { status: 404 });
  const { ctx, error } = await context();
  if (error) return error;
  const db = createServiceClient();
  const [{ data: subscription }, { data: invoices }, { data: wallet }, { count: staffCount }] = await Promise.all([
    db.from("subscriptions").select("status,plan_code,trial_ends_at,current_period_end,cancel_at_period_end,grace_ends_at").eq("salon_id", ctx.salonId).maybeSingle(),
    db.from("invoices").select("id,kind,status,total_gel,created_at,paid_at,invoice_lines(description,line_type)").eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).limit(24),
    db.from("sms_wallet").select("included_quota,prepaid_balance,used_this_period").eq("salon_id", ctx.salonId).maybeSingle(),
    db.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true),
  ]);
  return NextResponse.json({
    subscription,
    invoices: invoices ?? [],
    wallet,
    activeStaffCount: staffCount ?? 0,
    plans: SELLABLE_PLANS.map((code) => planInfo(code)),
    months: PAYABLE_MONTHS,
    earlyBirdPercent: await earlyBirdPercent(db, ctx.salonId),
    refund: REFUND,
    smsPack: { minimum: BILLING_CONFIG.smsPackMinimum, priceGel: BILLING_CONFIG.smsPackPriceGel },
    paymentsEnabled: paymentsEnabled(),
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upgrade"), plan: z.enum(SELLABLE_PLANS as [PaidPlan, ...PaidPlan[]]), months: z.union([z.literal(1), z.literal(6), z.literal(12)]).default(1) }),
  z.object({ action: z.literal("buy_sms"), packs: z.number().int().min(1).max(50) }),
  z.object({ action: z.literal("pay_invoice"), invoiceId: z.string().uuid() }),
  z.object({ action: z.literal("cancel") }),
]);

export async function POST(request: NextRequest) {
  if (!billingOpen()) return NextResponse.json(BILLING_CLOSED, { status: 404 });
  const { ctx, error } = await context();
  if (error) return error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid billing action." }, { status: 400 });
  const action = parsed.data;
  const db = createServiceClient();
  const { data: sub } = await db.from("subscriptions").select("id,plan_code,status").eq("salon_id", ctx.salonId).maybeSingle();

  if (action.action === "cancel") {
    if (sub) await db.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id).eq("salon_id", ctx.salonId);
    return NextResponse.json({ success: true, cancelAtPeriodEnd: true });
  }

  if (action.action === "pay_invoice") {
    const { data: invoice } = await db.from("invoices").select("id,total_gel,status").eq("id", action.invoiceId).eq("salon_id", ctx.salonId).maybeSingle();
    if (!invoice || invoice.status !== "open") return NextResponse.json({ error: "Open invoice not found." }, { status: 404 });
    return checkout(db, ctx.salonId, invoice.id, Number(invoice.total_gel));
  }

  let kind: "plan" | "sms_pack";
  let lines: QuoteLine[];
  let total: number;
  let planCode: PaidPlan | null = null;
  let months = 1;
  if (action.action === "upgrade") {
    const pkg = planInfo(action.plan);
    const { count } = await db.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true);
    if ((count ?? 0) > pkg.staffLimit) {
      return NextResponse.json({ error: `${pkg.name.ka} პაკეტში მაქსიმუმ ${pkg.staffLimit} აქტიური სპეციალისტია. ჯერ გამორთეთ ზედმეტი. / ${pkg.name.en} allows up to ${pkg.staffLimit} active specialists. Turn off the extra ones first.` }, { status: 422 });
    }
    const quote = quotePlan(action.plan, action.months, await earlyBirdPercent(db, ctx.salonId));
    kind = "plan"; lines = quote.lines; total = quote.totalGel; planCode = action.plan; months = action.months;
  } else {
    const quote = quoteSmsPacks(action.packs);
    kind = "sms_pack"; lines = quote.lines; total = quote.totalGel;
  }

  const subtotal = lines.filter((line) => line.type !== "adjustment").reduce((sum, line) => sum + line.totalGel, 0);
  const { data: invoice, error: invoiceError } = await db.from("invoices").insert({
    salon_id: ctx.salonId, subscription_id: sub?.id ?? null, kind, plan_code: planCode, prepaid_months: months,
    idempotency_key: randomUUID(), status: "open", subtotal_gel: subtotal, total_gel: total, currency: "GEL", due_at: new Date().toISOString(),
  }).select("id").single();
  if (invoiceError || !invoice) return NextResponse.json({ error: "Could not create invoice." }, { status: 500 });
  const { error: lineError } = await db.from("invoice_lines").insert(lines.map((line) => ({
    salon_id: ctx.salonId, invoice_id: invoice.id, line_type: line.type, description: line.description,
    quantity: line.quantity, unit_price_gel: line.unitPriceGel, total_gel: line.totalGel,
  })));
  if (lineError) return NextResponse.json({ error: "Could not add invoice line." }, { status: 500 });
  return checkout(db, ctx.salonId, invoice.id, total);
}

async function checkout(db: Db, salonId: string, invoiceId: string, amountGel: number) {
  let provider;
  try { provider = getPaymentProvider(); } catch {
    return NextResponse.json({ invoiceId, error: "ბარათით გადახდა რამდენიმე დღეში ჩაირთვება. საცდელი პერიოდი გრძელდება. / Card payment opens in a few days. Your trial continues." }, { status: 503 });
  }
  try {
    const result = await provider.createCheckout({ invoiceId, amountGel, currency: "GEL", baseUrl: getAppUrl() });
    await db.from("payments").upsert({ salon_id: salonId, invoice_id: invoiceId, provider: "fake", provider_payment_id: result.providerPaymentId, status: "pending", amount_gel: amountGel, idempotency_key: invoiceId }, { onConflict: "salon_id,idempotency_key" });
    return NextResponse.json({ invoiceId, checkoutUrl: result.checkoutUrl });
  } catch (err) {
    return NextResponse.json({ invoiceId, error: err instanceof Error ? err.message : "Payment provider unavailable." }, { status: 503 });
  }
}
