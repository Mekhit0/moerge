import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import ClientsList, { type ClientRow } from "@/components/clients/ClientsList";
import { getTodayInTimeZone } from "@/lib/scheduling";
import type { ClientStats } from "@/lib/crm";

export const dynamic = "force-dynamic";

const LIMIT = 5000;
const PAGE = 1000; // The API returns at most 1000 rows per request.

async function loadAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < LIMIT; from += PAGE) {
    const { data } = await page(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  const params = await searchParams;

  // Masters get only the clients of their own visits, and numbers from their own visits (database policies).
  const [clients, stats, { data: staff }] = await Promise.all([
    loadAll((from, to) => ctx.supabase.from("clients").select("id,full_name,phone,email,notes,is_archived,is_blocked,created_at")
      .eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).order("id").range(from, to)),
    loadAll((from, to) => ctx.supabase.from("client_stats").select("*").eq("salon_id", ctx.salonId).order("client_id").range(from, to)),
    ctx.supabase.from("staff").select("id,full_name,color").eq("salon_id", ctx.salonId).eq("is_active", true).order("sort_order"),
  ]);

  const statsById = new Map(stats.map((row) => [row.client_id as string, row as unknown as ClientStats]));
  const rows: ClientRow[] = clients.map((client) => ({
    ...client,
    is_blocked: Boolean(client.is_blocked),
    stats: statsById.get(client.id) ?? null,
  }));

  return (
    <ClientsList
      clients={rows}
      staff={staff ?? []}
      today={getTodayInTimeZone(ctx.settings.timezone || "Asia/Tbilisi")}
      canManage={requireRole(ctx, ["owner", "admin"])}
      startNew={params.new === "1"}
    />
  );
}
