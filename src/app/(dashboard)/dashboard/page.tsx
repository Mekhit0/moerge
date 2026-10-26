import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";
import type { DashboardAppointment, DashboardReminder } from "@/components/DashboardClient";
import { getTodayInTimeZone } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login");

  const today = getTodayInTimeZone(ctx.settings.timezone || "Asia/Tbilisi");
  const [appointmentCount, appointmentsResult, reminderCount, remindersResult, activeClientCountResult] = await Promise.all([
    ctx.supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId).eq("status", "scheduled").gte("treatment_date", today),
    ctx.supabase.from("appointments")
      .select("id,client:clients(id,full_name),staff:staff(id,full_name),treatment_type,service_name,treatment_date,treatment_time,status")
      .eq("salon_id", ctx.salonId).eq("status", "scheduled").gte("treatment_date", today)
      .order("treatment_date", { ascending: true }).order("treatment_time", { ascending: true }).limit(6),
    ctx.supabase.from("reminders").select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId).eq("status", "scheduled")
      .gte("scheduled_for_date", today),
    ctx.supabase.from("reminders")
      .select("id,scheduled_for_date,status,client:clients(full_name,email)")
      .eq("salon_id", ctx.salonId).eq("status", "scheduled")
      .gte("scheduled_for_date", today)
      .order("scheduled_for_date", { ascending: true }).limit(6),
    ctx.supabase.from("clients").select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId).or("is_archived.is.null,is_archived.eq.false"),
  ]);

  const appointments = (appointmentsResult.data ?? []).map((row) => ({
    ...row,
    client: Array.isArray(row.client) ? row.client[0] : row.client,
    staff: Array.isArray(row.staff) ? row.staff[0] : row.staff,
  })) as unknown as DashboardAppointment[];
  const reminders = (remindersResult.data ?? []).map((row) => ({
    ...row,
    client: Array.isArray(row.client) ? row.client[0] : row.client,
  })) as unknown as DashboardReminder[];

  return <DashboardClient
    salonName={ctx.settings?.salon_name || ctx.salonName}
    timezone={ctx.settings.timezone || "Asia/Tbilisi"}
    stats={{
      activeClients: activeClientCountResult.count ?? 0,
      upcomingAppointments: appointmentCount.count ?? 0,
      upcomingReminders: reminderCount.count ?? 0,
    }}
    upcomingReminders={reminders}
    upcomingAppointments={appointments}
  />;
}
