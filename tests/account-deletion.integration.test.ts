import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Runs only against a local `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true" && Boolean(serviceKey);

describe.skipIf(!canRun)("Deleting a salon (integration)", { timeout: 60000 }, () => {
  const db = () => createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });

  async function user(name: string) {
    const email = `${name}-${crypto.randomUUID().slice(0, 8)}@example.test`;
    const { data, error } = await db().auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
    if (error || !data.user) throw error ?? new Error("user not created");
    await db().from("user_profiles").upsert({ id: data.user.id, email, full_name: name });
    return data.user.id;
  }

  it("deletes everything in an expired salon, keeps its invoices in the archive, and returns logins with no other salon", async () => {
    const run = crypto.randomUUID().slice(0, 8);
    const { data: salon } = await db().from("salons").insert({ name: "Gone", slug: `gone-${run}`, subscription_tier: "professional", subscription_status: "trialing" }).select("id").single();
    const salonId = salon!.id as string;
    const owner = await user("owner");
    const master = await user("master");
    const both = await user("both");
    const { data: other } = await db().from("salons").insert({ name: "Other", slug: `other-${run}`, subscription_tier: "professional", subscription_status: "trialing" }).select("id").single();
    try {
      await db().from("salon_memberships").insert([
        { salon_id: salonId, user_id: owner, role: "owner" },
        { salon_id: salonId, user_id: master, role: "staff" },
        { salon_id: salonId, user_id: both, role: "admin" },
        { salon_id: other!.id, user_id: both, role: "owner" },
      ]);
      await db().from("staff").insert({ salon_id: salonId, full_name: "Ana", sort_order: 1, user_id: master });
      await db().from("clients").insert({ salon_id: salonId, full_name: "Nino", phone: `+99555${run.replace(/\D/g, "").padEnd(7, "1").slice(0, 7)}` }, { defaultToNull: false });
      await db().from("invoices").insert({ salon_id: salonId, kind: "plan", plan_code: "business", prepaid_months: 1, idempotency_key: crypto.randomUUID(), status: "paid", subtotal_gel: 59, total_gel: 59, currency: "GEL", due_at: new Date().toISOString() });
      // The trial has run out: the salon is read-only, and must still be deletable.
      await db().from("subscriptions").update({ trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("salon_id", salonId);

      const { error: denied } = await db().rpc("delete_salon", { p_salon_id: salonId, p_actor: master });
      expect(denied?.message).toMatch(/Only the salon owner/);

      const { data: orphans, error } = await db().rpc("delete_salon", { p_salon_id: salonId, p_actor: owner });
      expect(error).toBeNull();
      expect(new Set(orphans as string[])).toEqual(new Set([owner, master]));

      for (const table of ["salons", "clients", "staff", "subscriptions", "invoices", "salon_memberships"]) {
        const column = table === "salons" ? "id" : "salon_id";
        const { count } = await db().from(table).select("*", { count: "exact", head: true }).eq(column, salonId);
        expect(count, table).toBe(0);
      }
      const { data: archive } = await db().from("billing_archive").select("salon_name,invoices").eq("salon_id", salonId).single();
      expect(archive?.salon_name).toBe("Gone");
      expect((archive?.invoices as unknown[]).length).toBe(1);
      const { count: otherMembership } = await db().from("salon_memberships").select("*", { count: "exact", head: true }).eq("user_id", both);
      expect(otherMembership).toBe(1);
    } finally {
      await db().from("salons").delete().in("id", [salonId, other!.id]);
      for (const id of [owner, master, both]) await db().auth.admin.deleteUser(id);
      await db().from("billing_archive").delete().eq("salon_id", salonId);
    }
  });
});
