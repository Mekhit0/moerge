import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedSalonContext,
  SAFE_SALON_SETTINGS_SELECT,
  requireRole,
} from "@/lib/supabase/server";
import { salonSettingsSchema } from "@/lib/validation";
import { appUrl } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRole(ctx, ["owner", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const autoBookingUrl = appUrl(`/book?salon=${encodeURIComponent(ctx.salonSlug)}`);

  const hasEnvKey = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith("re_")
  );

  return NextResponse.json({
    settings: {
      ...ctx.settings,
      booking_url: autoBookingUrl,
      salon_slug: ctx.salonSlug,
    },
    resendConfigured: hasEnvKey,
    webhookSecretConfigured: Boolean(
      process.env.RESEND_WEBHOOK_SECRET &&
        process.env.RESEND_WEBHOOK_SECRET.startsWith("whsec_")
    ),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRole(ctx, ["owner", "admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = salonSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  let effectiveSlug = ctx.salonSlug;
  if (parsed.data.salon_slug) {
    const requestedSlug = parsed.data.salon_slug.toLowerCase().trim();
    if (requestedSlug !== ctx.salonSlug) {
      const { data: conflict } = await ctx.supabase
        .from("salons")
        .select("id")
        .eq("slug", requestedSlug)
        .neq("id", ctx.salonId)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json(
          {
            error:
              "ეს ბმული (slug) უკვე დაკავებულია სხვა სალონის მიერ. გთხოვთ აირჩიოთ სხვა. / This slug is already in use by another salon.",
          },
          { status: 409 }
        );
      }

      await ctx.supabase
        .from("salons")
        .update({ slug: requestedSlug })
        .eq("id", ctx.salonId);

      effectiveSlug = requestedSlug;
    }
  }

  const autoBookingUrl = appUrl(`/book?salon=${encodeURIComponent(effectiveSlug)}`);
  // Update non-sensitive columns with user-scoped authenticated client
  const { data: updatedSettings, error } = await ctx.supabase
    .from("salon_settings")
    .update({
      salon_name: parsed.data.salon_name,
      sender_display_name: parsed.data.sender_display_name,
      verified_sender_email: parsed.data.verified_sender_email,
      timezone: "Asia/Tbilisi",
      reminder_interval_days: parsed.data.reminder_interval_days,
      email_subject: parsed.data.email_subject,
      email_body_template: parsed.data.email_body_template,
      booking_url: autoBookingUrl,
      brand_color: parsed.data.brand_color,
      auto_reminders_enabled: parsed.data.auto_reminders_enabled,
      dry_run_mode: parsed.data.dry_run_mode,
      test_recipient_email: parsed.data.test_recipient_email,
      booking_title: parsed.data.booking_title,
      booking_subtitle: parsed.data.booking_subtitle,
      salon_address: parsed.data.salon_address,
      salon_phone: parsed.data.salon_phone,
      working_hours_start: parsed.data.working_hours_start,
      working_hours_end: parsed.data.working_hours_end,
      slot_interval_minutes: parsed.data.slot_interval_minutes,
      booking_cancel_deadline_hours: parsed.data.booking_cancel_deadline_hours,
      deposit_required: parsed.data.deposit_required,
      deposit_amount_gel: parsed.data.deposit_required ? parsed.data.deposit_amount_gel : null,
      deposit_percentage: parsed.data.deposit_required ? parsed.data.deposit_percentage : null,
      send_booking_confirmation_email:
        parsed.data.send_booking_confirmation_email ?? true,
      // Only what the form sent; an older page without these switches leaves them as they are.
      ...(parsed.data.sms_reminder_24h !== undefined && { sms_reminder_24h: parsed.data.sms_reminder_24h }),
      ...(parsed.data.sms_reminder_2h !== undefined && { sms_reminder_2h: parsed.data.sms_reminder_2h }),
      ...(parsed.data.sms_booking_confirmation !== undefined && { sms_booking_confirmation: parsed.data.sms_booking_confirmation }),
    })
    .eq("salon_id", ctx.salonId)
    .select(SAFE_SALON_SETTINGS_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Keep salons.name synchronized with salon_settings.salon_name
  await ctx.supabase
    .from("salons")
    .update({ name: parsed.data.salon_name })
    .eq("id", ctx.salonId);

  return NextResponse.json({
    settings: {
      ...updatedSettings,
      booking_url: autoBookingUrl,
      salon_slug: effectiveSlug,
    },
    resendConfigured: Boolean(
      (process.env.RESEND_API_KEY &&
          process.env.RESEND_API_KEY.startsWith("re_"))
    ),
  });
}

export const PUT = POST;
