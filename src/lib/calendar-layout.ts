// Pure layout math for the salon calendar (no React), so it can be unit tested.
// Times are minutes since midnight in Tbilisi. Georgia is always UTC+4.

export interface WorkingHoursRow {
  staff_id: string;
  weekday: number; // 0 = Sunday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  is_break: boolean;
}

export interface Interval {
  start: number;
  end: number;
}

export const SLOT_MINUTES = 15;

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

/** Tbilisi date ("YYYY-MM-DD") and minute of day for an ISO timestamp. */
export function tbilisiParts(iso: string): { date: string; minutes: number } {
  const shifted = new Date(new Date(iso).getTime() + 4 * 60 * 60 * 1000);
  return { date: shifted.toISOString().slice(0, 10), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** ISO timestamp for a Tbilisi date and minute of day. */
export function tbilisiIso(date: string, minutes: number): string {
  return new Date(`${date}T${minutesToTime(minutes)}:00+04:00`).toISOString();
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday of the week that contains `date`. */
export function weekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function weekDays(date: string): string[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export const snap = (minutes: number, step = SLOT_MINUTES) => Math.round(minutes / step) * step;

/** Working time of one master on one weekday, with breaks cut out. */
export function workingIntervals(rows: WorkingHoursRow[], staffId: string, weekday: number): Interval[] {
  const mine = rows.filter((row) => row.staff_id === staffId && row.weekday === weekday);
  let open: Interval[] = mine.filter((row) => !row.is_break)
    .map((row) => ({ start: toMinutes(row.start_time), end: toMinutes(row.end_time) }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  for (const pause of mine.filter((row) => row.is_break)) {
    const cut = { start: toMinutes(pause.start_time), end: toMinutes(pause.end_time) };
    open = open.flatMap((interval) => {
      if (cut.end <= interval.start || cut.start >= interval.end) return [interval];
      const parts: Interval[] = [];
      if (cut.start > interval.start) parts.push({ start: interval.start, end: cut.start });
      if (cut.end < interval.end) parts.push({ start: cut.end, end: interval.end });
      return parts;
    });
  }
  return open;
}

/**
 * Which hours the grid shows: from the earliest opening to the latest closing among the visible
 * masters and days, widened to include every visit, rounded to whole hours. Falls back to the
 * salon's hours when nobody has a schedule yet.
 */
export function visibleRange(options: {
  rows: WorkingHoursRow[];
  staffIds: string[];
  weekdays: number[];
  visits: Interval[];
  fallback: Interval;
}): Interval {
  let start = Infinity;
  let end = -Infinity;
  for (const staffId of options.staffIds) {
    for (const weekday of options.weekdays) {
      for (const interval of workingIntervals(options.rows, staffId, weekday)) {
        start = Math.min(start, interval.start);
        end = Math.max(end, interval.end);
      }
    }
  }
  if (!Number.isFinite(start)) {
    start = options.fallback.start;
    end = options.fallback.end;
  }
  for (const visit of options.visits) {
    start = Math.min(start, visit.start);
    end = Math.max(end, visit.end);
  }
  start = Math.max(0, Math.floor(start / 60) * 60);
  end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  if (end - start < 4 * 60) end = Math.min(24 * 60, start + 4 * 60);
  return { start, end };
}

/** Parts of [range] that are outside the given working intervals (shaded on the grid). */
export function closedIntervals(range: Interval, open: Interval[]): Interval[] {
  const closed: Interval[] = [];
  let cursor = range.start;
  for (const interval of [...open].sort((a, b) => a.start - b.start)) {
    if (interval.start > cursor) closed.push({ start: cursor, end: Math.min(interval.start, range.end) });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < range.end) closed.push({ start: cursor, end: range.end });
  return closed.filter((interval) => interval.end > interval.start);
}

/** Pixel position of a block inside a column. */
export function blockStyle(interval: Interval, range: Interval, pxPerMinute: number, minHeight = 22) {
  const top = Math.max(0, (interval.start - range.start) * pxPerMinute);
  const bottom = Math.min((range.end - range.start) * pxPerMinute, (interval.end - range.start) * pxPerMinute);
  return { top, height: Math.max(minHeight, bottom - top) };
}
