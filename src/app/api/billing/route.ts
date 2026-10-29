import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { BILLING_CONFIG, getBillableExtraBranches, type PaidPlan } from "@/lib/billing-plans";
import { getPaymentProvider } from "@/lib/payment-provider";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";

const plans = ["business", "multi_branch"] as const;
export async function GET() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const db = createServiceClient();
  const [{ data: subscription }, { data: invoices }, { data: wallet }, { count: staffCount }, { count: branchCount }] = await Promise.all([
    db.from("subscriptions").select("*, plans(*)").eq("salon_id", ctx.salonId).maybeSingle(),
    db.from("invoices").select("id,kind,status,total_gel,due_at,period_start,period_end,created_at,invoice_lines(*)").eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).limit(50),
    db.from("sms_wallet").select("included_quota,prepaid_balance,used_this_period,overage_count,overage_cap_gel,period_start").eq("salon_id", ctx.salonId).maybeSingle(),
    db.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true),
    db.from("salon_branches").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true),
  ]);
  const plan = subscription?.plan_code as PaidPlan | undefined;
  const estimate = plan ? BILLING_CONFIG.plans[plan]?.monthlyGel ?? 0 : 0;
  const extraStaff = Math.max(0, (staffCount ?? 0) - (plan ? BILLING_CONFIG.plans[plan].staffIncluded : 7));
  const extraBranches = plan ? getBillableExtraBranches(branchCount ?? 0, BILLING_CONFIG.plans[plan].branches) : 0;
  return NextResponse.json({ config: BILLING_CONFIG, subscription, invoices: invoices ?? [], wallet, activeStaffCount: staffCount ?? 0, activeBranchCount: branchCount ?? 0, extraBranchCount: extraBranches,
    nextInvoicePreviewGel: estimate + extraStaff * BILLING_CONFIG.extraStaffMonthlyGel + extraBranches * BILLING_CONFIG.extraBranchMonthlyGel + (wallet?.overage_count ?? 0) * BILLING_CONFIG.smsOveragePriceGel,
    paymentsEnabled: process.env.PAYMENT_PROVIDER === "fake" });
}
export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(ctx, ["owner", "admin"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = z.discriminatedUnion("action", [
    z.object({ action: z.literal("upgrade"), plan: z.enum(["business", "multi_branch"]), months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).default(1) }),
    z.object({ action: z.literal("cancel") }),
z.object({ action: z.literal("pay_invoice"), invoiceId: z.string().uuid() }),
    z.object({ action: z.literal("buy_sms"), quantity: z.number().int().min(BILLING_CONFIG.smsPackMinimum).max(100000) }),
z.object({ action: z.literal("set_sms_cap"), amountGel: z.number().min(0).max(500) }),
  ]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid billing action." }, { status: 400 });
  const db = createServiceClient();
  const { data: sub } = await db.from("subscriptions").select("id,plan_code,status").eq("salon_id", ctx.salonId).maybeSingle();
  if (parsed.data.action === "pay_invoice") {
    const { data: invoice } = await db.from("invoices").select("id,total_gel,status").eq("id", parsed.data.invoiceId).eq("salon_id", ctx.salonId).single();
    if (!invoice || invoice.status !== "open") return NextResponse.json({ error: "Open invoice not found." }, { status: 404 });
    try {
      const checkout = await getPaymentProvider().createCheckout({ invoiceId: invoice.id, amountGel: Number(invoice.total_gel), currency: "GEL", baseUrl: new URL(request.url).origin });
      await db.from("payments").upsert({ salon_id: ctx.salonId, invoice_id: invoice.id, provider: "fake", provider_payment_id: checkout.providerPaymentId, status: "pending", amount_gel: invoice.total_gel, idempotency_key: invoice.id }, { onConflict: "salon_id,idempotency_key" });
      return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Payment provider unavailable." }, { status: 503 }); }
  }
  if (parsed.data.action === "cancel") {
    if (sub) await db.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id).eq("salon_id", ctx.salonId);
    return NextResponse.json({ success: true, cancelAtPeriodEnd: true });
  }
  const isPack = parsed.data.action === "buy_sms";
  const plan: PaidPlan | null = parsed.data.action === "upgrade" ? parsed.data.plan : null;
  const months = parsed.data.action === "upgrade" ? parsed.data.months : 1;
  const quantity = parsed.data.action === "buy_sms" ? parsed.data.quantity : 0;
  if (plan) {
    const cap = BILLING_CONFIG.plans[plan].staffLimit;
    const { count } = await db.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", ctx.salonId).eq("is_active", true);
    if ((count ?? 0) > BILLING_CONFIG.plans[plan].staffLimit) return NextResponse.json({ error: `This plan allows up to ${cap} active staff.` }, { status: 422 });
  }
  const base = plan ? BILLING_CONFIG.plans[plan].monthlyGel * months * (1 - ((BILLING_CONFIG.prepaidDiscounts as Record<number, number>)[months] ?? 0) / 100) : 0;
  const total = isPack ? quantity * BILLING_CONFIG.smsPackPriceGel : base;
  const { data: invoice, error } = await db.from("invoices").insert({ salon_id: ctx.salonId, subscription_id: sub?.id ?? null, kind: isPack ? "sms_pack" : "plan", plan_code: plan, prepaid_months: months, idempotency_key: randomUUID(), status: "open", subtotal_gel: total, total_gel: total, currency: "GEL", due_at: new Date().toISOString() }).select("id").single();
  if (error || !invoice) return NextResponse.json({ error: "Could not create invoice." }, { status: 500 });
  const description = isPack ? `${quantity} prepaid SMS` : `${plan} plan, ${months} month(s)`;
  const { error: lineError } = await db.from("invoice_lines").insert({ salon_id: ctx.salonId, invoice_id: invoice.id, line_type: isPack ? "sms_pack" : "plan", description, quantity: isPack ? quantity : months, unit_price_gel: isPack ? BILLING_CONFIG.smsPackPriceGel : BILLING_CONFIG.plans[plan!].monthlyGel, total_gel: total });
  if (lineError) return NextResponse.json({ error: "Could not add invoice line." }, { status: 500 });
  try {
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckout({ invoiceId: invoice.id, amountGel: total, currency: "GEL", baseUrl: new URL(request.url).origin });
    await db.from("payments").insert({ salon_id: ctx.salonId, invoice_id: invoice.id, provider: "fake", provider_payment_id: checkout.providerPaymentId, status: "pending", amount_gel: total, idempotency_key: invoice.id });
    return NextResponse.json({ invoiceId: invoice.id, checkoutUrl: checkout.checkoutUrl });
  } catch (err) {
    return NextResponse.json({ invoiceId: invoice.id, error: err instanceof Error ? err.message : "Payment provider unavailable." }, { status: 503 });
  }
}







