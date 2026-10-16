import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { createResendTransport } from "@/lib/reminder-worker";
import { renderReminderEmail } from "@/lib/email-template";
import { isValidEmailAddress } from "@/lib/validation";

/**
 * POST /api/settings/test-email
 * Sends a live test email via Resend (or dry-run simulation if no key is provided)
 * so salon owners can verify their Resend API key and template with one click.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    recipient_email?: string;
    resend_api_key?: string | null;
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

  const providedKey =
    body.resend_api_key && body.resend_api_key !== "********"
      ? body.resend_api_key.trim()
      : null;

  let effectiveKey = providedKey;
  if (!effectiveKey) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createAdminOrRpcSupabaseClient } = await import(
          "@/lib/supabase/server"
        );
        const adminClient = createAdminOrRpcSupabaseClient();
        const { data: sRow } = await adminClient
          .from("salon_settings")
          .select("resend_api_key")
          .eq("salon_id", ctx.salonId)
          .maybeSingle();
        effectiveKey = sRow?.resend_api_key ?? null;
      } catch {
        // Fallback
      }
    }
  }

  const activeApiKey = effectiveKey || process.env.RESEND_API_KEY || "";

  const salonName = body.salon_name || ctx.settings.salon_name || "MOERGE Studio";
  const senderDisplay =
    body.sender_display_name || ctx.settings.sender_display_name || salonName;
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

  const transport = createResendTransport(activeApiKey);

  if (!transport) {
    return NextResponse.json(
      {
        ok: true,
        mode: "dry_run",
        recipient: recipientEmail,
        message:
          "Resend API გასაღები (re_...) ჯერ არ არის მითითებული — შესრულდა სატესტო (Dry-Run) სიმულაცია. რეალური წერილის გასაგზავნად ჩაწერეთ თქვენი Resend API Key.",
        message_en:
          "No Resend API key (re_...) configured yet — simulated Dry-Run test succeeded. Paste your Resend API key to send real emails.",
      },
      { status: 200 }
    );
  }

  try {
    const fromHeader = `${senderDisplay.replace(/[<>"]/g, "")} <${senderEmail}>`;
    const res = await transport.sendEmail({
      from: fromHeader,
      to: recipientEmail,
      subject: `[MOERGE TEST] ${rendered.subject}`,
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
