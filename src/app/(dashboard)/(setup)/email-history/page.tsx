import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import EmailHistoryManager from "@/components/EmailHistoryManager";
import { EmailLog, Reminder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EmailHistoryPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }

  const [{ data: remindersData }, { data: logsData }] = await Promise.all([
    ctx.supabase
      .from("reminders")
      .select(
        "*, client:clients(id, full_name, email, is_archived, email_consent), appointment:appointments(id, treatment_date, treatment_time, treatment_type, status)"
      )
      .eq("salon_id", ctx.salonId)
      .order("scheduled_for_date", { ascending: false }),
    ctx.supabase
      .from("email_logs")
      .select("id,reminder_id,client_id,appointment_id,recipient_email,subject,event_type,provider_message_id,idempotency_key,attempt_number,status_code,error_message,is_dry_run,created_at")
      .eq("salon_id", ctx.salonId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <EmailHistoryManager
      initialReminders={(remindersData ?? []) as Reminder[]}
      initialLogs={(logsData ?? []) as EmailLog[]}
      timezone={ctx.settings.timezone}
      dryRunMode={ctx.settings.dry_run_mode}
    />
  );
}
