import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import AppointmentsManager from "@/components/AppointmentsManager";
import { Appointment, Client, DEFAULT_CUSTOM_SERVICES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }

  const [{ data: appointmentsData }, { data: clientsData }] = await Promise.all([
    ctx.supabase
      .from("appointments")
      .select(
        "*, client:clients(id, full_name, email, phone, is_archived, email_consent), reminders(*)"
      )
      .eq("salon_id", ctx.salonId)
      .order("treatment_date", { ascending: false })
      .order("treatment_time", { ascending: false }),
    ctx.supabase
      .from("clients")
      .select("*")
      .eq("salon_id", ctx.salonId)
      .order("full_name", { ascending: true }),
  ]);

  return (
    <AppointmentsManager
      initialAppointments={(appointmentsData ?? []) as Appointment[]}
      clients={(clientsData ?? []) as Client[]}
      reminderIntervalDays={ctx.settings.reminder_interval_days}
      timezone={ctx.settings.timezone || "Asia/Tbilisi"}
      customServices={
        Array.isArray(ctx.settings.custom_services) &&
        ctx.settings.custom_services.length > 0
          ? ctx.settings.custom_services
          : DEFAULT_CUSTOM_SERVICES
      }
      workingHoursStart={ctx.settings.working_hours_start || "10:00"}
      workingHoursEnd={ctx.settings.working_hours_end || "20:00"}
      slotIntervalMinutes={ctx.settings.slot_interval_minutes || 60}
    />
  );
}
