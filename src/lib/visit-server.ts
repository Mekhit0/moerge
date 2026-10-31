import "server-only";
import { createServiceClient, requireRole, type AuthenticatedSalonContext } from "./supabase/server";
import { addCalendarDays } from "./scheduling";
import { canChangeVisitStatus } from "./visit-flow";

export interface VisitRow {
  id: string;
  salon_id: string;
  client_id: string;
  service_id: string | null;
  treatment_date: string;
  status: string;
  arrived_at: string | null;
  completed_at: string | null;
}

export type StatusChangeResult =
  | { ok: true; visit: Record<string, unknown> }
  | { ok: false; status: number; error: string };

const VISIT_FIELDS = "id,salon_id,client_id,service_id,treatment_date,status,arrived_at,completed_at";

export async function loadVisit(ctx: AuthenticatedSalonContext, id: string): Promise<VisitRow | null> {
  const { data } = await ctx.supabase.from("appointments").select(VISIT_FIELDS).eq("id", id).eq("salon_id", ctx.salonId).maybeSingle();
  return (data as VisitRow | null) ?? null;
}

/**
 * Moves a visit to a new status if the visit flow allows it. Marking a visit done also sets the
 * client's next expected visit for services with a recall period, like the appointment editor does.
 */
export async function changeVisitStatus(ctx: AuthenticatedSalonContext, visit: VisitRow, next: string): Promise<StatusChangeResult> {
  if (visit.status === next) return { ok: true, visit: { ...visit } };
  if (!canChangeVisitStatus(visit.status, next)) {
    return { ok: false, status: 409, error: "ამ ვიზიტის ასე შეცვლა შეუძლებელია. / This visit cannot be changed that way." };
  }

  if (visit.status === "completed") {
    const { count } = await ctx.supabase.from("visit_payments").select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId).eq("appointment_id", visit.id).is("voided_at", null);
    if ((count ?? 0) > 0) {
      return { ok: false, status: 409, error: "ვიზიტი უკვე გადახდილია. ჯერ გააუქმეთ გადახდა. / This visit is paid. Undo the payment first." };
    }
  }

  const now = new Date().toISOString();
  let nextExpectedDate: string | null = null;
  if (next === "completed" && visit.service_id) {
    const { data: service } = await ctx.supabase.from("services").select("recall_days")
      .eq("salon_id", ctx.salonId).eq("id", visit.service_id).maybeSingle();
    if (service?.recall_days) nextExpectedDate = addCalendarDays(visit.treatment_date, service.recall_days);
  }

  const { data: updated, error } = await ctx.supabase.from("appointments")
    .update({
      status: next,
      arrived_at: next === "arrived" || next === "completed" ? visit.arrived_at ?? now : null,
      completed_at: next === "completed" ? visit.completed_at ?? now : null,
      ...(next === "completed" ? { next_expected_date: nextExpectedDate } : {}),
    })
    .eq("id", visit.id).eq("salon_id", ctx.salonId).eq("status", visit.status)
    .select(VISIT_FIELDS).maybeSingle();

  if (error) {
    // Restoring a canceled visit can collide with a booking made in the meantime.
    const overlap = /exclusion|overlap|conflict/i.test(error.message);
    return {
      ok: false,
      status: overlap ? 409 : 500,
      error: overlap
        ? "ეს დრო უკვე დაკავებულია. / That time is already taken."
        : "ცვლილება ვერ შეინახა. / The change could not be saved.",
    };
  }
  if (!updated) return { ok: false, status: 409, error: "ვიზიტი სხვამ შეცვალა. განაახლეთ გვერდი. / Someone else changed this visit. Refresh the page." };

  if (next === "completed" && nextExpectedDate) {
    // Masters may not edit clients, but finishing their own visit still sets the client's next date.
    // The visit was loaded and updated under the master's own access above, so this is safe.
    const writer = requireRole(ctx, ["owner", "admin"]) ? ctx.supabase : createServiceClient();
    await writer.from("clients")
      .update({ last_completed_epilation_date: visit.treatment_date, next_expected_appointment_date: nextExpectedDate })
      .eq("id", visit.client_id).eq("salon_id", ctx.salonId);
  }
  return { ok: true, visit: updated as Record<string, unknown> };
}
