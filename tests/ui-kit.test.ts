import { describe, expect, it } from "vitest";
import { cn } from "../src/components/ui/cn";
import { STATUS_TONE, statusTone } from "../src/components/ui/status";
import { formatLongDate, shortDayLabels, tbilisiDate, tbilisiNowMinutes, timeToMinutes } from "../src/lib/dates";

describe("cn", () => {
  it("lets a later Tailwind class override an earlier one", () => {
    expect(cn("px-4 py-2", false && "hidden", "px-6")).toBe("py-2 px-6");
  });
});

describe("visit status colors", () => {
  it("has a color for every visit state and falls back to booked", () => {
    for (const status of ["scheduled", "arrived", "completed", "no_show", "missed", "canceled"]) {
      expect(STATUS_TONE[status as keyof typeof STATUS_TONE]).toBeTruthy();
    }
    expect(statusTone("unknown")).toBe(STATUS_TONE.scheduled);
  });
});

describe("Tbilisi dates", () => {
  // 2026-10-31 21:30 UTC is already 2026-11-01 01:30 in Tbilisi (UTC+4).
  const lateUtc = new Date("2026-10-31T21:30:00Z");

  it("uses the Tbilisi calendar day, not UTC", () => {
    expect(tbilisiDate(0, lateUtc)).toBe("2026-11-01");
    expect(tbilisiDate(1, lateUtc)).toBe("2026-11-02");
    expect(tbilisiNowMinutes(lateUtc)).toBe(90);
  });

  it("formats Georgian and English names without relying on the browser", () => {
    expect(formatLongDate("2026-11-01", "ka")).toBe("კვირა, 1 ნოემბერი");
    expect(formatLongDate("2026-11-01", "en")).toBe("Sunday, 1 November");
    expect(shortDayLabels("2026-11-02", "ka")).toEqual({ weekday: "ორშ", day: 2, month: "ნოე" });
  });

  it("converts times to minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("17:00:00")).toBe(1020);
  });
});
