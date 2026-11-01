import { addCalendarDays } from "./scheduling";

/** Numbers for one client, as returned by the client_stats view. Dates are salon-local YYYY-MM-DD. */
export interface ClientStats {
  client_id: string;
  visit_count: number;
  no_show_count: number;
  total_spent: number;
  first_visit: string | null;
  last_visit: string | null;
  next_visit: string | null;
  avg_gap_days: number | null;
  next_expected_date: string | null;
  birthday: string | null;
}

export type Segment = "new" | "regular" | "vip" | "at_risk" | "lost" | "due" | "birthday" | "no_shows";

export const SEGMENTS: readonly Segment[] = ["due", "at_risk", "birthday", "new", "regular", "vip", "lost", "no_shows"];

export const SEGMENT_LABELS: Record<Segment, { ka: string; en: string; hint: { ka: string; en: string } }> = {
  due: { ka: "დაბრუნების დროა", en: "Due to return", hint: { ka: "სერვისის განმეორების დრო დადგა", en: "Their service is due again" } },
  at_risk: { ka: "საფრთხეშია", en: "At risk", hint: { ka: "ჩვეულებრივზე დიდხანს არ მოსულა", en: "Away longer than usual" } },
  birthday: { ka: "დაბადების დღე", en: "Birthday", hint: { ka: "ამ 7 დღეში", en: "In the next 7 days" } },
  new: { ka: "ახალი", en: "New", hint: { ka: "პირველი ვიზიტი ბოლო 30 დღეში", en: "First visit in the last 30 days" } },
  regular: { ka: "მუდმივი", en: "Regular", hint: { ka: "3 ან მეტი ვიზიტი", en: "3 or more visits" } },
  vip: { ka: "VIP", en: "VIP", hint: { ka: "ყველაზე მეტი დახარჯა", en: "Top spenders" } },
  lost: { ka: "დაკარგული", en: "Lost", hint: { ka: "90 დღეზე მეტია არ მოსულა", en: "No visit for 90+ days" } },
  no_shows: { ka: "არ მოდის", en: "No-shows", hint: { ka: "2 ან მეტჯერ არ მოვიდა", en: "Missed 2 or more visits" } },
};

export const LOST_AFTER_DAYS = 90;
export const NEW_WITHIN_DAYS = 30;
export const REGULAR_FROM_VISITS = 3;
export const NO_SHOWS_FROM = 2;

/** Whole days from a to b (b later is positive). Both are YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** True when the birthday (any year) falls within the next `days` days, today included. */
export function birthdaySoon(birthday: string | null, today: string, days = 7): boolean {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
  const monthDay = birthday.slice(5);
  for (let offset = 0; offset < days; offset += 1) {
    const day = addCalendarDays(today, offset);
    if (day.slice(5) === monthDay) return true;
    // People born on 29 February celebrate on 28 February in other years.
    if (monthDay === "02-29" && day.slice(5) === "02-28" && !isLeap(Number(day.slice(0, 4)))) return true;
  }
  return false;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The spending level from which a client counts as VIP: the top 10% of clients who paid anything,
 * at least one client. Returns Infinity when nobody has spent money yet.
 */
export function vipThreshold(all: ReadonlyArray<Pick<ClientStats, "total_spent">>): number {
  const spent = all.map((row) => Number(row.total_spent) || 0).filter((value) => value > 0).sort((a, b) => b - a);
  if (spent.length === 0) return Infinity;
  return spent[Math.max(0, Math.ceil(spent.length * 0.1) - 1)];
}

/** Every automatic list this client belongs to today. */
export function segmentsFor(stats: ClientStats, today: string, vipFrom: number): Segment[] {
  const result: Segment[] = [];
  const sinceLast = stats.last_visit ? daysBetween(stats.last_visit, today) : null;
  const hasUpcoming = Boolean(stats.next_visit && stats.next_visit >= today);
  const lost = sinceLast !== null && sinceLast > LOST_AFTER_DAYS && !hasUpcoming;
  const usualGap = stats.avg_gap_days && stats.visit_count >= 2 ? stats.avg_gap_days : null;
  const atRisk = !lost && !hasUpcoming && usualGap !== null && sinceLast !== null && sinceLast > Math.max(usualGap * 1.5, 30);

  if (!hasUpcoming && stats.next_expected_date && stats.next_expected_date <= today) result.push("due");
  if (atRisk) result.push("at_risk");
  if (birthdaySoon(stats.birthday, today)) result.push("birthday");
  if (stats.first_visit && daysBetween(stats.first_visit, today) <= NEW_WITHIN_DAYS) result.push("new");
  if (stats.visit_count >= REGULAR_FROM_VISITS && !atRisk && !lost) result.push("regular");
  if (Number(stats.total_spent) > 0 && Number(stats.total_spent) >= vipFrom) result.push("vip");
  if (lost) result.push("lost");
  if (stats.no_show_count >= NO_SHOWS_FROM) result.push("no_shows");
  return result;
}

/** Lowercase name without extra spaces, used to suggest possible duplicate clients. */
export function nameKey(name: string): string {
  return name.toLocaleLowerCase("ka").replace(/\s+/g, " ").trim();
}

/** First letter for an avatar. Georgian stays as written; upper-casing would turn it into Mtavruli. */
export function initialOf(name: string): string {
  const first = name.trim().charAt(0);
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}
