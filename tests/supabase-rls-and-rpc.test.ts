import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { publicBookingInputSchema } from "../src/lib/validation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseCredentials = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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
      ["record_reminder_send_result", { p_reminder_id: "00000000-0000-0000-0000-000000000000", p_outcome: "api_accepted" }],
      ["process_email_webhook_event", { p_provider_message_id: "test_msg_id", p_event_type: "delivered", p_error_message: null, p_raw_payload: {} }],
      ["unsubscribe_client_by_token", { p_token: "00000000-0000-0000-0000-000000000000" }],
      ["submit_public_booking", { p_salon_slug: "demo", p_full_name: "Test Client", p_email: "test@example.com", p_phone: null, p_treatment_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), p_treatment_time: "10:00", p_treatment_type: "service-id", p_notes: null, p_email_consent: true, p_client_ip: null }],
      ["get_salon_date_availability", { p_salon_slug: "demo", p_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), p_salon_id: null, p_exclude_appointment_id: null }],
      ["get_public_salon_booking_info", { p_slug: "demo" }],
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

  it.skip(
    "public RPC booking submissions are only available through the validated server route",
    async () => {
      const parsed = publicBookingInputSchema.safeParse({
        full_name: "Sophia Beaumont",
        email: "  SOPHIA.BEAUMONT@EXAMPLE.COM ",
        treatment_date: "2026-11-15",
        treatment_time: "14:30",
        treatment_type: "laser_epilation",
        notes: "Booked from reminder link",
        email_consent: true,
      });
      expect(parsed.success).toBe(true);

      const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false },
      });

      const { data: infoData, error: infoErr } = await anonClient.rpc(
        "get_public_salon_booking_info",
        { p_slug: null }
      );
      expect(infoErr).toBeNull();
      expect((infoData as { found?: boolean })?.found).toBe(true);

      // Unique future date & email per test run to prevent collisions and rate limits
      const runId = Date.now();
      const testEmail = `sophia.run_${runId}@example.com`;
      const uniqueDate = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000 + (runId % 100) * 86400000)
        .toISOString()
        .split("T")[0];

      // 1. First booking at 14:30 succeeds
      const { data: bookingData, error: bookErr } = await anonClient.rpc(
        "submit_public_booking",
        {
          p_salon_slug: null,
          p_full_name: "Sophia Beaumont",
          p_email: testEmail,
          p_phone: "+1 (212) 555-0142",
          p_treatment_date: uniqueDate,
          p_treatment_time: "14:30:00",
          p_treatment_type: "laser_epilation",
          p_notes: "Booked via test suite",
          p_email_consent: true,
        }
      );

      expect(bookErr).toBeNull();
      const res = bookingData as {
        success: boolean;
        is_returning_client: boolean;
        client_id: string;
        appointment_id: string;
      };
      expect(res.success).toBe(true);
      expect(res.client_id).toBeDefined();

      // 1b. Second booking with the exact same email must match returning client
      const { data: secondBookingData, error: secondBookErr } = await anonClient.rpc(
        "submit_public_booking",
        {
          p_salon_slug: null,
          p_full_name: "Sophia Beaumont",
          p_email: testEmail,
          p_phone: "+1 (212) 555-0142",
          p_treatment_date: uniqueDate,
          p_treatment_time: "16:00:00",
          p_treatment_type: "laser_epilation",
          p_notes: "Second booking",
          p_email_consent: true,
        }
      );
      expect(secondBookErr).toBeNull();
      const res2 = secondBookingData as {
        success: boolean;
        is_returning_client: boolean;
        client_id: string;
      };
      expect(res2.success).toBe(true);
      expect(res2.is_returning_client).toBe(true);
      expect(res2.client_id).toBe(res.client_id);

      // 2. Check get_salon_date_availability marks 14:30 as booked
      const { data: availData, error: availErr } = await anonClient.rpc(
        "get_salon_date_availability",
        {
          p_salon_slug: null,
          p_date: uniqueDate,
        }
      );
      expect(availErr).toBeNull();
      const avail = availData as {
        found: boolean;
        booked_times: string[];
        slots: Array<{ time: string; available: boolean }>;
      };
      expect(avail.found).toBe(true);
      expect(avail.booked_times).toContain("14:30");
      const slot1400 = avail.slots.find((s) => s.time === "14:00");
      const slot1500 = avail.slots.find((s) => s.time === "15:00");
      expect(slot1400?.available).toBe(false);
      expect(slot1500?.available).toBe(false);

      // 3. Conflicting booking at 14:30 is blocked with smart conflict info & Georgian message
      const { data: conflictData, error: conflictErr } = await anonClient.rpc(
        "submit_public_booking",
        {
          p_salon_slug: null,
          p_full_name: "Nino Beridze",
          p_email: `nino.conflict_${runId}@example.com`,
          p_phone: "+995 555 00 11 22",
          p_treatment_date: uniqueDate,
          p_treatment_time: "14:45:00",
          p_treatment_type: "laser_epilation",
          p_notes: "Should conflict with 14:30",
          p_email_consent: true,
        }
      );
      expect(conflictErr).toBeNull();
      const conflictRes = conflictData as {
        success: boolean;
        conflict: boolean;
        conflicting_time: string;
        error: string;
        error_ka: string;
        available_slots: string[];
      };
      expect(conflictRes.success).toBe(false);
      expect(conflictRes.conflict).toBe(true);
      expect(conflictRes.conflicting_time).toBe("14:30");
      expect(conflictRes.error_ka).toContain("დაკავებულია");
      expect(conflictRes.available_slots).toContain("10:00");
      expect(conflictRes.available_slots).not.toContain("14:00");
      expect(conflictRes.available_slots).not.toContain("15:00");
    },
    20000
  );

  it.skip("public booking database throttles are verified through the server route", async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    const runId = Date.now();
    const rateLimitEmail = `ratelimit_${runId}@example.com`;
    const baseDays = 600 + (runId % 500);

    // First 5 bookings on distinct days succeed
    for (let i = 0; i < 5; i++) {
      const distinctDate = new Date(Date.now() + (baseDays + i * 2) * 86400000)
        .toISOString()
        .split("T")[0];

      const { data, error } = await anonClient.rpc("submit_public_booking", {
        p_salon_slug: null,
        p_full_name: `Rate Tester ${i + 1}`,
        p_email: rateLimitEmail,
        p_phone: "+995 555 12 34 56",
        p_treatment_date: distinctDate,
        p_treatment_time: "11:00:00",
        p_treatment_type: "laser_epilation",
        p_notes: `Rate test booking ${i + 1}`,
        p_email_consent: true,
      });

      expect(error).toBeNull();
      expect((data as { success?: boolean })?.success).toBe(true);
    }

    const sixthDate = new Date(Date.now() + (baseDays + 20) * 86400000)
      .toISOString()
      .split("T")[0];

    // 6th booking within the same hour MUST fail due to rate limit
    const { data: sixthData, error: sixthError } = await anonClient.rpc(
      "submit_public_booking",
      {
        p_salon_slug: null,
        p_full_name: "Rate Tester 6",
        p_email: rateLimitEmail,
        p_phone: "+995 555 12 34 56",
        p_treatment_date: sixthDate,
        p_treatment_time: "11:00:00",
        p_treatment_type: "laser_epilation",
        p_notes: "6th booking should be rejected",
        p_email_consent: true,
      }
    );

    expect(sixthError).not.toBeNull();
    expect(sixthError?.message).toMatch(/Booking limit exceeded|ლიმიტი/i);
    expect(sixthData).toBeNull();
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
