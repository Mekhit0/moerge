export const BILLING_CONFIG = {
  trialDays: 14,
  planInvoiceGraceDays: 7,
  usageInvoiceGraceDays: 7,
  dataRetentionDays: 30,
  defaultSmsOverageCapGel: 50,
  smsOveragePriceGel: 0.05,
  smsPackPriceGel: 0.03,
  smsPackMinimum: 100,
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


