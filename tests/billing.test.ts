import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BILLING_CONFIG, PAYABLE_MONTHS, SELLABLE_PLANS, billingOpen, getBillableExtraBranches, planInfo, quotePlan, quoteSmsPacks } from "@/lib/billing-plans";
import { FakePaymentProvider, getPaymentProvider } from "@/lib/payment-provider";

afterEach(() => { vi.unstubAllEnvs(); });

describe("Billing from 1 December", () => {
  it("sells Solo and Business at the published prices, not Multi-branch yet", () => {
    expect(SELLABLE_PLANS).toEqual(["solo", "business"]);
    expect(planInfo("solo")).toMatchObject({ monthlyGel: 19, staffLimit: 1, smsIncluded: 100 });
    expect(planInfo("business")).toMatchObject({ monthlyGel: 59, staffIncluded: 10, extraStaffGel: 9, smsIncluded: 1000 });
    expect(PAYABLE_MONTHS).toEqual([1, 6, 12]);
    expect(BILLING_CONFIG.smsPackPriceGel).toBe(0.02);
    expect(BILLING_CONFIG.smsPackMinimum).toBe(1000);
  });

  it("prices paying ahead with 10% and 20% off", () => {
    expect(quotePlan("business", 1).totalGel).toBe(59);
    expect(quotePlan("business", 6).totalGel).toBe(318.6);
    expect(quotePlan("business", 12).totalGel).toBe(566.4);
    expect(quotePlan("solo", 12).totalGel).toBe(182.4);
    expect(() => quotePlan("business", 3)).toThrow();
  });

  it("takes the early-bird discount off the first payment and records it as its own line", () => {
    const quote = quotePlan("business", 1, 20);
    expect(quote.totalGel).toBe(47.2);
    expect(quote.lines.map((line) => line.type)).toEqual(["plan", "adjustment"]);
    expect(quote.lines[1].totalGel).toBe(11.8);
  });

  it("sells SMS in packs of 1000 at 0.02 ₾", () => {
    expect(quoteSmsPacks(1)).toMatchObject({ quantity: 1000, totalGel: 20 });
    expect(quoteSmsPacks(5)).toMatchObject({ quantity: 5000, totalGel: 100 });
    expect(() => quoteSmsPacks(0)).toThrow();
    expect(() => quoteSmsPacks(51)).toThrow();
  });

  it("opens the billing page on 1 December, Tbilisi time", () => {
    expect(billingOpen(new Date("2026-11-30T19:59:59Z"))).toBe(false);
    expect(billingOpen(new Date("2026-11-30T20:00:00Z"))).toBe(true);
  });

  it("charges for multi-branch locations after the three included branches", () => {
    expect(getBillableExtraBranches(3, planInfo("multi_branch").branches)).toBe(0);
    expect(getBillableExtraBranches(4, planInfo("multi_branch").branches)).toBe(1);
  });

  it("only selects the fake adapter when explicitly enabled", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    expect(getPaymentProvider()).toBeInstanceOf(FakePaymentProvider);
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(() => getPaymentProvider()).toThrow(/API documentation first/);
  });

  it("creates a fake checkout URL without contacting a payment provider", async () => {
    const checkout = await new FakePaymentProvider().createCheckout({ invoiceId: "invoice-123", amountGel: 59, baseUrl: "https://staging.moarge.example" });
    const url = new URL(checkout.checkoutUrl);
    expect(url.pathname).toBe("/billing/fake-checkout");
    expect(url.searchParams.get("invoice")).toBe("invoice-123");
  });
});
