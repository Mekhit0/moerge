import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";
import { Appointment, Client, Reminder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }

  const [
    { data: clientsData },
    { data: remindersData },
    { data: appointmentsData },
  ] = await Promise.all([
    ctx.supabase
      .from("clients")
      .select("*")
      .eq("salon_id", ctx.salonId)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("reminders")
      .select(
        "*, client:clients(id, full_name, email, is_archived, email_consent), appointment:appointments(id, treatment_date, treatment_time, treatment_type, status)"
      )
      .eq("salon_id", ctx.salonId)
      .order("scheduled_for_date", { ascending: true }),
    ctx.supabase
      .from("appointments")
      .select(
        "*, client:clients(id, full_name, email, phone, is_archived, email_consent)"
      )
      .eq("salon_id", ctx.salonId)
      .order("treatment_date", { ascending: false })
      .limit(8),
  ]);

  const clients = (clientsData ?? []) as Client[];
  const reminders = (remindersData ?? []) as Reminder[];
  const appointments = (appointmentsData ?? []) as Appointment[];

  const nowMs = Date.now();
  const scheduledReminders = reminders.filter((r) => r && r.status === "scheduled");
  const dueNowCount = scheduledReminders.filter(
    (r) => r.scheduled_send_at && new Date(r.scheduled_send_at).getTime() <= nowMs
  ).length;
  const sentOrDelivered = reminders.filter((r) =>
    r && ["sent", "delivered"].includes(r.status)
  );
  const deliveredOnly = reminders.filter((r) => r && r.status === "delivered");
  const failedOrBounced = reminders.filter((r) =>
    r && ["failed", "bounced"].includes(r.status)
  );

  return (
    <DashboardClient
      salonName={ctx.settings?.salon_name || ctx.salonName || "My Salon"}
      timezone={ctx.settings?.timezone || "Asia/Tbilisi"}
      reminderIntervalDays={ctx.settings?.reminder_interval_days ?? 21}
      dryRunMode={Boolean(ctx.settings?.dry_run_mode ?? false)}
      stats={{
        totalClients: clients.length,
        activeClients: clients.filter((c) => c && !c.is_archived).length,
        upcomingReminders: scheduledReminders.length,
        dueNowCount,
        sentSuccessfully: sentOrDelivered.length,
        deliveredCount: deliveredOnly.length,
        failedDeliveries: failedOrBounced.length,
      }}
      recentClients={clients.filter((c) => c && !c.is_archived).slice(0, 6)}
      upcomingReminders={scheduledReminders.slice(0, 6)}
      upcomingAppointments={appointments.slice(0, 6)}
    />
  );
}
