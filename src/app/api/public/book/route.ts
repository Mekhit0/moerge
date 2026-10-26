import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
} from "@/lib/supabase/server";
import { isPublicBookingDateAllowed, publicBookingInputSchema } from "@/lib/validation";
import { consumeServerRateLimit } from "@/lib/server-rate-limit";

function getTrustedClientIp(request: NextRequest): string {
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim().length > 0) return xRealIp.trim();

  const reqIp = (request as unknown as { ip?: string }).ip;
  if (reqIp && reqIp.trim().length > 0) return reqIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim().length > 0) return cfIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}

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
    return NextResponse.json({ error: infoError.message }, { status: 500 });
  }

  const salonId = (infoData as { salon_id?: string } | null)?.salon_id;
  const [{ data: serviceRows }, { data: staffRows }] = await Promise.all([
    supabase.from("services").select("id,legacy_id,name_ka,name_en,price_gel,duration_minutes,category,recall_days,is_active,is_online_bookable")
      .eq("salon_id", salonId ?? "").eq("is_active", true).eq("is_online_bookable", true).order("name_en"),
    supabase.from("staff").select("id,full_name,color,photo_url,sort_order,staff_services(service_id)")
      .eq("salon_id", salonId ?? "").eq("is_active", true).order("sort_order"),
  ]);
  const services = serviceRows ?? [];
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
      if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 });
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

  // Cloudflare Turnstile Verification
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const turnstileToken = parsed.data.turnstile_token || parsed.data.token;

  if (!turnstileSecret) return NextResponse.json({ error: "Security verification is not configured." }, { status: 500 });
  {
    if (!turnstileToken) {
      return NextResponse.json(
        {
          error:
            "Security verification token is missing. Please refresh and try again / უსაფრთხოების ტოკენი აკლია.",
        },
        { status: 400 }
      );
    }

    try {
      const verifyForm = new URLSearchParams();
      verifyForm.append("secret", turnstileSecret);
      verifyForm.append("response", turnstileToken);
      verifyForm.append("remoteip", clientIp);

      const cfRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: verifyForm.toString(),
        }
      );
      const cfData = await cfRes.json();
      if (!cfData.success) {
        return NextResponse.json(
          {
            error:
              "Turnstile security verification failed. Please try again / უსაფრთხოების შემოწმება ვერ მოხერხდა.",
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Security verification service temporarily unavailable." },
        { status: 500 }
      );
    }
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
  try {
    if (!(await consumeServerRateLimit(serviceClient, `booking:${clientIp}`, 20, 60))) {
      return NextResponse.json({ error: "Too many booking requests. Please retry shortly." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Rate limiter unavailable." }, { status: 500 });
  }
  const { data: salon } = await serviceClient.from("salons").select("id,name").eq("slug", parsed.data.salon_slug).maybeSingle();
  if (!salon) return NextResponse.json({ error: "Salon not found or booking is unavailable." }, { status: 404 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const resObj = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[]; salon_id?: string; salon_name?: string; appointment_id?: string; client_id?: string; client_email?: string; service_name?: string; manage_token?: string };
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

  return NextResponse.json({
    booking: {
      ...(typeof data === "object" && data !== null ? data : {}),
      manage_url: resObj.manage_token
        ? `${(process.env.NEXT_PUBLIC_APP_URL || "https://moarge.ge").replace(/\/$/, "")}/manage-booking?token=${encodeURIComponent(resObj.manage_token)}`
        : null,
    },
    confirmation_queued: true,
    message: "Booking confirmed successfully / ჯავშანი წარმატებით დადასტურდა.",
  });
}
