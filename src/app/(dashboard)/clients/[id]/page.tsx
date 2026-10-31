import React from "react";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import { Appointment, Client, EmailLog } from "@/lib/types";
import ClientProfileView from "@/components/ClientProfileView";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login?access=none");
  }

  const { id } = await params;

  const { data: clientData } = await ctx.supabase
    .from("clients")
    .select("id,full_name,email,phone,notes,tags,email_consent,unsubscribed_at,sms_consent,is_archived,is_blocked,last_completed_epilation_date,next_expected_appointment_date,created_at")
    .eq("id", id)
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  if (!clientData) {
    notFound();
  }

  const client = clientData as Client;

  const [{ data: appointmentsData }, { data: logsData }] = await Promise.all([
    ctx.supabase
      .from("appointments")
      .select("id,client_id,treatment_date,treatment_time,treatment_type,status,completed_at,notes,service_name,price_gel,price_snapshot,reminders(id,scheduled_for_date,status)")
      .eq("client_id", client.id)
      .eq("salon_id", ctx.salonId)
      .order("treatment_date", { ascending: false }),
    ctx.supabase
      .from("email_logs")
      .select("id,event_type,subject,error_message,created_at")
      .eq("client_id", client.id)
      .eq("salon_id", ctx.salonId)
      .order("created_at", { ascending: false }),
  ]);

  const appointments = (appointmentsData ?? []) as Appointment[];
  const emailLogs = (logsData ?? []) as EmailLog[];
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const totalSpent = completedAppointments.reduce((sum, appointment) =>
    sum + Number(appointment.price_snapshot ?? appointment.price_gel ?? 0), 0);
  const lastVisit = completedAppointments[0]?.treatment_date ?? null;

  return (
    <ClientProfileView
      client={client}
      appointments={appointments}
      emailLogs={emailLogs}
      totalSpent={totalSpent}
      lastVisit={lastVisit}
      canManage={requireRole(ctx, ["owner", "admin"])}
    />
  );
}
