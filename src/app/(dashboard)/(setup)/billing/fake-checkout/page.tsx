import { redirect } from "next/navigation";
import { createServiceClient, getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export default async function FakeCheckoutPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  if (!BILLING_CONFIG.billingEnabled) redirect("/dashboard");
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx || !requireRole(ctx, ["owner", "admin"])) redirect("/dashboard");
  const { invoice: invoiceId } = await searchParams;
  if (!invoiceId) redirect("/billing");
  if (process.env.PAYMENT_PROVIDER !== "fake") redirect("/billing");
  const db = createServiceClient();
  const { data: invoice } = await db.from("invoices").select("id,kind,total_gel,status,invoice_lines(line_type,quantity)").eq("id", invoiceId).eq("salon_id", ctx.salonId).single();
  if (!invoice || invoice.status !== "open") redirect("/billing");
  const { error } = await db.rpc("complete_fake_payment", { p_salon_id: ctx.salonId, p_invoice_id: invoice.id });
  redirect(error ? "/billing?payment=failed" : "/billing?payment=success");
}


