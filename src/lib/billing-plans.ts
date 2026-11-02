export const BILLING_CONFIG = {
  // Pilot month: salons use moarge free, so pricing, checkout and plan pages stay hidden.
  // Trial length and the trial staff cap are also enforced in the database
  // (migration 20261031120000_pilot_trial_limits.sql); change both together.
  billingEnabled: false,
  trialDays: 30,
  trialStaffLimit: 10,
  planInvoiceGraceDays: 7,
  usageInvoiceGraceDays: 7,
  dataRetentionDays: 30,
  defaultSmsOverageCapGel: 50,
  smsOveragePriceGel: 0.05,
  smsPackPriceGel: 0.02,
  smsPackMinimum: 1000,
  smsProviderCostGel: 0.01,
  prepaidDiscounts: { 3: 5, 6: 10, 12: 15 },
  extraStaffMonthlyGel: 9,
  extraBranchMonthlyGel: 40,
  maxActiveBranches: 999,
  plans: {
    business: { name: { ka: "ბიზნესი", en: "Business" }, monthlyGel: 60, branches: 1, staffIncluded: 7, staffLimit: 50, sms: 1000 },
    multi_branch: { name: { ka: "მრავალი ფილიალი", en: "Multi-branch" }, monthlyGel: 150, branches: 3, staffIncluded: 50, staffLimit: 50, sms: 3000 },
  },
} as const;
export type PaidPlan = keyof typeof BILLING_CONFIG.plans;

export function getBillableExtraBranches(activeBranches: number, includedBranches: number): number {
  return Math.max(0, activeBranches - includedBranches);
}


