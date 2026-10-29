import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { FakePaymentProvider, getPaymentProvider } from "@/lib/payment-provider";

afterEach(() => { vi.unstubAllEnvs(); });

describe("Phase 4 billing configuration and provider boundary", () => {
  it("keeps plan and usage prices centralized", () => {
    expect(BILLING_CONFIG.plans.business).toMatchObject({ monthlyGel: 60, branches: 1, staffIncluded: 7, staffLimit: 50, sms: 1000 });
    expect(BILLING_CONFIG.plans.multi_branch).toMatchObject({ monthlyGel: 150, staffIncluded: 50, staffLimit: 50, sms: 3000 });
    expect(BILLING_CONFIG.extraStaffMonthlyGel).toBe(9);
    expect(BILLING_CONFIG.prepaidDiscounts).toEqual({ 3: 5, 6: 10, 12: 15 });
    expect(BILLING_CONFIG.smsOveragePriceGel).toBe(0.05);
    expect(BILLING_CONFIG.smsPackPriceGel).toBe(0.03);
    expect(BILLING_CONFIG.smsProviderCostGel).toBe(0.01);
  });

  it("only selects the fake adapter when explicitly enabled", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "fake");
    expect(getPaymentProvider()).toBeInstanceOf(FakePaymentProvider);
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(() => getPaymentProvider()).toThrow(/API documentation first/);
  });

  it("creates a fake checkout URL without contacting a payment provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.moarge.example");
    const checkout = await new FakePaymentProvider().createCheckout({ invoiceId: "invoice-123", amountGel: 60, baseUrl: "https://staging.moarge.example" });
    const url = new URL(checkout.checkoutUrl);
    expect(url.pathname).toBe("/billing/fake-checkout");
    expect(url.searchParams.get("invoice")).toBe("invoice-123");
    expect(checkout.providerPaymentId).toBe("fake_invoice-123");
  });
});




