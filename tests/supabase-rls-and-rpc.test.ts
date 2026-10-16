import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { publicBookingInputSchema } from "../src/lib/validation";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vewofjywmofstlfnrfbe.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld29manl3bW9mc3RsZm5yZmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNDc1NDEsImV4cCI6MjEwNzcyMzU0MX0.boWvJw5w-G8pH6riZmh0eXPvEfJZmGYnJ9fH_oD-1jE";

const hasStaffCredentials = Boolean(
  process.env.TEST_STAFF_EMAIL && process.env.TEST_STAFF_PASSWORD
);

describe("Supabase Row Level Security (RLS), Multi-Tenant Isolation & Public Booking Ecosystem", { timeout: 35000 }, () => {
  it("blocks unauthenticated anon clients from reading salon business tables directly", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // 1. claim_due_reminders must be locked down to service_role only
    const { data: claimData, error: claimErr } = await anonClient.rpc(
      "claim_due_reminders",
      { p_limit: 5 }
    );
    expect(claimErr).not.toBeNull();
    expect(claimErr?.message).toMatch(/permission denied|service_role|not authorized/i);
    expect(claimData).toBeNull();

    // 2. record_reminder_send_result must be locked down
    const { error: sendResErr } = await anonClient.rpc("record_reminder_send_result", {
      p_reminder_id: "00000000-0000-0000-0000-000000000000",
      p_outcome: "api_accepted",
    });
    expect(sendResErr).not.toBeNull();

    // 3. process_email_webhook_event must be locked down
    const { error: webhookErr } = await anonClient.rpc("process_email_webhook_event", {
      p_provider_message_id: "test_msg_id",
      p_event_type: "delivered",
      p_raw_payload: {},
    });
    expect(webhookErr).not.toBeNull();
  });

  it("blocks anon clients from reading salon_settings or resend_api_key column", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await anonClient
      .from("salon_settings")
      .select("resend_api_key");

    if (error) {
      expect(error.message).toMatch(/permission denied/i);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it.skipIf(!hasStaffCredentials)(
    "blocks authenticated salon staff from selecting the raw resend_api_key column directly",
    async () => {
      const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });

      const { error: authErr } = await staffClient.auth.signInWithPassword({
        email: process.env.TEST_STAFF_EMAIL!,
        password: process.env.TEST_STAFF_PASSWORD!,
      });
      expect(authErr).toBeNull();

      const { error } = await staffClient
        .from("salon_settings")
        .select("resend_api_key");

      // Column-level revoke must reject selecting resend_api_key
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied for column resend_api_key/i);
    }
  );

  it.skipIf(!hasStaffCredentials)(
    "allows authenticated salon staff to access their authorized salon records and enforces multi-tenant isolation",
    async () => {
      const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    "validates public online booking submissions and matches returning clients by email without creating duplicates",
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

      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  it("enforces DB-level booking rate limits (maximum 5 bookings per hour per email)", async () => {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
        authorization: "Bearer wrong-secret-token-1234567890",
      },
    });
    const invalidRes = await GET(invalidReq as any);
    expect([401, 500]).toContain(invalidRes.status);
  });

  it("handles new user registration with auto-confirmation through /api/auth/register", async () => {
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
          password: "SecureSalonPassword2026!",
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
      const { createAdminOrRpcSupabaseClient } = await import("../src/lib/supabase/server");
      const adminClient = createAdminOrRpcSupabaseClient();
      if (regJson.user?.id) {
        await adminClient.auth.admin.deleteUser(regJson.user.id);
      }
    }
  });
});
