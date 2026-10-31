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
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

describe.skipIf(!canRun)("team invites and master access (integration)", { timeout: 60000 }, () => {
  let service: SupabaseClient;
  const run = crypto.randomUUID().slice(0, 8);
  const password = `Pw-${randomBytes(12).toString("hex")}`;
  const userIds: string[] = [];
  const as: Record<string, SupabaseClient> = {};
  let salonId = "";
  let staffA = "";
  let staffB = "";
  let clientA = "";
  let clientB = "";
  let visitA = "";
  let visitB = "";

  async function createUser(name: string) {
    const email = `team-${name}-${run}@example.test`;
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw error ?? new Error("user not created");
    userIds.push(data.user.id);
    return { id: data.user.id, email };
  }

  async function signIn(email: string) {
    const client = createClient(url!, anonKey!, options);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  async function invite(by: SupabaseClient, email: string, role: "admin" | "staff", staffId: string | null) {
    const token = newToken();
    const result = await by.rpc("create_team_invite", { p_salon_id: salonId, p_email: email, p_role: role, p_staff_id: staffId, p_token_hash: hash(token) });
    return { token, ...result };
  }

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, options);
    const { data: salon, error: salonError } = await service.from("salons").insert({
      name: "Team access fixture", slug: `team-test-${run}`, subscription_tier: "starter", subscription_status: "active",
    }).select("id").single();
    if (salonError || !salon) throw salonError ?? new Error("salon not created");
    salonId = salon.id;
    await service.from("salon_settings").insert({ salon_id: salonId, salon_name: "Team access fixture", sender_display_name: "moarge", verified_sender_email: "team-test@example.test" });

    const { data: staff, error: staffError } = await service.from("staff").insert([
      { salon_id: salonId, full_name: "Master A", sort_order: 91 },
      { salon_id: salonId, full_name: "Master B", sort_order: 92 },
    ]).select("id,full_name");
    if (staffError || !staff) throw staffError ?? new Error("staff not created");
    staffA = staff.find((row) => row.full_name === "Master A")!.id;
    staffB = staff.find((row) => row.full_name === "Master B")!.id;

    const { data: clients, error: clientError } = await service.from("clients").insert([
      { salon_id: salonId, full_name: "Client A", phone: "+995555000001" },
      { salon_id: salonId, full_name: "Client B", phone: "+995555000002" },
    ]).select("id,full_name");
    if (clientError || !clients) throw clientError ?? new Error("clients not created");
    clientA = clients.find((row) => row.full_name === "Client A")!.id;
    clientB = clients.find((row) => row.full_name === "Client B")!.id;

    const visit = (clientId: string, staffId: string, hour: number) => ({
      salon_id: salonId, client_id: clientId, staff_id: staffId, treatment_date: "2030-01-15", treatment_time: `${hour}:00`,
      treatment_type: "Test", starts_at: `2030-01-15T${hour}:00:00+04:00`, ends_at: `2030-01-15T${hour}:30:00+04:00`,
      status: "scheduled", price_gel: 50, duration_minutes: 30,
    });
    const { data: visits, error: visitError } = await service.from("appointments").insert([visit(clientA, staffA, 11), visit(clientB, staffB, 12)]).select("id,client_id");
    if (visitError || !visits) throw visitError ?? new Error("visits not created");
    visitA = visits.find((row) => row.client_id === clientA)!.id;
    visitB = visits.find((row) => row.client_id === clientB)!.id;

    const owner = await createUser("owner");
    await service.from("user_profiles").upsert({ id: owner.id, email: owner.email, full_name: "Owner" });
    const { error: memberError } = await service.from("salon_memberships").insert({ salon_id: salonId, user_id: owner.id, role: "owner" });
    if (memberError) throw memberError;
    as.owner = await signIn(owner.email);
  });

  afterAll(async () => {
    if (!service) return;
    if (salonId) await service.from("salons").delete().eq("id", salonId);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  it("lets the owner invite a receptionist and two masters who join by link", async () => {
    const reception = await createUser("reception");
    const masterA = await createUser("master-a");
    const masterB = await createUser("master-b");

    const receptionInvite = await invite(as.owner, reception.email, "admin", null);
    expect(receptionInvite.error).toBeNull();
    const accepted = await service.rpc("accept_team_invite", { p_token_hash: hash(receptionInvite.token), p_user_id: reception.id });
    expect(accepted.error).toBeNull();
    expect(accepted.data).toBe(salonId);
    as.reception = await signIn(reception.email);

    // A receptionist may invite masters but not admins.
    const deniedAdmin = await invite(as.reception, `x-${run}@example.test`, "admin", null);
    expect(deniedAdmin.error?.code).toBe("42501");

    const inviteA = await invite(as.reception, masterA.email.toUpperCase(), "staff", staffA);
    expect(inviteA.error).toBeNull();
    // The link only works for the invited email, and only once.
    const wrongUser = await service.rpc("accept_team_invite", { p_token_hash: hash(inviteA.token), p_user_id: masterB.id });
    expect(wrongUser.error?.code).toBe("42501");
    expect((await service.rpc("accept_team_invite", { p_token_hash: hash(inviteA.token), p_user_id: masterA.id })).error).toBeNull();
    expect((await service.rpc("accept_team_invite", { p_token_hash: hash(inviteA.token), p_user_id: masterA.id })).error?.code).toBe("P0002");

    // A master who already has a login cannot be invited again.
    expect((await invite(as.owner, `other-${run}@example.test`, "staff", staffA)).error?.code).toBe("P0002");

    const inviteB = await invite(as.owner, masterB.email, "staff", staffB);
    expect((await service.rpc("accept_team_invite", { p_token_hash: hash(inviteB.token), p_user_id: masterB.id })).error).toBeNull();

    as.masterA = await signIn(masterA.email);
    as.masterB = await signIn(masterB.email);
    const { data: link } = await service.from("staff").select("user_id").eq("id", staffA).single();
    expect(link?.user_id).toBe(masterA.id);
  });

  it("shows a master only their own visits, clients and time", async () => {
    const { data: visits } = await as.masterA.from("appointments").select("id").eq("salon_id", salonId);
    expect(visits?.map((row) => row.id)).toEqual([visitA]);
    const { data: clients } = await as.masterA.from("clients").select("id").eq("salon_id", salonId);
    expect(clients?.map((row) => row.id)).toEqual([clientA]);

    const { data: all } = await as.reception.from("appointments").select("id").eq("salon_id", salonId);
    expect(all?.length).toBe(2);

    // Status and notes of an own visit: allowed.
    const own = await as.masterA.from("appointments").update({ status: "arrived", notes: "on time" }).eq("id", visitA).select("id");
    expect(own.error).toBeNull();
    expect(own.data?.length).toBe(1);
    // Price, time or another master's visit: refused.
    expect((await as.masterA.from("appointments").update({ price_gel: 1 }).eq("id", visitA).select("id")).error?.code).toBe("42501");
    expect((await as.masterA.from("appointments").update({ status: "canceled" }).eq("id", visitA).select("id")).error?.code).toBe("42501");
    const other = await as.masterA.from("appointments").update({ notes: "x" }).eq("id", visitB).select("id");
    expect(other.data ?? []).toEqual([]);

    expect((await as.masterA.from("clients").insert({ salon_id: salonId, full_name: "Sneaky", phone: "+995555000009" })).error).not.toBeNull();
    expect((await as.masterA.from("clients").update({ full_name: "Changed" }).eq("id", clientA).select("id")).data ?? []).toEqual([]);

    const ownBlock = await as.masterA.from("time_off").insert({ salon_id: salonId, staff_id: staffA, starts_at: "2030-01-16T10:00:00+04:00", ends_at: "2030-01-16T11:00:00+04:00" });
    expect(ownBlock.error).toBeNull();
    const otherBlock = await as.masterA.from("time_off").insert({ salon_id: salonId, staff_id: staffB, starts_at: "2030-01-16T10:00:00+04:00", ends_at: "2030-01-16T11:00:00+04:00" });
    expect(otherBlock.error).not.toBeNull();
  });

  it("keeps payments and the team list with the salon office", async () => {
    await service.from("appointments").update({ status: "completed" }).eq("id", visitA);
    const pay = await as.masterA.rpc("record_visit_payment", { p_appointment_id: visitA, p_price_gel: 50, p_discount_gel: 0, p_tip_gel: 0, p_cash_gel: 50, p_card_gel: 0 });
    expect(pay.error?.code).toBe("42501");
    const paid = await as.reception.rpc("record_visit_payment", { p_appointment_id: visitA, p_price_gel: 50, p_discount_gel: 0, p_tip_gel: 0, p_cash_gel: 50, p_card_gel: 0 });
    expect(paid.error).toBeNull();
    expect((await as.masterA.from("visit_payments").select("id").eq("salon_id", salonId)).data?.length).toBe(1);
    expect((await as.masterB.from("visit_payments").select("id").eq("salon_id", salonId)).data?.length).toBe(0);
    expect((await as.masterA.from("team_invites").select("id").eq("salon_id", salonId)).data ?? []).toEqual([]);
  });

  it("lets only the owner change roles, and nobody edits memberships directly", async () => {
    const { data: me } = await as.reception.auth.getUser();
    const selfPromote = await as.reception.from("salon_memberships").update({ role: "owner" }).eq("user_id", me.user!.id).select("id");
    expect(selfPromote.error ?? (selfPromote.data?.length === 0 ? "no rows" : null)).not.toBeNull();
    const { data: masterB } = await as.masterB.auth.getUser();
    expect((await as.reception.rpc("update_team_member", { p_salon_id: salonId, p_user_id: masterB.user!.id, p_role: "admin", p_is_active: true })).error?.code).toBe("42501");
    const { data: owner } = await as.owner.auth.getUser();
    expect((await as.owner.rpc("update_team_member", { p_salon_id: salonId, p_user_id: owner.user!.id, p_role: "admin", p_is_active: true })).error?.code).toBe("42501");
  });

  it("removes a master completely and does not give them a new salon", async () => {
    const { data: masterA } = await as.masterA.auth.getUser();
    expect((await as.owner.rpc("update_team_member", { p_salon_id: salonId, p_user_id: masterA.user!.id, p_role: "staff", p_is_active: false })).error).toBeNull();
    expect((await as.masterA.from("appointments").select("id").eq("salon_id", salonId)).data ?? []).toEqual([]);
    expect((await as.masterA.from("clients").select("id").eq("salon_id", salonId)).data ?? []).toEqual([]);
    const ensured = await as.masterA.rpc("ensure_user_salon", { p_default_salon_name: "Should not exist" });
    expect(ensured.error).toBeNull();
    expect(ensured.data).toBeNull();
    const { data: link } = await service.from("staff").select("user_id").eq("id", staffA).single();
    expect(link?.user_id).toBeNull();
  });
});
