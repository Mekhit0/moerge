import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { createResendTransport, platformSender } from "@/lib/reminder-worker";
import { renderReminderEmail } from "@/lib/email-template";
import { isValidEmailAddress } from "@/lib/validation";

/**
 * POST /api/settings/test-email
 * Sends a platform-delivered test email so salon owners can check their template.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRole(ctx, ["owner", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    recipient_email?: string;
    sender_display_name?: string;
    verified_sender_email?: string;
    salon_name?: string;
    booking_url?: string;
    email_subject?: string;
    email_body_template?: string;
    brand_color?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    // Allow empty body to use current settings
  }

  const recipientEmail = (
    body.recipient_email ||
    ctx.settings.test_recipient_email ||
    ctx.user.email ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!isValidEmailAddress(recipientEmail)) {
    return NextResponse.json(
      {
        error:
          "Please provide a valid recipient email address for the test email / გთხოვთ მიუთითოთ სწორი სატესტო მიმღების ელ-ფოსტა.",
      },
      { status: 400 }
    );
  }

  const salonName = body.salon_name || ctx.settings.salon_name || "moarge";
  const senderEmail =
    body.verified_sender_email ||
    ctx.settings.verified_sender_email ||
    "onboarding@resend.dev";

  const rendered = renderReminderEmail({
    clientName: "ნინო ბერიძე (Test Client)",
    salonName,
    bookingUrl: body.booking_url || ctx.settings.booking_url || "http://localhost:3000/book",
    subjectTemplate: body.email_subject || ctx.settings.email_subject,
    bodyTemplate: body.email_body_template || ctx.settings.email_body_template,
    brandColor: body.brand_color || ctx.settings.brand_color || "#e11d48",
    unsubscribeUrl: "http://localhost:3000/unsubscribe?token=test-preview",
  });

  const transport = createResendTransport();

  if (!transport) {
    return NextResponse.json(
      {
        ok: true,
        mode: "dry_run",
        recipient: recipientEmail,
        message:
          "პლატფორმის ელფოსტა დროებით მიუწვდომელია — შესრულდა სატესტო სიმულაცია.",
        message_en:
          "Platform email delivery is unavailable. A test simulation completed.",
      },
      { status: 200 }
    );
  }

  try {
    const fromHeader = platformSender(salonName);
    const res = await transport.sendEmail({
      from: fromHeader,
      replyTo: senderEmail,
      to: recipientEmail,
      subject: `[moarge test] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `test-email:${ctx.salonId}:${Date.now()}`,
      unsubscribeUrl: "http://localhost:3000/unsubscribe?token=test-preview",
    });

    return NextResponse.json({
      ok: true,
      mode: "live_resend",
      providerMessageId: res.id,
      recipient: recipientEmail,
      message: `რეალური ტესტ-წერილი წარმატებით გაიგზავნა Resend-ით მისამართზე ${recipientEmail}! (ID: ${res.id})`,
      message_en: `Live test email dispatched via Resend to ${recipientEmail}! (ID: ${res.id})`,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Resend API rejected test email";
    return NextResponse.json(
      {
        error: `Resend შეცდომა: ${msg}`,
      },
      { status: 422 }
    );
  }
}
