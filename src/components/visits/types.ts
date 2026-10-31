import type { AppointmentStatus } from "@/lib/types";

export interface VisitPayment {
  id: string;
  price_gel: number;
  discount_gel: number;
  total_gel: number;
  tip_gel: number;
  cash_gel: number;
  card_gel: number;
  created_at: string;
  voided_at?: string | null;
}

/** A visit as the Today screen, calendar and client card show it. */
export interface Visit {
  id: string;
  client?: { id: string; full_name: string; phone?: string | null } | null;
  staff?: { id: string; full_name: string; color?: string | null } | null;
  treatment_type: string;
  service_name?: string | null;
  treatment_date: string;
  treatment_time: string;
  starts_at: string;
  status: AppointmentStatus;
  price_gel?: number | null;
  booking_code?: string | null;
  payment?: VisitPayment | null;
}
