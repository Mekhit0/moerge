import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import AppointmentsManager from "@/components/AppointmentsManager";
import StaffCalendar from "@/components/StaffCalendar";
import { Appointment, Client, CustomBookingService } from "@/lib/types";
import { addCalendarDays, getTodayInTimeZone } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }
  const timezone = ctx.settings.timezone || "Asia/Tbilisi";
  const today = getTodayInTimeZone(timezone);

  const [{ data: appointmentsData }, { data: clientsData }, { data: staffData }, { data: serviceData }] = await Promise.all([
    ctx.supabase
      .from("appointments")
      .select(
        "id,client_id,treatment_date,treatment_time,treatment_type,is_epilation,status,completed_at,next_expected_date,notes,service_id,service_name,price_gel,duration_minutes,staff_id,starts_at,ends_at,client:clients(id,full_name,email,phone,is_archived,email_consent),reminders(id,scheduled_for_date,status),staff:staff(id,full_name,color)"
      )
      .eq("salon_id", ctx.salonId)
      .gte("treatment_date", addCalendarDays(today, -180))
      .lte("treatment_date", addCalendarDays(today, 90))
      .order("starts_at", { ascending: true })
      .limit(1000),
    ctx.supabase
      .from("clients")
      .select("id,full_name,email,phone,is_archived")
      .eq("salon_id", ctx.salonId)
      .order("full_name", { ascending: true }),
    ctx.supabase.from("staff").select("id,full_name,color,is_active,staff_services(service_id)").eq("salon_id", ctx.salonId).order("sort_order"),
    ctx.supabase.from("services").select("id,legacy_id,name_ka,name_en,price_gel,duration_minutes,category,recall_days,is_active,is_online_bookable").eq("salon_id", ctx.salonId).eq("is_active", true),
  ]);
  const customServices: CustomBookingService[] = (serviceData ?? []).map((service) => ({
    id: service.id,
    type: service.category as CustomBookingService["type"],
    name_ka: service.name_ka,
    name_en: service.name_en,
    desc_ka: "",
    desc_en: "",
    price_gel: service.price_gel,
    duration_minutes: service.duration_minutes,
    is_epilation: service.recall_days !== null,
    reminder_days: service.recall_days,
    enabled: service.is_active,
  }));
  const staffForAppointments = (staffData ?? []).map((member) => ({
    id: member.id,
    full_name: member.full_name,
    color: member.color,
    is_active: member.is_active,
    service_ids: (member.staff_services ?? []).map((assignment) => assignment.service_id),
  }));

  return (
    <>
    <StaffCalendar initialBookings={[]} staff={staffData ?? []} timezone={timezone} />
    <AppointmentsManager
      initialAppointments={(appointmentsData ?? []) as unknown as Appointment[]}
      clients={(clientsData ?? []) as Client[]}
      reminderIntervalDays={ctx.settings.reminder_interval_days}
      timezone={timezone}
      customServices={customServices}
      workingHoursStart={ctx.settings.working_hours_start || "10:00"}
      workingHoursEnd={ctx.settings.working_hours_end || "20:00"}
      slotIntervalMinutes={ctx.settings.slot_interval_minutes || 60}
      staffMembers={staffForAppointments}
    />
    </>
  );
}
