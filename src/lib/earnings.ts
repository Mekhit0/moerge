import { addCalendarDays } from "./scheduling";

export type Preset = "today" | "week" | "month" | "last30" | "custom";

export interface Period { from: string; to: string }

export interface MasterNumbers {
  staff_id: string;
  full_name: string;
  color: string | null;
  rate: number;
  completed: number;
  no_show: number;
  paid_total: number;
  payments: number;
  tips: number;
  commission: number;
  booked_minutes: number;
  working_minutes: number;
}

export interface EarningsData {
  money: { paid_total: number; tips: number; discounts: number; cash: number; card: number; payments: number; commission: number; unpaid_count: number; unpaid_value: number };
  expected_total: number;
  visits: { booked: number; completed: number; no_show: number; canceled: number };
  clients: { served: number; new: number };
  masters: MasterNumbers[];
  services: Array<{ name: string; visits: number; paid_total: number }>;
  daily: Array<{ day: string; paid_total: number; visits: number }>;
  heatmap: Array<{ weekday: number; hour: number; visits: number }>;
}

/** Days from `from` to `to`, both included. */
export function periodLength(period: Period): number {
  return Math.round((Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The same number of days right before the period, to compare with. */
export function previousPeriod(period: Period): Period {
  const days = periodLength(period);
  return { from: addCalendarDays(period.from, -days), to: addCalendarDays(period.from, -1) };
}

/** Monday of the week that contains `day`. */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addCalendarDays(day, -((weekday + 6) % 7));
}

/** The period for a quick choice. Week and month run up to today, so they compare like for like. */
export function presetPeriod(preset: Exclude<Preset, "custom">, today: string): Period {
  switch (preset) {
    case "today": return { from: today, to: today };
    case "week": return { from: mondayOf(today), to: today };
    case "month": return { from: `${today.slice(0, 8)}01`, to: today };
    case "last30": return { from: addCalendarDays(today, -29), to: today };
  }
}

/** Change from the previous period in whole percent, or null when there is nothing to compare with. */
export function changePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Booked share of working time in whole percent, or null when the master had no working hours. */
export function occupancy(master: Pick<MasterNumbers, "booked_minutes" | "working_minutes">): number | null {
  if (!master.working_minutes) return null;
  return Math.min(100, Math.round((Number(master.booked_minutes) / Number(master.working_minutes)) * 100));
}

/** What the salon owes a master for the period: commission plus all tips. */
export function payout(master: Pick<MasterNumbers, "commission" | "tips">): number {
  return Math.round((Number(master.commission) + Number(master.tips)) * 100) / 100;
}
