import { describe, expect, it } from "vitest";
import { changePercent, occupancy, payout, periodLength, presetPeriod, previousPeriod } from "../src/lib/earnings";

describe("earnings periods and numbers", () => {
  it("builds quick periods up to today", () => {
    // 2026-11-04 is a Wednesday.
    expect(presetPeriod("today", "2026-11-04")).toEqual({ from: "2026-11-04", to: "2026-11-04" });
    expect(presetPeriod("week", "2026-11-04")).toEqual({ from: "2026-11-02", to: "2026-11-04" });
    expect(presetPeriod("week", "2026-11-08")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(presetPeriod("month", "2026-11-04")).toEqual({ from: "2026-11-01", to: "2026-11-04" });
    expect(presetPeriod("last30", "2026-11-04")).toEqual({ from: "2026-10-06", to: "2026-11-04" });
  });

  it("compares with the same number of days before", () => {
    expect(periodLength({ from: "2026-11-01", to: "2026-11-04" })).toBe(4);
    expect(previousPeriod({ from: "2026-11-01", to: "2026-11-04" })).toEqual({ from: "2026-10-28", to: "2026-10-31" });
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-01" })).toEqual({ from: "2026-02-28", to: "2026-02-28" });
  });

  it("shows change, occupancy and payout", () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(80, 100)).toBe(-20);
    expect(changePercent(10, 0)).toBeNull();
    expect(occupancy({ booked_minutes: 180, working_minutes: 420 })).toBe(43);
    expect(occupancy({ booked_minutes: 600, working_minutes: 420 })).toBe(100);
    expect(occupancy({ booked_minutes: 60, working_minutes: 0 })).toBeNull();
    expect(payout({ commission: 136, tips: 5.5 })).toBe(141.5);
  });
});
