import type { AppointmentStatus } from "@/lib/types";

/**
 * One color per visit state, used on every screen so a status always looks the same.
 * booked = brand rose, arrived = amber, done = emerald, problems = red, canceled = stone.
 */
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  scheduled: "bg-brand-soft text-brand-strong",
  arrived: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-50 text-red-700",
  missed: "bg-red-50 text-red-700",
  canceled: "bg-stone-100 text-stone-500",
};

export function statusTone(status: string): string {
  return STATUS_TONE[status as AppointmentStatus] ?? STATUS_TONE.scheduled;
}

/** Visits in these states do not bring income and are shown faded. */
export const INACTIVE_STATUSES: readonly AppointmentStatus[] = ["canceled", "no_show", "missed"];
