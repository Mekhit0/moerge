import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import ClientsManager from "@/components/ClientsManager";
import { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login?access=none");
  }

  const { data } = await ctx.supabase
    .from("clients")
    .select("id,full_name,email,phone,notes,tags,email_consent,unsubscribed_at,sms_consent,is_archived,last_completed_epilation_date,next_expected_appointment_date,created_at")
    .eq("salon_id", ctx.salonId)
    .order("created_at", { ascending: false });

  return <ClientsManager initialClients={(data ?? []) as Client[]} canManageData={ctx.role === "owner" || ctx.role === "admin"} />;
}
