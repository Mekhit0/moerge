import type { AppointmentStatus } from "./types";

/**
 * The visit lifecycle every screen follows:
 *   booked (scheduled) -> arrived -> done (completed) -> paid
 * plus no-show and canceled, each with a way back for mistakes.
 * The server enforces the same table before changing a status.
 */
export const VISIT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  scheduled: ["arrived", "completed", "no_show", "canceled"],
  arrived: ["completed", "scheduled", "no_show"],
  completed: ["arrived"],
  no_show: ["scheduled"],
  missed: ["scheduled"],
  canceled: ["scheduled"],
};

export function canChangeVisitStatus(from: string, to: string): boolean {
  return (VISIT_TRANSITIONS[from as AppointmentStatus] ?? []).includes(to as AppointmentStatus);
}

export type PaymentMethod = "cash" | "card" | "split";
export type DiscountMode = "gel" | "percent";

export interface PaymentInput {
  price: number;
  discountMode: DiscountMode;
  discountValue: number;
  tip: number;
  method: PaymentMethod;
  /** Cash part when the method is split; the rest is paid by card. */
  splitCash: number;
}

export interface PaymentBreakdown {
  price: number;
  discount: number;
  total: number;
  tip: number;
  /** What the client hands over: total plus tip. */
  collect: number;
  cash: number;
  card: number;
  error: null | "price" | "discount" | "tip" | "split";
}

const round2 = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

/** Payment math shared by the pay sheet and the server request; the database checks it again. */
export function computePayment(input: PaymentInput): PaymentBreakdown {
  const price = round2(input.price);
  const tip = round2(input.tip);
  const rawDiscount = input.discountMode === "percent" ? (price * input.discountValue) / 100 : input.discountValue;
  const discount = round2(rawDiscount);
  const total = round2(price - discount);
  const collect = round2(total + tip);

  let error: PaymentBreakdown["error"] = null;
  if (!(price >= 0) || price > 100000) error = "price";
  else if (!(discount >= 0) || discount > price || (input.discountMode === "percent" && input.discountValue > 100)) error = "discount";
  else if (!(tip >= 0) || tip > 100000) error = "tip";

  let cash = 0;
  let card = 0;
  if (input.method === "cash") cash = collect;
  else if (input.method === "card") card = collect;
  else {
    cash = round2(input.splitCash);
    card = round2(collect - cash);
    if (!error && (cash < 0 || card < 0)) error = "split";
  }

  return { price, discount, total, tip, collect, cash, card, error };
}

export function formatGel(value: number, locale: "ka" | "en" = "ka"): string {
  const formatted = new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
  return `${formatted} ₾`;
}
