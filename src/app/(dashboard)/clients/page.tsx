import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import ClientsManager from "@/components/ClientsManager";
import { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }

  const { data } = await ctx.supabase
    .from("clients")
    .select("*")
    .eq("salon_id", ctx.salonId)
    .order("created_at", { ascending: false });

  return <ClientsManager initialClients={(data ?? []) as Client[]} />;
}
