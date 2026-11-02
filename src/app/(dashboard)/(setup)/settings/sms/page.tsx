import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import SmsSettings, { type SentSms } from "@/components/settings/SmsSettings";
import { currentOffer } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const SMS_TYPES = ["reminder_24h", "reminder_2h", "booking_confirmation"] as const;
const TO_CHOICE = { reminder_24h: "sms_reminder_24h", reminder_2h: "sms_reminder_2h", booking_confirmation: "sms_booking_confirmation" } as const;

/** Fills an SMS template the way the queue does, with sample values, so the salon sees the real text. */
function fill(template: string, salonName: string): string {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tbilisi" }).format(tomorrow).replace("/", ".");
  return template
    .replaceAll("{{salon_name}}", salonName)
    .replaceAll("{{client_name}}", "ნინო")
    .replaceAll("{{service_name}}", "მანიკური")
    .replaceAll("{{time}}", "12:30")
    .replaceAll("{{date}}", date)
    .replaceAll("{{booking_code}}", "750934");
}

export default async function SmsSettingsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");

  const [{ data: wallet }, { data: templates }, { data: log }] = await Promise.all([
    ctx.supabase.from("sms_wallet").select("included_quota,used_this_period,prepaid_balance").eq("salon_id", ctx.salonId).maybeSingle(),
    ctx.supabase.from("notification_templates").select("message_type,body_template")
      .eq("salon_id", ctx.salonId).eq("channel", "sms").eq("language", "ka").in("message_type", [...SMS_TYPES]),
    ctx.supabase.from("notification_log").select("id,message_type,status,error,scheduled_at,sms_parts,client:clients(full_name)")
      .eq("salon_id", ctx.salonId).eq("channel", "sms").order("scheduled_at", { ascending: false }).limit(50),
  ]);

  const salonName = ctx.settings.salon_name || ctx.salonName;
  const samples: Partial<Record<(typeof TO_CHOICE)[keyof typeof TO_CHOICE], string>> = {};
  for (const row of templates ?? []) {
    const key = TO_CHOICE[row.message_type as keyof typeof TO_CHOICE];
    if (key) samples[key] = fill(row.body_template, salonName);
  }
  const sent: SentSms[] = (log ?? []).map((row) => {
    const client = Array.isArray(row.client) ? row.client[0] : row.client;
    return { id: row.id, message_type: row.message_type, status: row.status, error: row.error, scheduled_at: row.scheduled_at, sms_parts: row.sms_parts, client_name: client?.full_name ?? null };
  });

  return (
    <SmsSettings
      initial={{
        sms_reminder_24h: ctx.settings.sms_reminder_24h ?? true,
        sms_reminder_2h: ctx.settings.sms_reminder_2h ?? false,
        sms_booking_confirmation: ctx.settings.sms_booking_confirmation ?? false,
      }}
      wallet={{
        includedLeft: Math.max(0, (wallet?.included_quota ?? 0) - (wallet?.used_this_period ?? 0)),
        included: wallet?.included_quota ?? 0,
        bought: wallet?.prepaid_balance ?? 0,
      }}
      smsLive={currentOffer().smsLive}
      samples={samples}
      sent={sent}
    />
  );
}
