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

describe.skipIf(!canRun)("crm: client numbers, notes and merge (integration)", { timeout: 60000 }, () => {
  let service: SupabaseClient;
  let owner: SupabaseClient;
  let master: SupabaseClient;
  const run = crypto.randomUUID().slice(0, 8);
  const password = `Pw-${randomBytes(12).toString("hex")}`;
  const userIds: string[] = [];
  let salonId = "";
  let staffA = "";
  let staffB = "";
  const client: Record<"anna" | "anna2" | "bela", string> = { anna: "", anna2: "", bela: "" };

  async function createUser(name: string) {
    const email = `crm-${name}-${run}@example.test`;
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

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, options);
    const { data: salon, error } = await service.from("salons").insert({
      name: "CRM fixture", slug: `crm-test-${run}`, subscription_tier: "starter", subscription_status: "active",
    }).select("id").single();
    if (error || !salon) throw error ?? new Error("salon not created");
    salonId = salon.id;
    await service.from("salon_settings").insert({ salon_id: salonId, salon_name: "CRM fixture", sender_display_name: "moarge", verified_sender_email: "crm-test@example.test" });

    const { data: staff } = await service.from("staff").insert([
      { salon_id: salonId, full_name: "Master A", sort_order: 91 },
      { salon_id: salonId, full_name: "Master B", sort_order: 92 },
    ]).select("id,full_name");
    staffA = staff!.find((row) => row.full_name === "Master A")!.id;
    staffB = staff!.find((row) => row.full_name === "Master B")!.id;

    const { data: clients, error: clientError } = await service.from("clients").insert([
      { salon_id: salonId, full_name: "Anna", phone: "+995555100001", tags: ["vip"], birthday: "1990-05-04" },
      { salon_id: salonId, full_name: "Anna", phone: "+995555100002", tags: ["sensitive"], email: `anna-${run}@example.test`, notes: "Old card" },
      { salon_id: salonId, full_name: "Bela", phone: "+995555100003" },
    ], { defaultToNull: false }).select("id,phone");
    if (clientError || !clients) throw clientError ?? new Error("clients not created");
    client.anna = clients.find((row) => row.phone === "+995555100001")!.id;
    client.anna2 = clients.find((row) => row.phone === "+995555100002")!.id;
    client.bela = clients.find((row) => row.phone === "+995555100003")!.id;

    const visit = (clientId: string, staffId: string, date: string, status: string, price: number) => ({
      salon_id: salonId, client_id: clientId, staff_id: staffId, treatment_date: date, treatment_time: "11:00",
      treatment_type: "Test", starts_at: `${date}T11:00:00+04:00`, ends_at: `${date}T11:30:00+04:00`,
      status, price_gel: price, duration_minutes: 30,
    });
    const { data: visits, error: visitError } = await service.from("appointments").insert([
      visit(client.anna, staffA, "2026-01-10", "completed", 100),
      visit(client.anna, staffA, "2026-03-10", "completed", 100),
      visit(client.anna, staffB, "2026-05-10", "completed", 60),
      visit(client.anna, staffB, "2026-06-10", "no_show", 60),
      visit(client.anna2, staffA, "2026-07-01", "completed", 40),
      visit(client.bela, staffB, "2026-07-02", "completed", 80),
    ]).select("id,treatment_date");
    if (visitError || !visits) throw visitError ?? new Error("visits not created");

    const ownerUser = await createUser("owner");
    await service.from("user_profiles").upsert({ id: ownerUser.id, email: ownerUser.email, full_name: "Owner" });
    await service.from("salon_memberships").insert({ salon_id: salonId, user_id: ownerUser.id, role: "owner" });
    owner = await signIn(ownerUser.email);

    // Pay the March visit with a discount: spent counts the paid 80, not the booked 100.
    const march = visits.find((row) => row.treatment_date === "2026-03-10")!.id;
    const paid = await owner.rpc("record_visit_payment", { p_appointment_id: march, p_price_gel: 100, p_discount_gel: 20, p_tip_gel: 10, p_cash_gel: 90, p_card_gel: 0 });
    if (paid.error) throw paid.error;

    const masterUser = await createUser("master");
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    const invited = await owner.rpc("create_team_invite", { p_salon_id: salonId, p_email: masterUser.email, p_role: "staff", p_staff_id: staffA, p_token_hash: hash });
    if (invited.error) throw invited.error;
    const accepted = await service.rpc("accept_team_invite", { p_token_hash: hash, p_user_id: masterUser.id });
    if (accepted.error) throw accepted.error;
    master = await signIn(masterUser.email);
  });

  afterAll(async () => {
    if (!service) return;
    if (salonId) await service.from("salons").delete().eq("id", salonId);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  it("gives the office the full numbers per client", async () => {
    const { data, error } = await owner.from("client_stats").select("*").eq("client_id", client.anna).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ visit_count: 3, no_show_count: 1, first_visit: "2026-01-10", last_visit: "2026-05-10", avg_gap_days: 60, birthday: "1990-05-04" });
    expect(Number(data!.total_spent)).toBe(240);
  });

  it("gives a master numbers from their own visits only", async () => {
    const { data } = await master.from("client_stats").select("client_id,visit_count,total_spent").eq("salon_id", salonId);
    const ids = (data ?? []).map((row) => row.client_id).sort();
    expect(ids).toEqual([client.anna, client.anna2].sort());
    const anna = data!.find((row) => row.client_id === client.anna)!;
    expect(anna.visit_count).toBe(2);
    expect(Number(anna.total_spent)).toBe(180);
  });

  it("lets a master add and read notes for their own clients only", async () => {
    const { data: me } = await master.auth.getUser();
    const own = await master.from("client_notes").insert({ salon_id: salonId, client_id: client.anna, kind: "allergy", body: "Latex", created_by: me.user!.id }).select("id").single();
    expect(own.error).toBeNull();
    const other = await master.from("client_notes").insert({ salon_id: salonId, client_id: client.bela, kind: "note", body: "x", created_by: me.user!.id });
    expect(other.error).not.toBeNull();

    const { data: ownerMe } = await owner.auth.getUser();
    const ownerNote = await owner.from("client_notes").insert({ salon_id: salonId, client_id: client.anna, kind: "formula", body: "7.1 + 6%", created_by: ownerMe.user!.id }).select("id").single();
    expect(ownerNote.error).toBeNull();
    expect((await master.from("client_notes").select("id").eq("client_id", client.anna)).data?.length).toBe(2);

    // A master cannot delete the office's note; the office can delete the master's.
    const denied = await master.from("client_notes").delete().eq("id", ownerNote.data!.id).select("id");
    expect(denied.data ?? []).toEqual([]);
    const removed = await owner.from("client_notes").delete().eq("id", own.data!.id).select("id");
    expect(removed.data?.length).toBe(1);
  });

  it("merges a duplicate into the kept client, office only", async () => {
    expect((await master.rpc("merge_clients", { p_keep: client.anna, p_merge: client.anna2 })).error?.code).toBe("P0002");

    const merged = await owner.rpc("merge_clients", { p_keep: client.anna, p_merge: client.anna2 });
    expect(merged.error).toBeNull();
    const { data: gone } = await service.from("clients").select("id").eq("id", client.anna2);
    expect(gone).toEqual([]);
    const { data: kept } = await service.from("clients").select("email,notes,tags,birthday").eq("id", client.anna).single();
    expect(kept).toMatchObject({ email: `anna-${run}@example.test`, notes: "Old card", tags: ["sensitive", "vip"], birthday: "1990-05-04" });
    const { data: stats } = await owner.from("client_stats").select("visit_count").eq("client_id", client.anna).single();
    expect(stats?.visit_count).toBe(4);
  });
});
