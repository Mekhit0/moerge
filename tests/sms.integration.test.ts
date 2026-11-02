import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { smsParts } from "../src/lib/sms";

// Runs only against a local `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true";
const canRun = isLocal && Boolean(serviceKey);

type Job = { id: string; channel: string; message_type: string; body: string; sms_parts: number | null; appointment_id: string };

describe.skipIf(!canRun)("SMS reminders: queue, quota and delivery (integration)", { timeout: 60000 }, () => {
  let db: SupabaseClient;
  const run = crypto.randomUUID().slice(0, 8);
  let salonId = "";
  let staffId = "";
  let clientId = "";
  let hour = 9;

  async function wallet() {
    const { data } = await db.from("sms_wallet").select("included_quota,used_this_period,prepaid_balance").eq("salon_id", salonId).single();
    return data!;
  }

  /** A visit three days out; returns its SMS jobs. */
  async function book() {
    hour += 1;
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const time = `${String(hour).padStart(2, "0")}:00`;
    const { data, error } = await db.from("appointments").insert({
      salon_id: salonId, client_id: clientId, staff_id: staffId, treatment_date: day, treatment_time: time, treatment_type: "მანიკური",
      starts_at: `${day}T${time}:00+04:00`, ends_at: `${day}T${time.replace(":00", ":30")}:00+04:00`, status: "scheduled", price_gel: 40, duration_minutes: 30,
    }).select("id,booking_code").single();
    if (error || !data) throw error ?? new Error("no appointment");
    const { data: jobs } = await db.from("notification_log").select("id,channel,message_type,body,sms_parts,appointment_id,scheduled_at").eq("appointment_id", data.id).eq("channel", "sms");
    return { appointment: data, jobs: (jobs ?? []) as Array<Job & { scheduled_at: string }> };
  }

  async function claim(ids: string[]) {
    const { data, error } = await db.rpc("claim_due_notifications", { p_limit: 100 });
    if (error) throw error;
    return ((data ?? []) as Job[]).filter((job) => ids.includes(job.id));
  }

  beforeAll(async () => {
    db = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: salon, error } = await db.from("salons").insert({ name: "SMS fixture", slug: `sms-test-${run}`, subscription_tier: "professional", subscription_status: "active" }).select("id").single();
    if (error || !salon) throw error ?? new Error("salon not created");
    salonId = salon.id;
    await db.from("salon_settings").insert({ salon_id: salonId, salon_name: "სალონი ია", sender_display_name: "moarge", verified_sender_email: "sms-test@example.test", sms_booking_confirmation: true });
    const { data: staff } = await db.from("staff").insert({ salon_id: salonId, full_name: "Ana", sort_order: 1 }).select("id").single();
    staffId = staff!.id;
    const { data: client } = await db.from("clients").insert({ salon_id: salonId, full_name: "ნინო", phone: "+995555900001", sms_consent: true }, { defaultToNull: false }).select("id").single();
    clientId = client!.id;
    // One package SMS this month and one bought SMS.
    await db.from("sms_wallet").update({ included_quota: 1, used_this_period: 0, prepaid_balance: 1 }).eq("salon_id", salonId);
  });

  afterAll(async () => {
    if (salonId) await db.from("salons").delete().eq("id", salonId);
  });

  it("counts SMS parts the same way in the database and in the app", async () => {
    for (const text of ["", "Code 750934", "a".repeat(161), "ა".repeat(70), "ა".repeat(71), "სალონი ია: ხვალ 12:30-ზე გელოდებით.", "Café"]) {
      const { data } = await db.rpc("sms_segments", { p_text: text });
      expect(data, text).toBe(smsParts(text));
    }
  });

  it("queues short SMS only for the messages the salon switched on", async () => {
    const { appointment, jobs } = await book();
    const types = jobs.map((job) => job.message_type).sort();
    expect(types).toEqual(["booking_confirmation", "reminder_24h"]);
    const confirmation = jobs.find((job) => job.message_type === "booking_confirmation")!;
    expect(confirmation.body).toContain(appointment.booking_code);
    expect(confirmation.body).not.toContain("http");
    expect(confirmation.sms_parts).toBe(1);
  });

  it("spends package SMS first, then bought ones, and keeps a sent SMS spent", async () => {
    const first = await book();
    const confirmation = first.jobs.find((job) => job.message_type === "booking_confirmation")!;
    // The earlier test's confirmation is due too; claim both and spend them in order.
    const { data: earlier } = await db.from("notification_log").select("id").eq("salon_id", salonId).eq("channel", "sms").eq("message_type", "booking_confirmation").eq("status", "pending");
    const ids = (earlier ?? []).map((row) => row.id);
    const claimed = await claim(ids);
    expect(claimed.map((job) => job.id).sort()).toEqual([...ids].sort());
    expect(await wallet()).toMatchObject({ used_this_period: 1, prepaid_balance: 0 });

    for (const job of claimed) {
      const { error } = await db.rpc("record_notification_result", { p_id: job.id, p_status: job.id === confirmation.id ? "sent" : "failed", p_provider_message_id: job.id === confirmation.id ? `ubill-${run}` : null, p_cost: 0.01, p_error: null, p_next_attempt_at: null });
      expect(error).toBeNull();
    }
    // The failed one gave its SMS back; the sent one stays spent.
    // Spent = package SMS used + bought SMS gone (there was 1 bought SMS).
    const after = await wallet();
    expect(after.used_this_period + (1 - after.prepaid_balance)).toBe(1);
    const { data: sent } = await db.from("notification_log").select("status,sms_quota_reserved").eq("id", confirmation.id).single();
    expect(sent).toEqual({ status: "sent", sms_quota_reserved: false });
  });

  it("marks delivery from uBill's report", async () => {
    const { data: count } = await db.rpc("record_sms_delivery", { p_provider_message_id: `ubill-${run}`, p_status_id: 1 });
    expect(count).toBe(1);
    const { data: interim } = await db.rpc("record_sms_delivery", { p_provider_message_id: `ubill-${run}`, p_status_id: 3 });
    expect(interim).toBe(0);
    const { data: row } = await db.from("notification_log").select("status").eq("provider_message_id", `ubill-${run}`).single();
    expect(row?.status).toBe("delivered");
  });

  it("skips an SMS when none are left, without charging anything", async () => {
    await db.from("sms_wallet").update({ used_this_period: 1, prepaid_balance: 0 }).eq("salon_id", salonId);
    const { jobs } = await book();
    const confirmation = jobs.find((job) => job.message_type === "booking_confirmation")!;
    expect(await claim([confirmation.id])).toEqual([]);
    const { data: row } = await db.from("notification_log").select("status,error,sms_quota_reserved").eq("id", confirmation.id).single();
    expect(row).toEqual({ status: "suppressed", error: "No SMS left", sms_quota_reserved: false });
    expect(await wallet()).toMatchObject({ used_this_period: 1, prepaid_balance: 0 });
  });

  it("refuses the queue functions to anyone but the server", async () => {
    const anon = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const [fn, args] of [["record_sms_delivery", { p_provider_message_id: "x", p_status_id: 1 }], ["claim_due_notifications", { p_limit: 1 }]] as const) {
      const { error } = await anon.rpc(fn, args);
      expect(error, fn).not.toBeNull();
    }
  });
});

