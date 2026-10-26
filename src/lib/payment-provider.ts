import "server-only";

export type PaymentCheckout = { checkoutUrl: string; providerPaymentId: string };
export type NormalizedPaymentEvent = { eventId: string; invoiceId: string; status: "paid" | "failed"; amountGel: number };
export interface PaymentProvider {
  createCheckout(input: { invoiceId: string; amountGel: number; currency: "GEL"; baseUrl: string }): Promise<PaymentCheckout>;
  verifyWebhook(request: Request): Promise<NormalizedPaymentEvent>;
}

/** Explicitly fake provider for local and staging acceptance only. No real payment network. */
export class FakePaymentProvider implements PaymentProvider {
  async createCheckout(input: { invoiceId: string; amountGel: number; baseUrl: string }): Promise<PaymentCheckout> {
    const url = new URL("/billing/fake-checkout", input.baseUrl);
    url.searchParams.set("invoice", input.invoiceId);
    return { checkoutUrl: url.toString(), providerPaymentId: `fake_${input.invoiceId}` };
  }
  async verifyWebhook(): Promise<NormalizedPaymentEvent> {
    throw new Error("The fake payment provider does not accept provider webhooks.");
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER !== "fake") throw new Error("No payment provider is enabled. Configure an owner-approved provider adapter and its API documentation first.");
  return new FakePaymentProvider();
}


