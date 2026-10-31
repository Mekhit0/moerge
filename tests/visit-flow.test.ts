import { describe, expect, it } from "vitest";
import { canChangeVisitStatus, computePayment } from "../src/lib/visit-flow";

describe("visit status changes", () => {
  it("follows booked -> arrived -> done", () => {
    expect(canChangeVisitStatus("scheduled", "arrived")).toBe(true);
    expect(canChangeVisitStatus("arrived", "completed")).toBe(true);
    expect(canChangeVisitStatus("scheduled", "completed")).toBe(true);
  });

  it("allows undoing mistakes but not jumping from canceled to done", () => {
    expect(canChangeVisitStatus("completed", "arrived")).toBe(true);
    expect(canChangeVisitStatus("no_show", "scheduled")).toBe(true);
    expect(canChangeVisitStatus("canceled", "completed")).toBe(false);
    expect(canChangeVisitStatus("completed", "canceled")).toBe(false);
    expect(canChangeVisitStatus("unknown", "arrived")).toBe(false);
  });
});

describe("payment math", () => {
  const base = { price: 40, discountMode: "gel" as const, discountValue: 0, tip: 0, method: "cash" as const, splitCash: 0 };

  it("charges the price in cash by default", () => {
    expect(computePayment(base)).toMatchObject({ total: 40, collect: 40, cash: 40, card: 0, error: null });
  });

  it("applies a percent discount and adds the tip on top", () => {
    const result = computePayment({ ...base, discountMode: "percent", discountValue: 10, tip: 5, method: "card" });
    expect(result).toMatchObject({ discount: 4, total: 36, tip: 5, collect: 41, cash: 0, card: 41, error: null });
  });

  it("splits between cash and card", () => {
    expect(computePayment({ ...base, tip: 10, method: "split", splitCash: 20 })).toMatchObject({ collect: 50, cash: 20, card: 30, error: null });
  });

  it("rejects impossible amounts", () => {
    expect(computePayment({ ...base, discountValue: 50 }).error).toBe("discount");
    expect(computePayment({ ...base, discountMode: "percent", discountValue: 120 }).error).toBe("discount");
    expect(computePayment({ ...base, tip: -1 }).error).toBe("tip");
    expect(computePayment({ ...base, method: "split", splitCash: 60 }).error).toBe("split");
    expect(computePayment({ ...base, price: Number.NaN }).error).toBe(null);
  });

  it("rounds to tetri", () => {
    const result = computePayment({ ...base, price: 33.333, discountMode: "percent", discountValue: 15 });
    expect(result.price).toBe(33.33);
    expect(result.discount).toBe(5);
    expect(result.total).toBe(28.33);
  });
});
