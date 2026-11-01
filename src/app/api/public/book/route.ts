import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
} from "@/lib/supabase/server";
import { isPublicBookingDateAllowed, publicBookingInputSchema } from "@/lib/validation";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";
import { appUrl } from "@/lib/app-url";
import { getTrustedClientIp } from "@/lib/client-ip";
import { verifyTurnstile } from "@/lib/turnstile";
import { PUBLIC_BOOKING_LIMITS, publicBookingGuardError } from "@/lib/booking-guard";

export async function GET(request: NextRequest) {
  const clientIp = getTrustedClientIp(request);
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("salon") ?? null;
  const dateParam = searchParams.get("date");
  const serviceId = searchParams.get("service_id");
  const staffId = searchParams.get("staff_id");

  if (!slug || slug === "demo") {
    return NextResponse.json({
      found: true,
      demo: true,
      salon_name: "moarge Demo Salon",
      timezone: "Asia/Tbilisi",
      brand_color: "#e11d48",
      reminder_interval_days: 21,
      booking_title: "საჩვენებელი ონლაინ ჯავშანი | Demo Booking",
      booking_subtitle:
        "ეს არის საჩვენებელი სიმულაცია. შეგიძლიათ გამოსცადოთ ჯავშნის პროცესი — მონაცემები არ ინახება ბაზაში და არ ტოვებს თქვენს ბრაუზერს.",
      salon_address: "თბილისი, ჭავჭავაძის გამზ. 34",
      salon_phone: "+995 555 00 11 22",
      working_hours_start: "10:00",
      working_hours_end: "20:00",
      slot_interval_minutes: 60,
      availability: {
        booked_times: ["11:00:00", "15:00:00"],
      },
    });
  }

  const supabase = createServiceClient();
  try {
    if (!(await consumeServerRateLimit(supabase, `availability:${clientIp}`, 120, 60))) {
      return NextResponse.json({ error: "Too many requests. Please retry shortly." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }

  const { data: infoData, error: infoError } = await supabase.rpc(
    "get_public_salon_booking_info",
    {
      p_slug: slug,
    }
  );

  if (infoError) {
    return NextResponse.json({ error: "ჯავშნის გვერდი ვერ ჩაიტვირთა. / Could not load the booking page." }, { status: 500 });
  }

  const salonId = (infoData as { salon_id?: string } | null)?.salon_id;
  const [{ data: serviceRows, error: servicesError }, { data: staffRows, error: staffError }] = await Promise.all([
    supabase.from("services").select("id,legacy_id,name_ka,name_en,price_gel,duration_minutes,category,recall_days,is_active,is_online_bookable")
      .eq("salon_id", salonId ?? "").eq("is_active", true).eq("is_online_bookable", true).order("name_en"),
    supabase.from("staff").select("id,full_name,color,photo_url,sort_order,staff_services(service_id)")
      .eq("salon_id", salonId ?? "").eq("is_active", true).order("sort_order"),
  ]);
  if (servicesError || staffError) {
    return NextResponse.json({ error: "Could not load the salon booking setup." }, { status: 500 });
  }
  const services = serviceRows ?? [];
  if (serviceId && salonId && !services.some((service) => service.id === serviceId)) {
    return NextResponse.json({ error: "Selected service is unavailable." }, { status: 400 });
  }
  const staff = (staffRows ?? []).map((member) => ({
    ...member,
    service_ids: (member.staff_services ?? []).map((entry: { service_id: string }) => entry.service_id),
  }));

  let availability = null;
  if (dateParam && isPublicBookingDateAllowed(dateParam)) {
    if (serviceId && salonId) {
      const { data: slots, error: slotsError } = await supabase.rpc("get_available_slots", {
        p_salon_id: salonId,
        p_service_id: serviceId,
        p_date: dateParam,
        p_staff_id: staffId || null,
      });
      if (slotsError) return NextResponse.json({ error: "თავისუფალი დრო ვერ ჩაიტვირთა. / Could not load free times." }, { status: 500 });
      availability = { date: dateParam, slots: slots ?? [] };
    }
  }
  if (dateParam && !isPublicBookingDateAllowed(dateParam)) {
    return NextResponse.json({ error: "Choose a date within the next 90 days." }, { status: 400 });
  }

  return NextResponse.json({
    ...(infoData ?? { found: false }),
    custom_services: services.map((service) => ({
      id: service.id,
      type: service.category,
      name_ka: service.name_ka,
      name_en: service.name_en,
      price_gel: service.price_gel,
      duration_minutes: service.duration_minutes,
      reminder_days: service.recall_days,
      is_epilation: service.recall_days !== null,
      enabled: service.is_active,
    })),
    services,
    staff,
    availability,
  });
}

export async function POST(request: NextRequest) {
  const clientIp = getTrustedClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const parsed = publicBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Please check your booking details / გთხოვთ გადაამოწმოთ მონაცემები.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  // Quietly accept bot submissions without creating a client or appointment.
  if (parsed.data.website.trim()) {
    return NextResponse.json({
      booking: {
        appointment_id: `ignored-${Date.now().toString(36)}`,
        client_id: "",
        salon_name: "",
        is_returning_client: false,
        treatment_date: parsed.data.treatment_date,
        treatment_time: parsed.data.treatment_time,
        treatment_type: parsed.data.treatment_type,
        confirmation_email_sent: false,
      },
      demo: true,
    });
  }

  // Demo submissions never reach the database or send email.
  if (!parsed.data.salon_slug || parsed.data.salon_slug === "demo") {
    const normalizedTime = parsed.data.treatment_time.length === 5
      ? `${parsed.data.treatment_time}:00`
      : parsed.data.treatment_time;
    return NextResponse.json({
      booking: {
        appointment_id: `demo-${Date.now().toString(36)}`,
        client_id: `demo-client-${Date.now().toString(36)}`,
        salon_name: "moarge Demo Salon (Demo Showcase)",
        is_returning_client: false,
        treatment_date: parsed.data.treatment_date,
        treatment_time: normalizedTime.slice(0, 5),
        treatment_type: parsed.data.treatment_type,
        confirmation_email_sent: false,
      },
      demo: true,
      message: "Demo booking simulated successfully. No data stored, no emails dispatched.",
    });
  }

  const normalizedTime =
    parsed.data.treatment_time.length === 5
      ? `${parsed.data.treatment_time}:00`
      : parsed.data.treatment_time;

  // Public booking RPCs are available only to this server-side service client.
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server configuration error" }, { status: 500 });
  }
  const turnstileToken = typeof (body as Record<string, unknown>).turnstile_token === "string"
    ? (body as Record<string, string>).turnstile_token
    : null;
  const botCheck = await verifyTurnstile(turnstileToken, clientIp);
  if (!botCheck.ok) {
    return NextResponse.json({
      error: botCheck.reason === "unavailable"
        ? "უსაფრთხოების შემოწმება ვერ მოხერხდა. სცადეთ თავიდან. / The security check is unavailable. Please try again."
        : "დაადასტურეთ, რომ რობოტი არ ხართ. / Please confirm you are not a robot.",
    }, { status: 400 });
  }

  try {
    const [ipAllowed, phoneAllowed] = await Promise.all([
      consumeServerRateLimit(serviceClient, `booking:${clientIp}`, PUBLIC_BOOKING_LIMITS.perIpPerHour, 3600),
      consumeServerRateLimit(serviceClient, `booking-phone:${parsed.data.phone}`, PUBLIC_BOOKING_LIMITS.perPhonePerDay, 86400),
    ]);
    if (!ipAllowed || !phoneAllowed) {
      return NextResponse.json({ error: "ძალიან ბევრი ჯავშნის მცდელობა. სცადეთ მოგვიანებით. / Too many booking requests. Please try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }
  const { data: salon } = await serviceClient.from("salons").select("id,name").eq("slug", parsed.data.salon_slug).maybeSingle();
  if (!salon) return NextResponse.json({ error: "Salon not found or booking is unavailable." }, { status: 404 });

  const { data: guard, error: guardError } = await serviceClient.rpc("public_booking_guard", {
    p_salon_id: salon.id,
    p_phone: parsed.data.phone,
  });
  if (guardError || !guard) return NextResponse.json({ error: "Booking check is unavailable. Please try again." }, { status: 500 });
  const guardMessage = publicBookingGuardError(guard as { blocked: boolean; upcoming: number });
  if (guardMessage) return NextResponse.json({ error: guardMessage }, { status: 403 });
  const { data: service } = await serviceClient.from("services").select("id")
    .eq("salon_id", salon.id).eq("id", parsed.data.service_id).eq("is_active", true).eq("is_online_bookable", true).maybeSingle();
  if (!service) return NextResponse.json({ error: "Selected service is unavailable." }, { status: 400 });
  const normalizedEmail = parsed.data.email?.trim().toLowerCase() || null;
  const { data, error } = await serviceClient.rpc("create_appointment", {
    p_salon_id: salon.id,
    p_service_id: service.id,
    p_date: parsed.data.treatment_date,
    p_start_time: normalizedTime,
    p_staff_id: parsed.data.staff_id ?? null,
    p_client_id: null,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_email: normalizedEmail,
    p_notes: parsed.data.notes,
    p_email_consent: parsed.data.email_consent,
    p_sms_consent: parsed.data.sms_consent,
    p_language: parsed.data.preferred_language,
  });
  if (error) return NextResponse.json({ error: "ჯავშანი ვერ შეიქმნა. სცადეთ თავიდან. / The booking could not be created. Please try again." }, { status: 400 });
  const resObj = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[]; salon_name?: string; appointment_id?: string; manage_token?: string };
  if (!resObj?.success && resObj?.conflict) {
    return NextResponse.json(
      {
        conflict: true,
        error: resObj.error,
        available_slots: resObj.available_slots ?? [],
      },
      { status: 409 }
    );
  }
  if (!resObj?.success) return NextResponse.json({ error: resObj?.error ?? "Unable to create booking." }, { status: 400 });

  // The booking code is set by a database trigger when the appointment is inserted.
  const { data: created } = resObj.appointment_id
    ? await serviceClient.from("appointments").select("booking_code").eq("id", resObj.appointment_id).eq("salon_id", salon.id).maybeSingle()
    : { data: null };

  // Only what the person who booked needs. Never client ids or stored contact details: anyone can
  // type any phone number into this form.
  const booked = data as { treatment_date?: string; treatment_time?: string; treatment_type?: string; service_name?: string; staff_name?: string };
  return NextResponse.json({
    booking: {
      appointment_id: resObj.appointment_id,
      salon_name: resObj.salon_name ?? salon.name,
      treatment_date: booked.treatment_date ?? parsed.data.treatment_date,
      treatment_time: booked.treatment_time ?? normalizedTime,
      treatment_type: booked.treatment_type ?? parsed.data.treatment_type,
      service_name: booked.service_name ?? null,
      staff_name: booked.staff_name ?? null,
      booking_code: created?.booking_code ?? null,
      manage_url: resObj.manage_token
        ? appUrl(`/manage-booking?token=${encodeURIComponent(resObj.manage_token)}`)
        : null,
    },
    confirmation_queued: true,
    message: "Booking confirmed successfully / ჯავშანი წარმატებით დადასტურდა.",
  });
}
