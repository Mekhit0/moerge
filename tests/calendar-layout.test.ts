import { describe, expect, it } from "vitest";
import {
  blockStyle, closedIntervals, minutesToTime, snap, tbilisiIso, tbilisiParts, visibleRange, weekDays, weekStart, workingIntervals,
  type WorkingHoursRow,
} from "../src/lib/calendar-layout";

const rows: WorkingHoursRow[] = [
  { staff_id: "ana", weekday: 1, start_time: "10:00:00", end_time: "19:00:00", is_break: false },
  { staff_id: "ana", weekday: 1, start_time: "13:00", end_time: "14:00", is_break: true },
  { staff_id: "tamar", weekday: 1, start_time: "09:00", end_time: "15:00", is_break: false },
];

describe("working time", () => {
  it("cuts breaks out of the working day", () => {
    expect(workingIntervals(rows, "ana", 1)).toEqual([{ start: 600, end: 780 }, { start: 840, end: 1140 }]);
    expect(workingIntervals(rows, "ana", 2)).toEqual([]);
  });

  it("shades time outside working hours, including the break", () => {
    const range = { start: 540, end: 1200 };
    expect(closedIntervals(range, workingIntervals(rows, "ana", 1))).toEqual([
      { start: 540, end: 600 }, { start: 780, end: 840 }, { start: 1140, end: 1200 },
    ]);
  });
});

describe("visible hours", () => {
  it("spans the earliest opening to the latest closing, in whole hours", () => {
    expect(visibleRange({ rows, staffIds: ["ana", "tamar"], weekdays: [1], visits: [], fallback: { start: 600, end: 1200 } }))
      .toEqual({ start: 540, end: 1140 });
  });

  it("widens to include a visit outside hours and falls back to salon hours", () => {
    expect(visibleRange({ rows, staffIds: ["ana"], weekdays: [1], visits: [{ start: 1170, end: 1230 }], fallback: { start: 0, end: 0 } }))
      .toEqual({ start: 600, end: 1260 });
    expect(visibleRange({ rows: [], staffIds: ["x"], weekdays: [3], visits: [], fallback: { start: 600, end: 1200 } }))
      .toEqual({ start: 600, end: 1200 });
  });
});

describe("dates and positions", () => {
  it("converts between ISO time and Tbilisi minutes", () => {
    expect(tbilisiParts("2026-11-02T06:30:00.000Z")).toEqual({ date: "2026-11-02", minutes: 630 });
    expect(tbilisiParts("2026-11-01T21:00:00.000Z")).toEqual({ date: "2026-11-02", minutes: 60 });
    expect(tbilisiIso("2026-11-02", 630)).toBe("2026-11-02T06:30:00.000Z");
  });

  it("finds the week from Monday", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week that started Monday
    expect(weekDays("2026-11-04")[0]).toBe("2026-11-02");
    expect(weekDays("2026-11-04")).toHaveLength(7);
  });

  it("snaps to 15 minutes and formats times", () => {
    expect(snap(607)).toBe(600);
    expect(snap(608)).toBe(615);
    expect(minutesToTime(615)).toBe("10:15");
  });

  it("positions blocks and keeps short visits readable", () => {
    expect(blockStyle({ start: 630, end: 690 }, { start: 600, end: 1200 }, 1.6)).toEqual({ top: 48, height: 96 });
    expect(blockStyle({ start: 600, end: 605 }, { start: 600, end: 1200 }, 1.6).height).toBe(22);
  });
});
