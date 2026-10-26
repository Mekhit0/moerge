import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
} from "@/lib/supabase/server";
import { isPublicBookingDateAllowed, publicBookingInputSchema } from "@/lib/validation";
import { createResendTransport, platformSender } from "@/lib/reminder-worker";
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
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const resObj = data as { success?: boolean; conflict?: boolean; error?: string; available_slots?: string[]; salon_id?: string; salon_name?: string; appointment_id?: string; client_id?: string; client_email?: string; service_name?: string };
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

  // Dispatch instant booking confirmation email via Resend with 10-minute throttle
  let confirmationEmailSent = false;
  if (serviceClient) {
    try {
      const esc = (v: unknown) =>
        String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const bookedSalonId = resObj.salon_id;
      let settingsQuery = serviceClient
        .from("salon_settings")
        .select(
          "salon_id, salon_name, sender_display_name, verified_sender_email, send_booking_confirmation_email, salon_address, salon_phone, dry_run_mode, test_recipient_email"
        )
        .limit(1);
      if (bookedSalonId) settingsQuery = settingsQuery.eq("salon_id", bookedSalonId);
      const { data: settingsRows } = await settingsQuery;

      const s = settingsRows?.[0];

      // Dry-run mode never emails real clients; it may redirect to the configured test inbox.
      const recipient = s?.dry_run_mode
        ? s?.test_recipient_email || null
        : normalizedEmail;

      const recipientIsVerified = Boolean(s?.dry_run_mode) || Boolean(normalizedEmail);

      const transport =
        s && s.send_booking_confirmation_email !== false && recipient && recipientIsVerified
          ? createResendTransport()
          : null;

      if (s && transport && recipient && recipientIsVerified) {
        const timeStr = String(parsed.data.treatment_time).slice(0, 5);
        const salonTitle = s.salon_name || resObj.salon_name || "moarge Salon";
        const subject = `ჯავშანი დადასტურებულია: ${parsed.data.treatment_date} (${timeStr}) — ${salonTitle}`;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fdf8f6; border-radius: 20px; border: 1px solid #ffe4e6;">
            <h2 style="color: #be123c; margin: 0 0 12px;">თქვენი ვიზიტი დაჯავშნილია! / Booking Confirmed</h2>
            <p style="color: #44403c; font-size: 15px; line-height: 1.6;">გამარჯობა <strong>${esc(parsed.data.full_name)}</strong>,</p>
            <p style="color: #44403c; font-size: 14px; line-height: 1.6;">თქვენი ონლაინ ჯავშანი სალონში <strong>${esc(salonTitle)}</strong> წარმატებით დადასტურდა.</p>
            <div style="background: #ffffff; padding: 16px 20px; border-radius: 14px; border: 1px solid #fecdd3; margin: 16px 0; font-size: 14px; color: #1c1917;">
              <div><strong>პროცედურა / Service:</strong> ${esc(resObj.service_name || parsed.data.treatment_type)}</div>
              <div style="margin-top: 6px;"><strong>თარიღი / Date:</strong> ${esc(parsed.data.treatment_date)}</div>
              <div style="margin-top: 6px;"><strong>დრო / Time (Asia/Tbilisi):</strong> ${esc(timeStr)}</div>
              ${s.salon_address ? `<div style="margin-top: 6px;"><strong>მისამართი / Address:</strong> ${esc(s.salon_address)}</div>` : ""}
              ${s.salon_phone ? `<div style="margin-top: 6px;"><strong>ტელეფონი / Phone:</strong> ${esc(s.salon_phone)}</div>` : ""}
            </div>
            <p style="color: #78716c; font-size: 12px; margin-top: 18px;">გმადლობთ, რომ სარგებლობთ moarge-ს სისტემით!</p>
          </div>
        `;

        const fromAddress = platformSender(salonTitle);

        const emailRes = await transport.sendEmail({
          from: fromAddress,
          replyTo: s.verified_sender_email,
          to: recipient,
          subject,
          html,
          text: `თქვენი ვიზიტი დაჯავშნილია!\nპროცედურა: ${resObj.service_name || parsed.data.treatment_type}\nთარიღი: ${parsed.data.treatment_date}\nდრო: ${timeStr}\nსალონი: ${salonTitle}`,
        idempotencyKey: `bookconf:${bookedSalonId || "pub"}:${resObj.appointment_id}`,
          unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://moarge.vercel.app"}/unsubscribe`,
        });

        confirmationEmailSent = Boolean(emailRes.id);

        // Record in email_logs
        await serviceClient.from("email_logs").insert({
          salon_id: bookedSalonId || s.salon_id,
          appointment_id: resObj.appointment_id,
          recipient_email: recipient.toLowerCase().trim(),
          subject,
          event_type: confirmationEmailSent ? "api_accepted" : "failed",
          provider_message_id: emailRes.id || null,
          status_code: 200,
          error_message: null,
          is_dry_run: false,
        });
      }
    } catch {
      // Non-fatal booking confirmation dispatch failure
    }
  }

  return NextResponse.json({
    booking: {
      ...(typeof data === "object" && data !== null ? data : {}),
      confirmation_email_sent: confirmationEmailSent,
    },
    message: "Booking confirmed successfully / ჯავშანი წარმატებით დადასტურდა.",
  });
}
