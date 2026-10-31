import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isConfirmedStaging = SUPABASE_URL?.includes("oolsgizchxstiuvzveos.supabase.co") ?? false;
const hasSupabaseCredentials = Boolean(isConfirmedStaging && SUPABASE_ANON_KEY);

const hasStaffCredentials = Boolean(process.env.TEST_STAFF_EMAIL && process.env.TEST_STAFF_PASSWORD);
const hasConfiguredStaffRole = process.env.TEST_STAFF_ROLE === "staff";

describe.skipIf(!hasSupabaseCredentials)("Supabase Row Level Security (RLS), Multi-Tenant Isolation & Public Booking Ecosystem", { timeout: 35000 }, () => {
  it("blocks unauthenticated anon clients from reading salon business tables directly", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const { data: clients } = await anonClient.from("clients").select("*");
    const { data: appointments } = await anonClient
      .from("appointments")
      .select("*");
    const { data: reminders } = await anonClient.from("reminders").select("*");
    const { data: settings } = await anonClient
      .from("salon_settings")
      .select("*");

    expect(clients ?? []).toHaveLength(0);
    expect(appointments ?? []).toHaveLength(0);
    expect(reminders ?? []).toHaveLength(0);
    expect(settings ?? []).toHaveLength(0);
  });

  it("blocks unauthenticated anon clients from inserting records with a spoofed salon_id", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const { error } = await anonClient.from("clients").insert({
      salon_id: "11111111-1111-4111-8111-111111111111",
      full_name: "Unauthorized Spoof",
      email: "spoof@example.com",
    });

    expect(error).not.toBeNull();
  });

  it("blocks unauthenticated anon clients from invoking sensitive internal RPCs", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const revokedCalls = [
      ["claim_due_reminders", { p_limit: 5, p_salon_id: null, p_specific_reminder_id: null }],
      ["record_reminder_send_result", { p_reminder_id: "00000000-0000-0000-0000-000000000000", p_outcome: "api_accepted", p_provider_message_id: null, p_recipient_email: null, p_subject: null, p_error_message: null, p_next_retry_at: null, p_status_code: null, p_is_dry_run: false, p_raw_payload: {} }],
      ["process_email_webhook_event", { p_provider_message_id: "test_msg_id", p_event_type: "delivered", p_error_message: null, p_raw_payload: {} }],
      ["unsubscribe_client_by_token", { p_token: "00000000-0000-0000-0000-000000000000" }],
      ["submit_public_booking", { p_salon_slug: "demo", p_full_name: "Test Client", p_email: "test@example.com", p_phone: null, p_treatment_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), p_treatment_time: "10:00", p_treatment_type: "service-id", p_notes: null, p_email_consent: true, p_client_ip: null }],
      ["get_salon_date_availability", { p_salon_slug: "demo", p_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), p_salon_id: null, p_exclude_appointment_id: null }],
      ["get_public_salon_booking_info", { p_slug: "demo" }],
      ["get_available_slots", { p_salon_id: "00000000-0000-0000-0000-000000000000", p_service_id: "00000000-0000-0000-0000-000000000000", p_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), p_staff_id: null, p_exclude_appointment_id: null }],
      ["find_booking_by_code", { p_code: "123456", p_phone: "+995555000000" }],
      ["public_booking_guard", { p_salon_id: "00000000-0000-0000-0000-000000000000", p_phone: "+995555000000" }],
    ] as const;
    for (const [name, params] of revokedCalls) {
      const { data, error } = await anonClient.rpc(name, params);
      expect(error, `${name} should be inaccessible to anon`).not.toBeNull();
      expect(error?.message).toMatch(/permission denied|not authorized/i);
      expect(data).toBeNull();
    }
  });

  it("blocks anon clients from reading salon_settings", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const { data } = await anonClient.from("salon_settings").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it.skipIf(!hasStaffCredentials || !hasConfiguredStaffRole)(
    "prevents a staff membership from changing salon settings directly",
    async () => {
      const staffClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
      });

      const { error: authErr } = await staffClient.auth.signInWithPassword({
        email: process.env.TEST_STAFF_EMAIL!,
        password: process.env.TEST_STAFF_PASSWORD!,
      });
      expect(authErr).toBeNull();
      const { data: currentUser } = await staffClient.auth.getUser();

      const { data: membership, error: membershipError } = await staffClient
        .from("salon_memberships")
        .select("salon_id, role")
        .eq("user_id", currentUser.user?.id ?? "")
        .eq("role", "staff")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      expect(membershipError).toBeNull();
      expect(membership).not.toBeNull();
      const { data: updated, error } = await staffClient
        .from("salon_settings")
        .update({ salon_name: "Unauthorized Settings Change" })
        .eq("salon_id", membership!.salon_id)
        .select("salon_id");
      expect(error).toBeNull();
      expect(updated ?? []).toHaveLength(0);
    }
  );

  it.skipIf(!hasStaffCredentials)(
    "allows authenticated salon staff to access their authorized salon records and enforces multi-tenant isolation",
    async () => {
      const staffClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
      });

      const { data: authData, error: authErr } =
        await staffClient.auth.signInWithPassword({
          email: process.env.TEST_STAFF_EMAIL!,
          password: process.env.TEST_STAFF_PASSWORD!,
        });

      expect(authErr).toBeNull();
      expect(authData.user?.email).toBe(process.env.TEST_STAFF_EMAIL);

      const { data: clients, error: clientsErr } = await staffClient
        .from("clients")
        .select("*");

      expect(clientsErr).toBeNull();
      expect(Array.isArray(clients)).toBe(true);

      // Attempt to insert a client with another salon's ID (multi-tenant isolation check)
      const { error: crossTenantError } = await staffClient
        .from("clients")
        .insert({
          salon_id: "99999999-9999-4999-8999-999999999999",
          full_name: "Other Salon Client",
          email: "other@example.com",
        });

      expect(crossTenantError).not.toBeNull();
    },
    15000
  );

  it(
    "public booking and availability RPCs cannot be called directly by anon",
    async () => {
      const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
      });
      const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const calls = [
        ["get_public_salon_booking_info", { p_slug: "demo" }],
        ["get_salon_date_availability", { p_salon_slug: "demo", p_date: date, p_salon_id: null, p_exclude_appointment_id: null }],
        ["get_available_slots", { p_salon_id: "00000000-0000-0000-0000-000000000000", p_service_id: "00000000-0000-0000-0000-000000000000", p_date: date, p_staff_id: null, p_exclude_appointment_id: null }],
        ["submit_public_booking", { p_salon_slug: "demo", p_full_name: "Test Client", p_email: "test@example.test", p_phone: "+995555000000", p_treatment_date: date, p_treatment_time: "10:00", p_treatment_type: "test-service", p_notes: null, p_email_consent: false, p_client_ip: null }],
      ] as const;
      for (const [name, params] of calls) {
        const { data, error } = await anonClient.rpc(name, params);
        expect(error, `${name} should be inaccessible to anon`).not.toBeNull();
        expect(error?.message).toMatch(/permission denied|not authorized/i);
        expect(data).toBeNull();
      }
    },
    20000
  );

  it("does not allow anon callers to bypass database-backed booking rate limits", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anonClient.rpc("consume_public_request_limit", {
      p_rate_key: "integration-test",
      p_limit: 1,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied|not authorized/i);
    expect(data).toBeNull();
  }, 30000);

  it("rejects unauthorized cron requests without valid CRON_SECRET", async () => {
    const { GET } = await import("../src/app/api/cron/process-reminders/route");

    // 1. Missing Authorization header
    const unauthedReq = new Request("http://localhost/api/cron/process-reminders", {
      method: "GET",
    });
    const unauthedRes = await GET(unauthedReq as any);
    expect([401, 500]).toContain(unauthedRes.status);

    // 2. Invalid Authorization header
    const invalidReq = new Request("http://localhost/api/cron/process-reminders", {
      method: "GET",
      headers: {
        authorization: `Bearer ${randomUUID()}`,
      },
    });
    const invalidRes = await GET(invalidReq as any);
    expect([401, 500]).toContain(invalidRes.status);
  });

  it("handles new user registration through /api/auth/register", async () => {
    const { POST: registerPost } = await import("../src/app/api/auth/register/route");

    // 1. Invalid email
    const badEmailReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "ValidPassword123!",
      }),
    });
    const badEmailRes = await registerPost(badEmailReq as any);
    expect(badEmailRes.status).toBe(400);

    // 2. Short password
    const shortPassReq = new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "valid@example.com",
        password: "short",
      }),
    });
    const shortPassRes = await registerPost(shortPassReq as any);
    expect(shortPassRes.status).toBe(400);

    // 3. Valid registration (if service role key is present)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const runId = Date.now();
      const testRegEmail = `new_owner_${runId}@example.com`;
      const regReq = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testRegEmail,
          password: `Generated-${crypto.randomUUID()}!`,
          fullName: "New Owner Test",
          salonName: "Test Beauty Lounge",
        }),
      });

      const regRes = await registerPost(regReq as any);
      expect(regRes.status).toBe(200);
      const regJson = await regRes.json();
      expect(regJson.success).toBe(true);
      expect(regJson.user?.email).toBe(testRegEmail);

      // Clean up test user
      const { createServiceClient } = await import("../src/lib/supabase/server");
      const adminClient = createServiceClient();
      if (regJson.user?.id) {
        await adminClient.auth.admin.deleteUser(regJson.user.id);
      }
    }
  });
});
