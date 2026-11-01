import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against the confirmed staging project (RUN_STAGING_BOOKING_TESTS=true) or a local
// `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true). Never against anything else.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isConfirmedStaging = (url?.includes("oolsgizchxstiuvzveos.supabase.co") ?? false) && process.env.RUN_STAGING_BOOKING_TESTS === "true";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true";
const canRun = (isConfirmedStaging || isLocal) && Boolean(serviceKey);

function tbilisiDate(daysAhead: number) {
  const now = new Date(Date.now() + 4 * 3_600_000 + daysAhead * 86_400_000);
  return now.toISOString().slice(0, 10);
}

describe.skipIf(!canRun)("public booking never changes an existing client (integration)", { timeout: 60000 }, () => {
  let service: SupabaseClient;
  const run = randomBytes(4).toString("hex");
  let salonId = "";
  let serviceId = "";
  let clientId = "";
  const phone = "+995555300001";

  const book = (fields: { name: string; phone: string; email: string | null; hour: number }) => service.rpc("create_appointment", {
    p_salon_id: salonId, p_service_id: serviceId, p_date: tbilisiDate(3), p_start_time: `${fields.hour}:00:00`, p_staff_id: null,
    p_client_id: null, p_full_name: fields.name, p_phone: fields.phone, p_email: fields.email, p_notes: null,
    p_email_consent: true, p_sms_consent: true, p_language: "en",
  });

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: salon, error } = await service.from("salons").insert({
      name: "Public booking fixture", slug: `pub-test-${run}`, subscription_tier: "starter", subscription_status: "active",
    }).select("id").single();
    if (error || !salon) throw error ?? new Error("salon not created");
    salonId = salon.id;
    await service.from("salon_settings").insert({ salon_id: salonId, salon_name: "Public booking fixture", sender_display_name: "moarge", verified_sender_email: "pub-test@example.test" });
    const { data: staff } = await service.from("staff").insert({ salon_id: salonId, full_name: "Master One", sort_order: 91 }).select("id").single();
    const { data: svc } = await service.from("services").insert({ salon_id: salonId, name_ka: "მანიკური", name_en: "Manicure", duration_minutes: 30, price_gel: 40 }).select("id").single();
    serviceId = svc!.id;
    await service.from("staff_services").insert({ salon_id: salonId, staff_id: staff!.id, service_id: serviceId });
    await service.from("staff_working_hours").insert([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      salon_id: salonId, staff_id: staff!.id, weekday, start_time: "09:00", end_time: "20:00", is_break: false,
    })));
    const { data: client, error: clientError } = await service.from("clients").insert({
      salon_id: salonId, full_name: "Real Client", phone, email: `real-${run}@example.test`,
      sms_consent: false, email_consent: false, preferred_language: "ka", is_archived: true,
    }).select("id").single();
    if (clientError || !client) throw clientError ?? new Error("client not created");
    clientId = client.id;
  });

  afterAll(async () => {
    if (service && salonId) await service.from("salons").delete().eq("id", salonId);
  });

  it("books the existing client without touching their card", async () => {
    const { data, error } = await book({ name: "Someone Else", phone, email: `other-${run}@example.test`, hour: 12 });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.client_id).toBe(clientId);

    const { data: client } = await service.from("clients")
      .select("full_name,email,sms_consent,email_consent,preferred_language,is_archived").eq("id", clientId).single();
    expect(client).toEqual({
      full_name: "Real Client", email: `real-${run}@example.test`, sms_consent: false, email_consent: false,
      preferred_language: "ka", is_archived: false,
    });
  });

  it("still creates a new client from the form for a new number", async () => {
    const { data, error } = await book({ name: "New Person", phone: "+995555300002", email: `new-${run}@example.test`, hour: 14 });
    expect(error).toBeNull();
    expect(data.success).toBe(true);
    const { data: client } = await service.from("clients").select("full_name,email,sms_consent").eq("id", data.client_id).single();
    expect(client).toEqual({ full_name: "New Person", email: `new-${run}@example.test`, sms_consent: true });
  });
});
