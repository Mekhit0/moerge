import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Runs only against a local `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true" && Boolean(serviceKey);

describe.skipIf(!canRun)("Paid plans from December (integration)", { timeout: 60000 }, () => {
  const db = () => createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

  async function newSalon(name: string) {
    const run = crypto.randomUUID().slice(0, 8);
    const { data, error } = await db().from("salons").insert({ name, slug: `${name.toLowerCase()}-${run}`, subscription_tier: "professional", subscription_status: "trialing" }).select("id").single();
    if (error) throw error;
    return data!.id as string;
  }

  it("gives every new salon Solo, Business and Multi-branch at the published prices, on a trial", async () => {
    const salon = await newSalon("Plans");
    try {
      const { data: plans } = await db().from("plans").select("code,base_monthly_gel,staff_limit,included_staff,included_sms,discount_6mo,discount_12mo").eq("salon_id", salon).order("base_monthly_gel");
      expect(plans?.map((plan) => [plan.code, Number(plan.base_monthly_gel), plan.staff_limit, plan.included_staff, plan.included_sms])).toEqual([
        ["solo", 19, 1, 1, 100], ["business", 59, 50, 10, 1000], ["multi_branch", 149, 50, 50, 3000],
      ]);
      expect(plans?.every((plan) => plan.discount_6mo === 10 && plan.discount_12mo === 20)).toBe(true);
      const { data: sub } = await db().from("subscriptions").select("status,plan_code,trial_ends_at").eq("salon_id", salon).single();
      expect(sub).toMatchObject({ status: "trialing", plan_code: "business" });
      // 30 days before 1 December, 14 from then on.
      expect(new Date(sub!.trial_ends_at).getTime() - Date.now()).toBeGreaterThan(13 * 86_400_000);
      const { data: total } = await db().rpc("plan_period_total", { p_base: 59, p_months: 12, p_d3: 0, p_d6: 10, p_d12: 20 });
      expect(Number(total)).toBe(566.4);
    } finally {
      await db().from("salons").delete().eq("id", salon);
    }
  });

  it("extends every running trial with the safety switch, and never shortens one", async () => {
    const salon = await newSalon("Extend");
    try {
      const later = new Date(Date.now() + 60 * 86_400_000).toISOString();
      const { error } = await db().rpc("extend_trials", { p_until: later });
      expect(error).toBeNull();
      const { data: sub } = await db().from("subscriptions").select("trial_ends_at").eq("salon_id", salon).single();
      expect(new Date(sub!.trial_ends_at).toISOString()).toBe(later);
      await db().rpc("extend_trials", { p_until: new Date(Date.now() + 20 * 86_400_000).toISOString() });
      const { data: after } = await db().from("subscriptions").select("trial_ends_at").eq("salon_id", salon).single();
      expect(new Date(after!.trial_ends_at).toISOString()).toBe(later);
      const { error: tooFar } = await db().rpc("extend_trials", { p_until: new Date(Date.now() + 120 * 86_400_000).toISOString() });
      expect(tooFar?.message).toMatch(/90 days/);
    } finally {
      await db().from("salons").delete().eq("id", salon);
    }
  });

  it("turns on Solo's 100 SMS and one-specialist limit when Solo is paid", async () => {
    const salon = await newSalon("Solo");
    try {
      const { data: invoice } = await db().from("invoices").insert({ salon_id: salon, kind: "plan", plan_code: "solo", prepaid_months: 1, idempotency_key: crypto.randomUUID(), status: "open", subtotal_gel: 19, total_gel: 19, currency: "GEL", due_at: new Date().toISOString() }).select("id").single();
      const { error } = await db().rpc("complete_fake_payment", { p_salon_id: salon, p_invoice_id: invoice!.id });
      expect(error).toBeNull();
      const { data: sub } = await db().from("subscriptions").select("status,plan_code").eq("salon_id", salon).single();
      expect(sub).toEqual({ status: "active", plan_code: "solo" });
      const { data: wallet } = await db().from("sms_wallet").select("included_quota").eq("salon_id", salon).single();
      expect(wallet?.included_quota).toBe(100);
      const { data: row } = await db().from("salons").select("subscription_tier").eq("id", salon).single();
      expect(row?.subscription_tier).toBe("starter");
      const first = await db().from("staff").insert({ salon_id: salon, full_name: "Ana", sort_order: 1 });
      expect(first.error).toBeNull();
      const second = await db().from("staff").insert({ salon_id: salon, full_name: "Nino", sort_order: 2 });
      expect(second.error?.message).toMatch(/Staff plan limit reached/);
    } finally {
      await db().from("salons").delete().eq("id", salon);
    }
  });

  it("never bills extra specialists while a salon is on its trial", async () => {
    const salon = await newSalon("Trial");
    try {
      await db().from("staff").insert(Array.from({ length: 9 }, (_, index) => ({ salon_id: salon, full_name: `Specialist ${index + 1}`, sort_order: index })));
      const lastMonth = new Date(Date.now() - 35 * 86_400_000).toISOString();
      await db().from("sms_wallet").update({ period_start: lastMonth }).eq("salon_id", salon);
      const { error } = await db().rpc("process_billing_cycle");
      expect(error).toBeNull();
      const { count } = await db().from("invoices").select("id", { count: "exact", head: true }).eq("salon_id", salon);
      expect(count).toBe(0);
    } finally {
      await db().from("salons").delete().eq("id", salon);
    }
  });
});
