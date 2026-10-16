import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { publicBookingInputSchema } from "../src/lib/validation";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vewofjywmofstlfnrfbe.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZld29manl3bW9mc3RsZm5yZmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNDc1NDEsImV4cCI6MjEwNzcyMzU0MX0.boWvJw5w-G8pH6riZmh0eXPvEfJZmGYnJ9fH_oD-1jE";

describe("Supabase Row Level Security (RLS), Multi-Tenant Isolation & Public Booking Ecosystem", () => {
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

  it(
    "allows authenticated salon staff to access their authorized salon records and enforces multi-tenant isolation",
    async () => {
    const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authErr } =
      await staffClient.auth.signInWithPassword({
        email: "staff@lumieresalon.com",
        password: "SalonStaff2026!",
      });

    expect(authErr).toBeNull();
    expect(authData.user?.email).toBe("staff@lumieresalon.com");

    const { data: clients, error: clientsErr } = await staffClient
      .from("clients")
      .select("*")
      .eq("salon_id", "11111111-1111-4111-8111-111111111111");

    expect(clientsErr).toBeNull();
    expect((clients ?? []).length).toBeGreaterThanOrEqual(4);

    // Attempt to insert a client with another salon's ID (multi-tenant isolation check)
    const { error: crossTenantError } = await staffClient
      .from("clients")
      .insert({
        salon_id: "99999999-9999-4999-8999-999999999999",
        full_name: "Other Salon Client",
        email: "other@example.com",
      });

    expect(crossTenantError).not.toBeNull();
  }, 15000);

  it(
    "validates public online booking submissions and matches returning clients by email without creating duplicates",
    async () => {
    const parsed = publicBookingInputSchema.safeParse({
      full_name: "Sophia Beaumont",
      email: "  SOPHIA.BEAUMONT@EXAMPLE.COM ",
      treatment_date: "2026-11-15",
      treatment_time: "14:30",
      treatment_type: "laser_epilation",
      notes: "Booked from 21-day reminder link",
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

    const uniqueDate = "2027-04-18";

    // Cancel any previous test booking on this date using authenticated staff client so the slot is free
    const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await staffClient.auth.signInWithPassword({
      email: "staff@lumieresalon.com",
      password: "SalonStaff2026!",
    });
    await staffClient
      .from("appointments")
      .update({ status: "canceled" })
      .eq("treatment_date", uniqueDate);

    // 1. First booking at 14:30 succeeds
    const { data: bookingData, error: bookErr } = await anonClient.rpc(
      "submit_public_booking",
      {
        p_salon_slug: null,
        p_full_name: "Sophia Beaumont",
        p_email: "sophia.beaumont@example.com",
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
    expect(res.is_returning_client).toBe(true);
    expect(res.client_id).toBe("c1111111-1111-4111-8111-111111111111");

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
    // Slots are generated dynamically from salon working hours (default 10:00–20:00, 60 min).
    // 14:00 and 15:00 are both within the 45-minute buffer of the 14:30 booking.
    const slot1400 = avail.slots.find((s) => s.time === "14:00");
    const slot1500 = avail.slots.find((s) => s.time === "15:00");
    expect(slot1400?.available).toBe(false);
    expect(slot1500?.available).toBe(false);

    // 3. Second booking at 14:30 (or within 45 min buffer e.g. 14:45) is blocked with smart conflict info & Georgian message
    const { data: conflictData, error: conflictErr } = await anonClient.rpc(
      "submit_public_booking",
      {
        p_salon_slug: null,
        p_full_name: "Nino Beridze",
        p_email: "nino@example.com",
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
  }, 15000);
});
