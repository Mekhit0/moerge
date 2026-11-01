import "server-only";
import type { AuthenticatedSalonContext } from "./supabase/server";
import type { EarningsData, Period } from "./earnings";
import { isValidCalendarDate } from "./validation";

export type EarningsAccess = "owner" | "office" | "master" | "none";

/**
 * Who may open earnings: the owner always, admins only when the owner allows it, masters for their
 * own numbers. A master without a linked master row has nothing to see.
 */
export function earningsAccess(ctx: AuthenticatedSalonContext): EarningsAccess {
  if (ctx.role === "owner") return "owner";
  if (ctx.role === "admin") return ctx.settings.admins_see_earnings ? "office" : "none";
  return ctx.staffId ? "master" : "none";
}

export const NO_EARNINGS_ACCESS = "შემოსავლის ნახვა მფლობელმა უნდა დაგიშვათ. / The owner has not shared earnings with you.";

/** Reads ?from&to, up to one year. */
export function parsePeriod(params: URLSearchParams): Period | null {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || to < from) return null;
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 86_400_000) return null;
  return { from, to };
}

/** One period of numbers. The database runs it under the caller's own access; masters see only their row. */
export async function loadEarnings(ctx: AuthenticatedSalonContext, period: Period, access: EarningsAccess): Promise<EarningsData | null> {
  const { data, error } = await ctx.supabase.rpc("get_earnings", { p_salon_id: ctx.salonId, p_from: period.from, p_to: period.to });
  if (error || !data) return null;
  const result = data as EarningsData;
  if (access === "master") result.masters = result.masters.filter((row) => row.staff_id === ctx.staffId);
  for (const row of result.masters) {
    for (const key of ["rate", "completed", "no_show", "paid_total", "payments", "tips", "commission", "booked_minutes", "working_minutes"] as const) {
      row[key] = Number(row[key]);
    }
  }
  return result;
}
