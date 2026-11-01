import { describe, expect, it } from "vitest";
import { birthdaySoon, daysBetween, nameKey, segmentsFor, vipThreshold, type ClientStats } from "../src/lib/crm";

const today = "2026-11-01";
const base: ClientStats = {
  client_id: "c", visit_count: 0, no_show_count: 0, total_spent: 0, first_visit: null, last_visit: null,
  next_visit: null, avg_gap_days: null, next_expected_date: null, birthday: null,
};

describe("crm segments", () => {
  it("counts days between dates", () => {
    expect(daysBetween("2026-10-01", today)).toBe(31);
    expect(daysBetween(today, today)).toBe(0);
  });

  it("finds birthdays in the next 7 days across the year end and for 29 February", () => {
    expect(birthdaySoon("1990-11-05", today)).toBe(true);
    expect(birthdaySoon("1990-11-08", today)).toBe(false);
    expect(birthdaySoon("1990-01-02", "2026-12-28")).toBe(true);
    expect(birthdaySoon("2000-02-29", "2027-02-27")).toBe(true);
    expect(birthdaySoon(null, today)).toBe(false);
  });

  it("marks new, regular and lost clients", () => {
    expect(segmentsFor({ ...base, visit_count: 1, first_visit: "2026-10-20", last_visit: "2026-10-20" }, today, Infinity)).toEqual(["new"]);
    expect(segmentsFor({ ...base, visit_count: 4, first_visit: "2026-01-10", last_visit: "2026-10-25", avg_gap_days: 30 }, today, Infinity)).toEqual(["regular"]);
    expect(segmentsFor({ ...base, visit_count: 4, first_visit: "2025-01-10", last_visit: "2026-06-01", avg_gap_days: 30 }, today, Infinity)).toEqual(["lost"]);
  });

  it("flags at-risk clients only when they are away much longer than usual and have no booking", () => {
    const away = { ...base, visit_count: 3, first_visit: "2026-03-01", last_visit: "2026-09-01", avg_gap_days: 28 };
    expect(segmentsFor(away, today, Infinity)).toEqual(["at_risk"]);
    expect(segmentsFor({ ...away, next_visit: "2026-11-10" }, today, Infinity)).toEqual(["regular"]);
  });

  it("lists clients due to return until they book", () => {
    const due = { ...base, visit_count: 1, first_visit: "2026-08-01", last_visit: "2026-08-01", next_expected_date: "2026-10-30" };
    expect(segmentsFor(due, today, Infinity)).toContain("due");
    expect(segmentsFor({ ...due, next_visit: "2026-11-03" }, today, Infinity)).not.toContain("due");
  });

  it("takes the top 10% of paying clients as VIP", () => {
    const spent = [500, 400, 300, 200, 100, 90, 80, 70, 60, 50, 0].map((total_spent) => ({ total_spent }));
    expect(vipThreshold(spent)).toBe(500);
    expect(vipThreshold([...spent, ...spent])).toBe(500);
    expect(vipThreshold([...spent, ...spent, { total_spent: 450 }])).toBe(450);
    expect(vipThreshold([{ total_spent: 0 }])).toBe(Infinity);
    expect(segmentsFor({ ...base, total_spent: 450 }, today, 400)).toEqual(["vip"]);
  });

  it("flags frequent no-shows", () => {
    expect(segmentsFor({ ...base, no_show_count: 2 }, today, Infinity)).toEqual(["no_shows"]);
  });

  it("matches names for duplicate suggestions", () => {
    expect(nameKey("  ნინო   ბერიძე ")).toBe(nameKey("ნინო ბერიძე"));
    expect(nameKey("Nino Beridze")).toBe("nino beridze");
  });
});
