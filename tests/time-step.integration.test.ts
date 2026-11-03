import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Runs only against a local `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true" && Boolean(serviceKey);

describe.skipIf(!canRun)("Online booking time step (integration)", { timeout: 60000 }, () => {
  it("offers online times on the salon's step, while the calendar keeps quarter hours", async () => {
    const db = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const run = crypto.randomUUID().slice(0, 8);
    const { data: salon } = await db.from("salons").insert({ name: "Step", slug: `step-${run}`, subscription_tier: "professional", subscription_status: "active" }).select("id").single();
    try {
      await db.from("salon_settings").insert({ salon_id: salon!.id, salon_name: "Step", sender_display_name: "moarge", verified_sender_email: "step@example.test", slot_interval_minutes: 30 });
      const { data: staff } = await db.from("staff").insert({ salon_id: salon!.id, full_name: "Ana", sort_order: 1 }).select("id").single();
      const { data: service } = await db.from("services").insert({ salon_id: salon!.id, name_ka: "მანიკური", name_en: "Manicure", price_gel: 40, duration_minutes: 30 }).select("id").single();
      await db.from("staff_services").insert({ salon_id: salon!.id, staff_id: staff!.id, service_id: service!.id });
      const day = new Date(Date.now() + 3 * 86_400_000);
      const date = day.toISOString().slice(0, 10);
      await db.from("staff_working_hours").insert({ salon_id: salon!.id, staff_id: staff!.id, weekday: day.getUTCDay(), start_time: "10:00", end_time: "12:00" });

      const times = async (online: boolean) => {
        const { data, error } = await db.rpc("get_available_slots", { p_salon_id: salon!.id, p_service_id: service!.id, p_date: date, p_online: online });
        if (error) throw error;
        return (data as Array<{ slot_time: string }>).map((slot) => slot.slot_time.slice(0, 5));
      };
      expect(await times(true)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
      expect(await times(false)).toEqual(["10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30"]);

      await db.from("salon_settings").update({ slot_interval_minutes: 60 }).eq("salon_id", salon!.id);
      expect(await times(true)).toEqual(["10:00", "11:00"]);
    } finally {
      await db.from("salons").delete().eq("id", salon!.id);
    }
  });
});
