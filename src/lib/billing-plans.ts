import { BILLING_PERIODS, PACKAGES, SMS_PACK, currentOffer, type PackageCode, type PricePackage } from "./pricing";

/**
 * How billing behaves. Prices come from PACKAGES in pricing.ts, the one place the website reads them.
 * Trial length and plan limits are also enforced in the database
 * (migration 20261108100000_paid_plans_from_december.sql); change both together.
 */
export const BILLING_CONFIG = {
  // While a salon is on its free trial it may have up to this many active specialists.
  trialStaffLimit: 10,
  planInvoiceGraceDays: 7,
  dataRetentionDays: 30,
  smsPackPriceGel: SMS_PACK.pricePerSmsGel,
  smsPackMinimum: SMS_PACK.minimum,
  smsProviderCostGel: 0.01,
  extraBranchMonthlyGel: 40,
  maxActiveBranches: 999,
} as const;

export type PaidPlan = PackageCode;

/** The packages a salon can buy today (Multi-branch is not sold yet). */
export const SELLABLE_PLANS = PACKAGES.filter((pkg) => pkg.available).map((pkg) => pkg.code);

export function planInfo(code: PaidPlan): PricePackage {
  return PACKAGES.find((pkg) => pkg.code === code) ?? PACKAGES[1];
}

/** Months a salon can pay for at once. */
export const PAYABLE_MONTHS = BILLING_PERIODS.map((period) => period.months);

/** The billing page and plan purchases open with the paid plans on 1 December. */
export function billingOpen(now: Date = new Date()): boolean {
  return !currentOffer(now).pilot;
}

export function getBillableExtraBranches(activeBranches: number, includedBranches: number): number {
  return Math.max(0, activeBranches - includedBranches);
}

export interface QuoteLine {
  type: "plan" | "adjustment" | "sms_pack";
  description: string;
  quantity: number;
  unitPriceGel: number;
  totalGel: number;
}

function roundGel(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What a salon pays for a plan paid `months` ahead: the period price (6 months -10%, 12 months -20%)
 * and, for the first salons in December, the early-bird discount on that first payment.
 */
export function quotePlan(code: PaidPlan, months: number, earlyBirdPercent = 0): { lines: QuoteLine[]; totalGel: number } {
  const pkg = planInfo(code);
  const period = BILLING_PERIODS.find((item) => item.months === months);
  if (!period) throw new Error("Unsupported billing period.");
  const periodTotal = roundGel(pkg.monthlyGel * months * (1 - period.discountPercent / 100));
  const lines: QuoteLine[] = [{
    type: "plan",
    description: `${pkg.name.en} plan, ${months} month${months === 1 ? "" : "s"}${period.discountPercent ? `, ${period.discountPercent}% off` : ""}`,
    quantity: months,
    unitPriceGel: pkg.monthlyGel,
    totalGel: periodTotal,
  }];
  let total = periodTotal;
  if (earlyBirdPercent > 0) {
    const discount = roundGel(periodTotal * earlyBirdPercent / 100);
    // Stored as a positive amount; the invoice total already has it taken off.
    lines.push({ type: "adjustment", description: `Early-bird discount ${earlyBirdPercent}% (first payment)`, quantity: 1, unitPriceGel: discount, totalGel: discount });
    total = roundGel(periodTotal - discount);
  }
  return { lines, totalGel: total };
}

/** SMS packs: 1000 SMS each. */
export function quoteSmsPacks(packs: number): { lines: QuoteLine[]; totalGel: number; quantity: number } {
  if (!Number.isInteger(packs) || packs < 1 || packs > 50) throw new Error("Choose 1 to 50 packs.");
  const quantity = packs * BILLING_CONFIG.smsPackMinimum;
  const totalGel = roundGel(quantity * BILLING_CONFIG.smsPackPriceGel);
  return { quantity, totalGel, lines: [{ type: "sms_pack", description: `${quantity} SMS`, quantity, unitPriceGel: BILLING_CONFIG.smsPackPriceGel, totalGel }] };
}
