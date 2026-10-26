import React from "react";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
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
    redirect("/login");
  }

  const { id } = await params;

  const { data: clientData } = await ctx.supabase
    .from("clients")
    .select("*")
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
      .select("*, reminders(*)")
      .eq("client_id", client.id)
      .eq("salon_id", ctx.salonId)
      .order("treatment_date", { ascending: false }),
    ctx.supabase
      .from("email_logs")
      .select("*")
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
    />
  );
}
