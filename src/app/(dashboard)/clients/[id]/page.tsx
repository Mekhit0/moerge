import React from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import ClientCard, { type CardClient, type CardNote, type CardVisit } from "@/components/clients/ClientCard";
import { getTodayInTimeZone } from "@/lib/scheduling";
import { vipThreshold, type ClientStats } from "@/lib/crm";

export const dynamic = "force-dynamic";

type VisitRow = {
  id: string; treatment_date: string; treatment_time: string | null; starts_at: string | null; status: string;
  service_name: string | null; treatment_type: string | null; price_gel: number | null; price_snapshot: number | null; notes: string | null;
  staff: { full_name: string; color: string | null } | Array<{ full_name: string; color: string | null }> | null;
  payments: Array<{ total_gel: number; tip_gel: number; voided_at: string | null }> | null;
};

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  // Database policies decide visibility: a master only opens clients of their own visits.
  const { data: client } = await ctx.supabase.from("clients")
    .select("id,full_name,phone,email,notes,tags,birthday,preferred_staff_id,sms_consent,email_consent,preferred_language,is_archived,is_blocked,created_at")
    .eq("id", id).eq("salon_id", ctx.salonId).maybeSingle();
  if (!client) notFound();

  const [{ data: stats }, { data: allSpent }, { data: visits }, { data: notes }, { data: staff }] = await Promise.all([
    ctx.supabase.from("client_stats").select("*").eq("client_id", id).maybeSingle(),
    ctx.supabase.from("client_stats").select("total_spent").eq("salon_id", ctx.salonId).gt("total_spent", 0).order("total_spent", { ascending: false }).limit(1000),
    ctx.supabase.from("appointments")
      .select("id,treatment_date,treatment_time,starts_at,status,service_name,treatment_type,price_gel,price_snapshot,notes,staff:staff(full_name,color),payments:visit_payments(total_gel,tip_gel,voided_at)")
      .eq("salon_id", ctx.salonId).eq("client_id", id)
      .order("treatment_date", { ascending: false }).order("starts_at", { ascending: false }).limit(200),
    ctx.supabase.from("client_notes").select("id,kind,body,created_at,created_by,author:user_profiles(full_name)")
      .eq("salon_id", ctx.salonId).eq("client_id", id).order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("staff").select("id,full_name,color").eq("salon_id", ctx.salonId).eq("is_active", true).order("sort_order"),
  ]);

  const cardVisits: CardVisit[] = ((visits ?? []) as unknown as VisitRow[]).map((visit) => {
    const payment = (visit.payments ?? []).find((row) => !row.voided_at);
    return {
      id: visit.id,
      treatment_date: visit.treatment_date,
      time: (visit.treatment_time ?? "").slice(0, 5),
      status: visit.status,
      service: visit.service_name || visit.treatment_type || "",
      staff: Array.isArray(visit.staff) ? visit.staff[0] ?? null : visit.staff,
      price: Number(visit.price_snapshot ?? visit.price_gel ?? 0),
      paid: payment ? { total: Number(payment.total_gel), tip: Number(payment.tip_gel) } : null,
      notes: visit.notes,
    };
  });

  const cardNotes: CardNote[] = (notes ?? []).map((note) => {
    const author = Array.isArray(note.author) ? note.author[0] : note.author;
    return { ...(note as unknown as CardNote), author: (author as { full_name?: string } | null)?.full_name ?? null };
  });

  return (
    <ClientCard
      client={{ ...client, tags: client.tags ?? [], is_blocked: Boolean(client.is_blocked) } as CardClient}
      stats={(stats as unknown as ClientStats) ?? null}
      vipFrom={vipThreshold((allSpent ?? []) as Array<{ total_spent: number }>)}
      visits={cardVisits}
      initialNotes={cardNotes}
      staff={staff ?? []}
      today={getTodayInTimeZone(ctx.settings.timezone || "Asia/Tbilisi")}
      userId={ctx.user.id}
      canManage={requireRole(ctx, ["owner", "admin"])}
    />
  );
}
