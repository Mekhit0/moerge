import { NextRequest, NextResponse } from "next/server";
import { createAdminOrRpcSupabaseClient } from "@/lib/supabase/server";
import { isValidCalendarDate, publicBookingInputSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createResendTransport } from "@/lib/reminder-worker";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("salon") ?? null;
  const dateParam = searchParams.get("date");

  const supabase = createAdminOrRpcSupabaseClient();

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
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "public";
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

  const normalizedTime =
    parsed.data.treatment_time.length === 5
      ? `${parsed.data.treatment_time}:00`
      : parsed.data.treatment_time;

  const supabase = createAdminOrRpcSupabaseClient();
  const { data, error } = await supabase.rpc("submit_public_booking", {
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

  // Optionally dispatch instant booking confirmation email via Resend
  let confirmationEmailSent = false;
  try {
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const bookedSalonId = (data as { salon_id?: string } | null)?.salon_id;
    let settingsQuery = supabase
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

    const transport =
      s && s.send_booking_confirmation_email !== false && recipient
        ? createResendTransport(effectiveKey)
        : null;

    if (s && transport && recipient) {
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
      const text = `გამარჯობა ${parsed.data.full_name},\nთქვენი ჯავშანი სალონში ${salonTitle} დადასტურებულია.\nპროცედურა: ${parsed.data.treatment_type}\nთარიღი: ${parsed.data.treatment_date}\nდრო: ${timeStr}`;

      const origin = request.nextUrl.origin;
      await transport.sendEmail({
        from: `${String(s.sender_display_name || salonTitle).replace(/[<>"]/g, "")} <${s.verified_sender_email || "onboarding@resend.dev"}>`,
        to: recipient,
        subject,
        html,
        text,
        idempotencyKey: `booking-confirm:${(data as { appointment_id?: string })?.appointment_id ?? `${parsed.data.email}-${parsed.data.treatment_date}-${timeStr}`}`,
        unsubscribeUrl: `${origin}/unsubscribe`,
      });
      confirmationEmailSent = true;
    }
  } catch {
    // Non-blocking: booking still succeeds even if confirmation email fails
  }

  return NextResponse.json(
    {
      booking: {
        ...(data as Record<string, unknown>),
        confirmation_email_sent: confirmationEmailSent,
      },
    },
    { status: 201 }
  );
}
