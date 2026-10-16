import { NextRequest, NextResponse } from "next/server";
import {
  createAdminOrRpcSupabaseClient,
  createPublicServerSupabaseClient,
} from "@/lib/supabase/server";
import { isValidCalendarDate, publicBookingInputSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createResendTransport } from "@/lib/reminder-worker";

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
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("salon") ?? null;
  const dateParam = searchParams.get("date");

  if (!slug || slug === "demo") {
    return NextResponse.json({
      found: true,
      demo: true,
      salon_name: "Lumière Studio",
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

  const supabase = createPublicServerSupabaseClient();

  const { data: infoData, error: infoError } = await supabase.rpc(
    "get_public_salon_booking_info",
    {
      p_slug: slug,
    }
  );

  if (infoError) {
    return NextResponse.json({ error: infoError.message }, { status: 500 });
  }

  let availability = null;
  if (dateParam && isValidCalendarDate(dateParam)) {
    const { data: availData } = await supabase.rpc(
      "get_salon_date_availability",
      {
        p_salon_slug: slug,
        p_date: dateParam,
        p_salon_id: null,
        p_exclude_appointment_id: null,
      }
    );
    availability = availData;
  }

  return NextResponse.json({
    ...(infoData ?? { found: false }),
    availability,
  });
}

export async function POST(request: NextRequest) {
  const clientIp = getTrustedClientIp(request);

  // Layer 1: In-memory sliding rate limit per IP
  const rl = checkRateLimit(`public:booking:${clientIp}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many booking requests. Please wait a moment / ძალიან ბევრი მოთხოვნაა, გთხოვთ სცადოთ მოგვიანებით.",
      },
      { status: 429 }
    );
  }

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

  // Cloudflare Turnstile Verification
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const turnstileToken = parsed.data.turnstile_token || parsed.data.token;

  if (turnstileSecret) {
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

  // Mock / Demo showcase submissions stay strictly in the browser/mock layer
  if (!parsed.data.salon_slug || parsed.data.salon_slug === "demo") {
    return NextResponse.json({
      booking: {
        appointment_id: `demo-${Date.now().toString(36)}`,
        client_id: `demo-client-${Date.now().toString(36)}`,
        salon_name: "Lumière Studio (Demo Showcase)",
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

  // Obtain client for public RPC execution
  let serviceClient;
  try {
    serviceClient = createAdminOrRpcSupabaseClient();
  } catch {
    // If service role not configured, fallback to public client for RPC execution
  }
  const rpcClient = serviceClient || createPublicServerSupabaseClient();

  // Layer 2: Database IP Rate Limit (max 5 bookings per hour per IP)
  if (serviceClient) {
    try {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count: ipBookingCount } = await serviceClient
        .from("public_booking_rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", clientIp)
        .gte("created_at", oneHourAgo);

      if (ipBookingCount !== null && ipBookingCount >= 5) {
        return NextResponse.json(
          {
            error:
              "Too many bookings from your network. Please wait an hour before booking again / ამ ქსელიდან ჯავშნების ლიმიტი (საათში 5) ამოიწურა. გთხოვთ სცადოთ მოგვიანებით.",
          },
          { status: 429 }
        );
      }
    } catch {
      // Non-blocking rate-limit check failure
    }
  }

  const { data, error } = await rpcClient.rpc("submit_public_booking", {
    p_salon_slug: parsed.data.salon_slug,
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_treatment_date: parsed.data.treatment_date,
    p_treatment_time: normalizedTime,
    p_treatment_type: parsed.data.treatment_type,
    p_notes: parsed.data.notes,
    p_email_consent: parsed.data.email_consent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const resObj = data as {
    success?: boolean;
    conflict?: boolean;
    error?: string;
    error_ka?: string;
    conflicting_time?: string;
    available_slots?: string[];
    salon_name?: string;
    treatment_date?: string;
    treatment_time?: string;
    treatment_type?: string;
  };

  if (resObj && resObj.conflict) {
    return NextResponse.json(
      {
        conflict: true,
        error: resObj.error,
        error_ka: resObj.error_ka,
        conflicting_time: resObj.conflicting_time,
        available_slots: resObj.available_slots ?? [],
      },
      { status: 409 }
    );
  }

  // Record rate limit IP entry
  if (serviceClient) {
    try {
      await serviceClient.from("public_booking_rate_limits").insert({
        ip_address: clientIp,
        email: parsed.data.email.toLowerCase().trim(),
      });
    } catch {
      // Non-fatal
    }
  }

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

      const bookedSalonId = (data as { salon_id?: string } | null)?.salon_id;
      let settingsQuery = serviceClient
        .from("salon_settings")
        .select(
          "salon_id, salon_name, sender_display_name, verified_sender_email, resend_api_key, send_booking_confirmation_email, salon_address, salon_phone, dry_run_mode, test_recipient_email"
        )
        .limit(1);
      if (bookedSalonId) settingsQuery = settingsQuery.eq("salon_id", bookedSalonId);
      const { data: settingsRows } = await settingsQuery;

      const s = settingsRows?.[0];
      const effectiveKey =
        (s?.resend_api_key && String(s.resend_api_key).trim()) ||
        process.env.RESEND_API_KEY ||
        "";

      // Dry-run mode never emails real clients; it may redirect to the configured test inbox.
      const recipient = s?.dry_run_mode
        ? s?.test_recipient_email || null
        : parsed.data.email;

      // Email throttling: Do not send confirmation email to the same address more than 3 times in 10 minutes
      let throttled = false;
      if (recipient) {
        const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString();
        const { count: emailCount } = await serviceClient
          .from("email_logs")
          .select("*", { count: "exact", head: true })
          .eq("recipient_email", recipient.toLowerCase().trim())
          .gte("created_at", tenMinutesAgo);

        if (emailCount !== null && emailCount >= 3) {
          throttled = true;
        }
      }

      const transport =
        s && s.send_booking_confirmation_email !== false && recipient && !throttled
          ? createResendTransport(effectiveKey)
          : null;

      if (s && transport && recipient && !throttled) {
        const timeStr = String(parsed.data.treatment_time).slice(0, 5);
        const salonTitle = s.salon_name || resObj.salon_name || "MOERGE Salon";
        const subject = `ჯავშანი დადასტურებულია: ${parsed.data.treatment_date} (${timeStr}) — ${salonTitle}`;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; background: #fdf8f6; border-radius: 20px; border: 1px solid #ffe4e6;">
            <h2 style="color: #be123c; margin: 0 0 12px;">თქვენი ვიზიტი დაჯავშნილია! / Booking Confirmed</h2>
            <p style="color: #44403c; font-size: 15px; line-height: 1.6;">გამარჯობა <strong>${esc(parsed.data.full_name)}</strong>,</p>
            <p style="color: #44403c; font-size: 14px; line-height: 1.6;">თქვენი ონლაინ ჯავშანი სალონში <strong>${esc(salonTitle)}</strong> წარმატებით დადასტურდა.</p>
            <div style="background: #ffffff; padding: 16px 20px; border-radius: 14px; border: 1px solid #fecdd3; margin: 16px 0; font-size: 14px; color: #1c1917;">
              <div><strong>პროცედურა / Service:</strong> ${esc(parsed.data.treatment_type)}</div>
              <div style="margin-top: 6px;"><strong>თარიღი / Date:</strong> ${esc(parsed.data.treatment_date)}</div>
              <div style="margin-top: 6px;"><strong>დრო / Time (Asia/Tbilisi):</strong> ${esc(timeStr)}</div>
              ${s.salon_address ? `<div style="margin-top: 6px;"><strong>მისამართი / Address:</strong> ${esc(s.salon_address)}</div>` : ""}
              ${s.salon_phone ? `<div style="margin-top: 6px;"><strong>ტელეფონი / Phone:</strong> ${esc(s.salon_phone)}</div>` : ""}
            </div>
            <p style="color: #78716c; font-size: 12px; margin-top: 18px;">გმადლობთ, რომ სარგებლობთ MOERGE-ს სისტემით!</p>
          </div>
        `;

        const fromAddress = s.sender_display_name
          ? `"${s.sender_display_name.replace(/"/g, "")}" <${s.verified_sender_email}>`
          : s.verified_sender_email;

        const emailRes = await transport.sendEmail({
          from: fromAddress,
          to: recipient,
          subject,
          html,
          text: `თქვენი ვიზიტი დაჯავშნილია!\nპროცედურა: ${parsed.data.treatment_type}\nთარიღი: ${parsed.data.treatment_date}\nდრო: ${timeStr}\nსალონი: ${salonTitle}`,
          idempotencyKey: `bookconf:${bookedSalonId || "pub"}:${(data as { appointment_id?: string })?.appointment_id}`,
          unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://moerge.vercel.app"}/unsubscribe`,
        });

        confirmationEmailSent = Boolean(emailRes.id);

        // Record in email_logs
        await serviceClient.from("email_logs").insert({
          salon_id: bookedSalonId || s.salon_id,
          appointment_id: (data as { appointment_id?: string })?.appointment_id,
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
