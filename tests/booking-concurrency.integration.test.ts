import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runAgainstStaging = process.env.RUN_STAGING_BOOKING_TESTS === "true";
const isConfirmedStaging = url?.includes("oolsgizchxstiuvzveos.supabase.co") ?? false;
const canRun = runAgainstStaging && isConfirmedStaging && Boolean(serviceKey);

describe.skipIf(!canRun)("staff booking concurrency (staging integration)", { timeout: 60000 }, () => {
  let admin: SupabaseClient;
  let salonId = "";
  let serviceId = "";
  let longServiceId = "";
  let staffIds: string[] = [];
  const bookingDate = "2026-11-01"; // New York DST fall-back date, within the booking horizon.

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: salon, error: salonError } = await admin.from("salons").insert({
      name: "Concurrency integration fixture", slug: `booking-test-${crypto.randomUUID().slice(0, 8)}`,
      subscription_tier: "starter", subscription_status: "active",
    }).select("id").single();
    if (salonError || !salon) throw salonError ?? new Error("Could not create staging fixture salon.");
    salonId = salon.id;
    const { error: settingsError } = await admin.from("salon_settings").insert({
      salon_id: salonId, salon_name: "Concurrency integration fixture", sender_display_name: "moarge",
      verified_sender_email: "booking-test@example.test", timezone: "America/New_York",
    });
    if (settingsError) throw settingsError;
    const [{ count: defaultStaffCount }, { count: defaultServiceCount }, { count: defaultScheduleCount }] = await Promise.all([
      admin.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      admin.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      admin.from("staff_working_hours").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
    ]);
    expect(defaultStaffCount).toBeGreaterThan(0);
    expect(defaultServiceCount).toBeGreaterThan(0);
    expect(defaultScheduleCount).toBeGreaterThan(0);
    const { data: staff, error: staffError } = await admin.from("staff").insert([
      { salon_id: salonId, full_name: "Staff One", sort_order: 1 },
      { salon_id: salonId, full_name: "Staff Two", sort_order: 2 },
      { salon_id: salonId, full_name: "Staff Three", sort_order: 3 },
    ]).select("id");
    if (staffError || !staff) throw staffError ?? new Error("Could not create staging fixture staff.");
    staffIds = staff.map((item) => item.id);
    const { data: services, error: serviceError } = await admin.from("services").insert([
      { salon_id: salonId, name_ka: "მოკლე სერვისი", name_en: "Standard service", duration_minutes: 45, price_gel: 50 },
      { salon_id: salonId, name_ka: "გრძელი სერვისი", name_en: "Long service", duration_minutes: 90, price_gel: 100 },
    ]).select("id,name_en");
    if (serviceError || !services) throw serviceError ?? new Error("Could not create staging fixture services.");
    serviceId = services.find((item) => item.name_en === "Standard service")!.id;
    longServiceId = services.find((item) => item.name_en === "Long service")!.id;
    const { error: assignmentsError } = await admin.from("staff_services").insert(
      staffIds.flatMap((staff_id) => services!.map((service) => ({ salon_id: salonId, staff_id, service_id: service.id })))
    );
    if (assignmentsError) throw assignmentsError;
    const { error: hoursError } = await admin.from("staff_working_hours").insert(staffIds.map((staff_id) => ({
      salon_id: salonId, staff_id, weekday: 0, start_time: "01:00", end_time: "04:00",
    })));
    if (hoursError) throw hoursError;
  });

  afterAll(async () => {
    if (salonId && admin) await admin.from("salons").delete().eq("id", salonId);
  });

  it("supports parallel booking across three staff, rejects a same-staff race, and handles DST/local closing", async () => {
    const parallel = await Promise.all(staffIds.map((staffId, index) => admin.rpc("create_appointment", {
      p_salon_id: salonId, p_service_id: serviceId, p_date: bookingDate, p_start_time: "01:00:00",
      p_staff_id: staffId, p_client_id: null, p_full_name: `Parallel ${index}`, p_phone: "+995555000001", p_email: null, p_notes: null,
    })));
    expect(parallel.every((result) => !result.error && (result.data as { success?: boolean })?.success), JSON.stringify(parallel.map((result) => ({ data: result.data, error: result.error?.message })))).toBe(true);

    const race = await Promise.all([1, 2].map((index) => admin.rpc("create_appointment", {
      p_salon_id: salonId, p_service_id: serviceId, p_date: bookingDate, p_start_time: "03:00:00",
      p_staff_id: staffIds[0], p_client_id: null, p_full_name: `Race ${index}`, p_phone: "+995555000002", p_email: null, p_notes: null,
    })));
    expect(race.filter((result) => !result.error && (result.data as { success?: boolean })?.success)).toHaveLength(1);
    expect(race.filter((result) => !result.error && (result.data as { conflict?: boolean })?.conflict)).toHaveLength(1);
    expect(race.filter((result) => !result.error && (result.data as { conflict?: boolean })?.conflict)).toHaveLength(1);

    const { data: dstSlots, error: dstError } = await admin.rpc("get_available_slots", {
      p_salon_id: salonId, p_service_id: serviceId, p_date: bookingDate, p_staff_id: staffIds[2],
    });
    expect(dstError).toBeNull();
    const dstSlot = (dstSlots ?? []).find((slot: { slot_time: string }) => slot.slot_time.startsWith("02:30"));
    expect(dstSlot?.starts_at).toBe("2026-11-01T07:30:00+00:00");
    const { data: repeatedHourSlots, error: repeatedHourError } = await admin.rpc("get_available_slots", {
      p_salon_id: salonId, p_service_id: serviceId, p_date: bookingDate, p_staff_id: staffIds[1],
    });
    expect(repeatedHourError).toBeNull();
    const repeatedHour = (repeatedHourSlots ?? []).find((slot: { slot_time: string }) => slot.slot_time.startsWith("01:45"));
    expect(repeatedHour?.starts_at, JSON.stringify(repeatedHourSlots)).toBe("2026-11-01T06:45:00+00:00");
    expect(repeatedHour?.ends_at).toBe("2026-11-01T07:30:00+00:00");

    const { error: breakError } = await admin.from("staff_working_hours").insert({
      salon_id: salonId, staff_id: staffIds[1], weekday: 0, start_time: "01:30", end_time: "02:00", is_break: true,
    });
    if (breakError) throw breakError;
    const { error: timeOffError } = await admin.from("time_off").insert({
      salon_id: salonId, staff_id: staffIds[1], starts_at: "2026-11-01T07:00:00Z", ends_at: "2026-11-01T08:45:00Z", reason: "integration test",
    });
    if (timeOffError) throw timeOffError;
    const { data: blockedSlots, error: blockedError } = await admin.rpc("get_available_slots", {
      p_salon_id: salonId, p_service_id: serviceId, p_date: bookingDate, p_staff_id: staffIds[1],
    });
    expect(blockedError).toBeNull();
    expect((blockedSlots ?? []).some((slot: { slot_time: string }) => slot.slot_time.startsWith("01:30"))).toBe(false);
    expect((blockedSlots ?? []).some((slot: { slot_time: string }) => slot.slot_time.startsWith("03:00"))).toBe(false);

    const { error: narrowHoursDeleteError } = await admin.from("staff_working_hours").delete().eq("staff_id", staffIds[2]);
    if (narrowHoursDeleteError) throw narrowHoursDeleteError;
    const { error: narrowHoursInsertError } = await admin.from("staff_working_hours").insert({
      salon_id: salonId, staff_id: staffIds[2], weekday: 0, start_time: "03:30", end_time: "04:00",
    });
    if (narrowHoursInsertError) throw narrowHoursInsertError;
    const { data: tooLongSlots, error: tooLongError } = await admin.rpc("get_available_slots", {
      p_salon_id: salonId, p_service_id: longServiceId, p_date: bookingDate, p_staff_id: staffIds[2],
    });
    expect(tooLongError).toBeNull();
    expect(tooLongSlots).toEqual([]);
  });
});
