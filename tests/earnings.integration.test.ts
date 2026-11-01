import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against the confirmed staging project (RUN_STAGING_BOOKING_TESTS=true) or a local
// `supabase start` database (RUN_LOCAL_SUPABASE_TESTS=true). Never against anything else.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isConfirmedStaging = (url?.includes("oolsgizchxstiuvzveos.supabase.co") ?? false) && process.env.RUN_STAGING_BOOKING_TESTS === "true";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? "") && process.env.RUN_LOCAL_SUPABASE_TESTS === "true";
const canRun = (isConfirmedStaging || isLocal) && Boolean(serviceKey && anonKey);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const MONDAY = "2030-01-14";
const TUESDAY = "2030-01-15";

describe.skipIf(!canRun)("earnings and commission (integration)", { timeout: 60000 }, () => {
  let service: SupabaseClient;
  let owner: SupabaseClient;
  let reception: SupabaseClient;
  let master: SupabaseClient;
  const run = crypto.randomUUID().slice(0, 8);
  const password = `Pw-${randomBytes(12).toString("hex")}`;
  const userIds: string[] = [];
  let salonId = "";
  let staffA = "";
  let staffB = "";
  let plainService = "";
  let premiumService = "";
  const visit: Record<string, string> = {};

  async function createUser(name: string) {
    const email = `earn-${name}-${run}@example.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw error ?? new Error("user not created");
    userIds.push(data.user.id);
    return { id: data.user.id, email };
  }
  async function signIn(email: string) {
    const signed = createClient(url!, anonKey!, options);
    const { error } = await signed.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return signed;
  }
  async function join(email: string, role: "admin" | "staff", staffId: string | null, id: string) {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    const invited = await owner.rpc("create_team_invite", { p_salon_id: salonId, p_email: email, p_role: role, p_staff_id: staffId, p_token_hash: hash });
    if (invited.error) throw invited.error;
    const accepted = await service.rpc("accept_team_invite", { p_token_hash: hash, p_user_id: id });
    if (accepted.error) throw accepted.error;
  }
  const pay = (id: string, price: number, discount: number, tip: number, cash: number, card: number) =>
    owner.rpc("record_visit_payment", { p_appointment_id: id, p_price_gel: price, p_discount_gel: discount, p_tip_gel: tip, p_cash_gel: cash, p_card_gel: card });

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, options);
    const { data: salon, error } = await service.from("salons").insert({
      name: "Earnings fixture", slug: `earn-test-${run}`, subscription_tier: "starter", subscription_status: "active",
    }).select("id").single();
    if (error || !salon) throw error ?? new Error("salon not created");
    salonId = salon.id;
    await service.from("salon_settings").insert({ salon_id: salonId, salon_name: "Earnings fixture", sender_display_name: "moarge", verified_sender_email: "earn-test@example.test" });

    const { data: staff } = await service.from("staff").insert([
      { salon_id: salonId, full_name: "Master A", sort_order: 91 },
      { salon_id: salonId, full_name: "Master B", sort_order: 92 },
    ]).select("id,full_name");
    staffA = staff!.find((row) => row.full_name === "Master A")!.id;
    staffB = staff!.find((row) => row.full_name === "Master B")!.id;
    // Master A works Monday 10:00-18:00 with a one hour break: 420 minutes.
    await service.from("staff_working_hours").insert([
      { salon_id: salonId, staff_id: staffA, weekday: 1, start_time: "10:00", end_time: "18:00", is_break: false },
      { salon_id: salonId, staff_id: staffA, weekday: 1, start_time: "13:00", end_time: "14:00", is_break: true },
    ]);
    const { data: services } = await service.from("services").insert([
      { salon_id: salonId, name_ka: "მანიკური", name_en: "Manicure", duration_minutes: 60, price_gel: 100 },
      { salon_id: salonId, name_ka: "შეღებვა", name_en: "Color", duration_minutes: 120, price_gel: 200 },
    ]).select("id,name_en");
    plainService = services!.find((row) => row.name_en === "Manicure")!.id;
    premiumService = services!.find((row) => row.name_en === "Color")!.id;

    const { data: clients } = await service.from("clients").insert([
      { salon_id: salonId, full_name: "Client One", phone: "+995555200001" },
      { salon_id: salonId, full_name: "Client Two", phone: "+995555200002" },
    ], { defaultToNull: false }).select("id,phone");
    const one = clients!.find((row) => row.phone === "+995555200001")!.id;
    const two = clients!.find((row) => row.phone === "+995555200002")!.id;

    const row = (key: string, client: string, staffId: string, serviceId: string, date: string, hour: number, minutes: number, status: string, price: number) => ({
      key, value: {
        salon_id: salonId, client_id: client, staff_id: staffId, service_id: serviceId, treatment_date: date, treatment_time: `${hour}:00`,
        treatment_type: "Test", service_name: serviceId === premiumService ? "Color" : "Manicure",
        starts_at: `${date}T${hour}:00:00+04:00`, ends_at: new Date(Date.parse(`${date}T${hour}:00:00+04:00`) + minutes * 60_000).toISOString(),
        status, price_gel: price, duration_minutes: minutes,
      },
    });
    const rows = [
      row("plain", one, staffA, plainService, MONDAY, 10, 60, "completed", 100),
      row("premium", two, staffA, premiumService, MONDAY, 11, 120, "completed", 200),
      row("noshow", one, staffA, plainService, MONDAY, 15, 60, "no_show", 100),
      row("unpaid", two, staffB, plainService, TUESDAY, 12, 60, "completed", 60),
      row("canceled", one, staffB, plainService, TUESDAY, 14, 60, "canceled", 100),
    ];
    const { data: inserted, error: visitError } = await service.from("appointments").insert(rows.map((item) => item.value)).select("id,starts_at");
    if (visitError || !inserted) throw visitError ?? new Error("visits not created");
    rows.forEach((item) => { visit[item.key] = inserted.find((created) => Date.parse(created.starts_at) === Date.parse(item.value.starts_at))!.id; });

    const ownerUser = await createUser("owner");
    await service.from("user_profiles").upsert({ id: ownerUser.id, email: ownerUser.email, full_name: "Owner" });
    await service.from("salon_memberships").insert({ salon_id: salonId, user_id: ownerUser.id, role: "owner" });
    owner = await signIn(ownerUser.email);
    const receptionUser = await createUser("reception");
    await join(receptionUser.email, "admin", null, receptionUser.id);
    reception = await signIn(receptionUser.email);
    const masterUser = await createUser("master");
    await join(masterUser.email, "staff", staffA, masterUser.id);
    master = await signIn(masterUser.email);
  });

  afterAll(async () => {
    if (!service) return;
    if (salonId) await service.from("salons").delete().eq("id", salonId);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  it("lets only the owner set commission and who sees earnings", async () => {
    expect((await reception.from("staff").update({ commission_percent: 90 }).eq("id", staffA).select("id")).error?.code).toBe("42501");
    expect((await reception.from("salon_settings").update({ admins_see_earnings: true }).eq("salon_id", salonId).select("salon_id")).error?.code).toBe("42501");
    // Other staff edits by an admin still work.
    expect((await reception.from("staff").update({ full_name: "Master A" }).eq("id", staffA).select("id")).error).toBeNull();

    expect((await owner.from("staff").update({ commission_percent: 40 }).eq("id", staffA).select("id")).error).toBeNull();
    expect((await owner.from("services").update({ commission_percent: 50 }).eq("id", premiumService).select("id")).error).toBeNull();
  });

  it("saves the rate on each payment so later changes do not rewrite payouts", async () => {
    expect((await pay(visit.plain, 100, 10, 5, 95, 0)).error).toBeNull();
    expect((await pay(visit.premium, 200, 0, 0, 0, 200)).error).toBeNull();
    await owner.from("staff").update({ commission_percent: 10 }).eq("id", staffA);
    const { data } = await service.from("visit_payments").select("appointment_id,commission_percent").eq("salon_id", salonId);
    const rate = (id: string) => Number(data!.find((row) => row.appointment_id === id)!.commission_percent);
    expect(rate(visit.plain)).toBe(40);
    expect(rate(visit.premium)).toBe(50);
  });

  it("returns the salon numbers for a period", async () => {
    const { data, error } = await owner.rpc("get_earnings", { p_salon_id: salonId, p_from: MONDAY, p_to: TUESDAY });
    expect(error).toBeNull();
    expect(data.money).toMatchObject({ paid_total: 290, tips: 5, discounts: 10, cash: 95, card: 200, payments: 2, commission: 136, unpaid_count: 1, unpaid_value: 60 });
    expect(data.visits).toEqual({ booked: 4, completed: 3, no_show: 1, canceled: 1 });
    expect(data.clients).toEqual({ served: 2, new: 2 });
    expect(data.expected_total).toBe(360);
    const a = data.masters.find((row: { staff_id: string }) => row.staff_id === staffA);
    expect(a).toMatchObject({ completed: 2, no_show: 1, paid_total: 290, tips: 5, commission: 136, booked_minutes: 180, working_minutes: 420 });
    expect(data.services[0]).toMatchObject({ visits: 2 });
    expect(data.daily).toHaveLength(2);
    expect(data.heatmap).toContainEqual({ weekday: 1, hour: 11, visits: 1 });
  });

  it("gives a master only their own numbers", async () => {
    const { data, error } = await master.rpc("get_earnings", { p_salon_id: salonId, p_from: MONDAY, p_to: TUESDAY });
    expect(error).toBeNull();
    expect(data.visits).toEqual({ booked: 3, completed: 2, no_show: 1, canceled: 0 });
    expect(data.money).toMatchObject({ paid_total: 290, unpaid_count: 0 });
    const b = data.masters.find((row: { staff_id: string }) => row.staff_id === staffB);
    expect(b).toMatchObject({ completed: 0, paid_total: 0 });
  });

  it("refuses other salons and periods over a year", async () => {
    const { data: other } = await service.from("salons").select("id").neq("id", salonId).limit(1).maybeSingle();
    if (other) expect((await owner.rpc("get_earnings", { p_salon_id: other.id, p_from: MONDAY, p_to: TUESDAY })).error?.code).toBe("42501");
    expect((await owner.rpc("get_earnings", { p_salon_id: salonId, p_from: "2029-01-01", p_to: "2030-06-01" })).error?.code).toBe("22023");
  });
});
