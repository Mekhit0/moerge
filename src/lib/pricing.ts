/**
 * Public prices and launch dates: the one place the website reads packages, discounts and SMS
 * packs from. November is a free test month; paid packages start on 1 December in Tbilisi.
 * Billing (BILLING_CONFIG and the plans table) moves to these numbers when payments go live.
 */

type Text = { ka: string; en: string };

/** Paid packages start at midnight on 1 December, Tbilisi time (UTC+4, no daylight saving). */
export const PRICING_STARTS_AT = new Date("2026-12-01T00:00:00+04:00");
export const PILOT_TRIAL_DAYS = 30;
export const TRIAL_DAYS = 14;

/** The December early-bird offer is shown until the end of December. */
export const EARLY_BIRD_ENDS_AT = new Date("2027-01-01T00:00:00+04:00");

/**
 * Before 1 December new salons get the free test month; from then on, a 14-day trial.
 * SMS reminders start with the paid packages on 1 December; nobody can send SMS before that.
 */
export function currentOffer(now: Date = new Date()) {
  const pilot = now.getTime() < PRICING_STARTS_AT.getTime();
  return { pilot, trialDays: pilot ? PILOT_TRIAL_DAYS : TRIAL_DAYS, earlyBird: now.getTime() < EARLY_BIRD_ENDS_AT.getTime(), smsLive: !pilot };
}
export type Offer = ReturnType<typeof currentOffer>;

export type PackageCode = "solo" | "business" | "multi_branch";

export interface PricePackage {
  code: PackageCode;
  name: Text;
  forWho: Text;
  /** One line on why it is worth the money. */
  worth: Text;
  monthlyGel: number;
  staffIncluded: number;
  staffLimit: number;
  extraStaffGel: number | null;
  branches: number;
  extraBranchGel: number | null;
  smsIncluded: number;
  /** False while the package cannot be bought yet. */
  available: boolean;
}

export const PACKAGES: PricePackage[] = [
  {
    code: "solo",
    name: { ka: "სოლო", en: "Solo" },
    forWho: { ka: "ერთი სპეციალისტისთვის", en: "For one specialist" },
    worth: { ka: "კლიენტები თავად ეწერებიან, სანამ თქვენ მუშაობთ", en: "Clients book themselves while you work" },
    monthlyGel: 19,
    staffIncluded: 1,
    staffLimit: 1,
    extraStaffGel: null,
    branches: 1,
    extraBranchGel: null,
    smsIncluded: 100,
    available: true,
  },
  {
    code: "business",
    name: { ka: "ბიზნესი", en: "Business" },
    forWho: { ka: "სალონისთვის გუნდით", en: "For a salon with a team" },
    worth: { ka: "მთელი გუნდი ერთად: სპეციალისტზე 5.90 ₾ თვეში", en: "Your whole team: 5.90 ₾ per specialist a month" },
    monthlyGel: 59,
    staffIncluded: 10,
    staffLimit: 50,
    extraStaffGel: 9,
    branches: 1,
    extraBranchGel: null,
    smsIncluded: 1000,
    available: true,
  },
  {
    code: "multi_branch",
    name: { ka: "მრავალი ფილიალი", en: "Multi-branch" },
    forWho: { ka: "რამდენიმე ფილიალისთვის", en: "For several locations" },
    worth: { ka: "ყველა ფილიალი ერთ ანგარიშში", en: "Every location in one account" },
    monthlyGel: 149,
    staffIncluded: 50,
    staffLimit: 50,
    extraStaffGel: null,
    branches: 3,
    extraBranchGel: 40,
    smsIncluded: 3000,
    available: false,
  },
];

/** Paying for several months up front: months → percent off. */
export const BILLING_PERIODS = [
  { months: 1, discountPercent: 0 },
  { months: 6, discountPercent: 10 },
  { months: 12, discountPercent: 20 },
] as const;
export type BillingMonths = (typeof BILLING_PERIODS)[number]["months"];

/** Refund: 75% of the first payment, if asked for within 14 days of paying. */
export const REFUND = { percent: 75, withinDays: 14 } as const;

/** Extra SMS: twice the provider cost, at least 1000 at a time. Bought SMS never expire. */
export const SMS_PACK = { pricePerSmsGel: 0.02, minimum: 1000 } as const;
export const SMS_PACK_PRICE_GEL = SMS_PACK.pricePerSmsGel * SMS_PACK.minimum;

/** The first salons to subscribe in December get a one-time discount on their first payment. */
export const EARLY_BIRD = { salons: 20, discountPercent: 20 } as const;

/** Price for a package paid for `months` at once, before any early-bird discount. */
export function packagePrice(pkg: PricePackage, months: BillingMonths) {
  const period = BILLING_PERIODS.find((item) => item.months === months) ?? BILLING_PERIODS[0];
  const total = roundGel(pkg.monthlyGel * months * (1 - period.discountPercent / 100));
  return { total, perMonth: roundGel(total / months), discountPercent: period.discountPercent };
}

function roundGel(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 102.6 → "102.60", 59 → "59", 1000 → "1 000": prices the way they are written in Georgia. */
export function formatGel(value: number): string {
  const [whole, cents] = (Number.isInteger(value) ? String(value) : value.toFixed(2)).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return cents ? `${grouped}.${cents}` : grouped;
}

export const CHEAPEST_MONTHLY_GEL = Math.min(...PACKAGES.filter((pkg) => pkg.available).map((pkg) => pkg.monthlyGel));
