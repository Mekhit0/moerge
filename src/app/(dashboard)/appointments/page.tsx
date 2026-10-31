import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import CalendarView from "@/components/calendar/CalendarView";
import { getTodayInTimeZone } from "@/lib/scheduling";
import { isValidCalendarDate } from "@/lib/validation";
import { toMinutes } from "@/lib/calendar-layout";

export const dynamic = "force-dynamic";

const TIME = /^\d{2}:\d{2}$/;

export default async function AppointmentsPage({ searchParams }: {
  searchParams: Promise<{ date?: string; view?: string; new?: string; time?: string; staffId?: string; clientId?: string }>;
}) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");

  const timezone = ctx.settings.timezone || "Asia/Tbilisi";
  const today = getTodayInTimeZone(timezone);
  const params = await searchParams;
  const initialDate = params.date && isValidCalendarDate(params.date) ? params.date : today;

  const [{ data: staffRows }, { data: serviceRows }] = await Promise.all([
    ctx.supabase.from("staff").select("id,full_name,color,staff_services(service_id)")
      .eq("salon_id", ctx.salonId).eq("is_active", true).order("sort_order"),
    ctx.supabase.from("services").select("id,name_ka,name_en,price_gel,duration_minutes")
      .eq("salon_id", ctx.salonId).eq("is_active", true).order("name_ka"),
  ]);

  const office = requireRole(ctx, ["owner", "admin"]);
  // A master works only in their own column. Without a linked master row they see no column at all.
  const visibleRows = office ? staffRows ?? [] : (staffRows ?? []).filter((member) => member.id === ctx.staffId);
  const staff = visibleRows.map((member) => ({
    id: member.id,
    full_name: member.full_name,
    color: member.color,
    service_ids: (member.staff_services ?? []).map((assignment: { service_id: string }) => assignment.service_id),
  }));

  const initialBooking = office && params.new === "1"
    ? {
        date: initialDate,
        time: params.time && TIME.test(params.time) ? params.time : undefined,
        staffId: params.staffId && staff.some((member) => member.id === params.staffId) ? params.staffId : undefined,
        clientId: params.clientId && /^[0-9a-f-]{36}$/i.test(params.clientId) ? params.clientId : undefined,
      }
    : null;

  return (
    <CalendarView
      today={today}
      timezone={timezone}
      staff={staff}
      services={serviceRows ?? []}
      salonHours={{
        start: toMinutes(ctx.settings.working_hours_start || "10:00"),
        end: toMinutes(ctx.settings.working_hours_end || "20:00"),
      }}
      canManage={office}
      isMaster={!office}
      initialDate={initialDate}
      initialView={params.view === "week" ? "week" : "day"}
      initialBooking={initialBooking}
    />
  );
}
