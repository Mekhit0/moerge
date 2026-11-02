import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";
import type { DashboardAppointment } from "@/components/DashboardClient";
import { addCalendarDays, getTodayInTimeZone } from "@/lib/scheduling";
import { appUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

const APPOINTMENT_FIELDS =
  "id,client:clients(id,full_name,phone),staff:staff(id,full_name,color),treatment_type,service_name,treatment_date,treatment_time,starts_at,status,price_gel,booking_code," +
  "payments:visit_payments(id,price_gel,discount_gel,total_gel,tip_gel,cash_gel,card_gel,created_at,voided_at)";

type PaymentRow = { voided_at: string | null } & Record<string, unknown>;
type AppointmentRow = Record<string, unknown> & { client?: unknown; staff?: unknown; payments?: PaymentRow[] | null };

function normalize(rows: AppointmentRow[] | null): DashboardAppointment[] {
  return (rows ?? []).map(({ payments, ...row }) => ({
    ...row,
    client: Array.isArray(row.client) ? row.client[0] : row.client,
    staff: Array.isArray(row.staff) ? row.staff[0] : row.staff,
    // At most one payment per visit is active; undone payments stay in the table for history.
    payment: (payments ?? []).find((payment) => !payment.voided_at) ?? null,
  })) as unknown as DashboardAppointment[];
}

export default async function DashboardPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");

  const timezone = ctx.settings.timezone || "Asia/Tbilisi";
  const today = getTodayInTimeZone(timezone);
  const canManage = requireRole(ctx, ["owner", "admin"]);
  const head = { count: "exact" as const, head: true };

  // Georgia is always UTC+4, so the salon day starts at local midnight +04:00.
  const dayStart = `${today}T00:00:00+04:00`;
  const dayEnd = `${addCalendarDays(today, 1)}T00:00:00+04:00`;

  const [todayResult, upcomingResult, reminderCount, serviceCount, staffCount, hoursCount, appointmentTotal, paidResult] = await Promise.all([
    ctx.supabase.from("appointments").select(APPOINTMENT_FIELDS)
      .eq("salon_id", ctx.salonId).eq("treatment_date", today)
      .order("starts_at", { ascending: true }).limit(200),
    ctx.supabase.from("appointments").select(APPOINTMENT_FIELDS)
      .eq("salon_id", ctx.salonId).eq("status", "scheduled")
      .gte("treatment_date", addCalendarDays(today, 1))
      .order("starts_at", { ascending: true }).limit(5),
    ctx.supabase.from("notification_log").select("id", head)
      .eq("salon_id", ctx.salonId).eq("channel", "sms").eq("status", "pending"),
    ctx.supabase.from("services").select("id", head).eq("salon_id", ctx.salonId).eq("is_active", true),
    ctx.supabase.from("staff").select("id", head).eq("salon_id", ctx.salonId).eq("is_active", true),
    ctx.supabase.from("staff_working_hours").select("id", head).eq("salon_id", ctx.salonId),
    ctx.supabase.from("appointments").select("id", head).eq("salon_id", ctx.salonId),
    canManage
      ? ctx.supabase.from("visit_payments").select("total_gel,tip_gel")
        .eq("salon_id", ctx.salonId).is("voided_at", null).gte("created_at", dayStart).lt("created_at", dayEnd).limit(1000)
      : Promise.resolve({ data: [] as Array<{ total_gel: number; tip_gel: number }> }),
  ]);
  const paidRows = (paidResult.data ?? []) as Array<{ total_gel: number; tip_gel: number }>;
  const paidToday = {
    total: paidRows.reduce((sum, row) => sum + Number(row.total_gel), 0),
    tips: paidRows.reduce((sum, row) => sum + Number(row.tip_gel), 0),
    count: paidRows.length,
  };

  return <DashboardClient
    salonName={ctx.settings?.salon_name || ctx.salonName}
    staffName={ctx.user.fullName}
    timezone={timezone}
    today={today}
    paidToday={paidToday}
    bookingUrl={appUrl(`/book?salon=${encodeURIComponent(ctx.salonSlug)}`)}
    canManage={canManage}
    todayAppointments={normalize(todayResult.data as AppointmentRow[] | null)}
    upcomingAppointments={normalize(upcomingResult.data as AppointmentRow[] | null)}
    scheduledReminders={reminderCount.count ?? 0}
    setup={{
      services: (serviceCount.count ?? 0) > 0,
      staff: (staffCount.count ?? 0) > 0,
      workingHours: (hoursCount.count ?? 0) > 0,
      firstBooking: (appointmentTotal.count ?? 0) > 0,
    }}
  />;
}