describe.skipIf(!canRun)("SMS on a trial (integration)", { timeout: 60000 }, () => {
  it("skips SMS for a salon on trial and says why", async () => {
    const db = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const run = crypto.randomUUID().slice(0, 8);
    const { data: salon } = await db.from("salons").insert({ name: "Trial SMS", slug: `sms-trial-${run}`, subscription_tier: "starter", subscription_status: "trialing", trial_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).select("id").single();
    try {
      await db.from("salon_settings").insert({ salon_id: salon!.id, salon_name: "Trial", sender_display_name: "moarge", verified_sender_email: "trial@example.test", sms_booking_confirmation: true });
      const { data: staff } = await db.from("staff").insert({ salon_id: salon!.id, full_name: "Ana", sort_order: 1 }).select("id").single();
      const { data: client } = await db.from("clients").insert({ salon_id: salon!.id, full_name: "ნინო", phone: "+995555900002", sms_consent: true }, { defaultToNull: false }).select("id").single();
      const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      const { data: visit } = await db.from("appointments").insert({ salon_id: salon!.id, client_id: client!.id, staff_id: staff!.id, treatment_date: day, treatment_time: "12:00", treatment_type: "Test", starts_at: `${day}T12:00:00+04:00`, ends_at: `${day}T12:30:00+04:00`, status: "scheduled", price_gel: 40, duration_minutes: 30 }).select("id").single();
      await db.rpc("claim_due_notifications", { p_limit: 100 });
      const { data: row } = await db.from("notification_log").select("status,error").eq("appointment_id", visit!.id).eq("channel", "sms").eq("message_type", "booking_confirmation").single();
      expect(row).toEqual({ status: "suppressed", error: "SMS starts with a paid plan" });
    } finally {
      await db.from("salons").delete().eq("id", salon!.id);
    }
  });
});
