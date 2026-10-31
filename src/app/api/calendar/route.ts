import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { addCalendarDays } from "@/lib/scheduling";
import { isValidCalendarDate } from "@/lib/validation";

const VISIT_FIELDS =
  "id,client:clients(id,full_name,phone),staff:staff(id,full_name,color),staff_id,treatment_type,service_name,treatment_date,treatment_time,starts_at,ends_at,status,price_gel,booking_code," +
  "payments:visit_payments(id,price_gel,discount_gel,total_gel,tip_gel,cash_gel,card_gel,created_at,voided_at)";

const MAX_DAYS = 14;

type Row = Record<string, unknown> & { client?: unknown; staff?: unknown; payments?: Array<{ voided_at: string | null }> | null };

/**
 * Everything the calendar needs for the visible days in one request: visits (without canceled ones,
 * which no longer hold the time), blocked times and each master's working hours.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || to < from || addCalendarDays(from, MAX_DAYS) < to) {
    return NextResponse.json({ error: "Choose a date range of up to 14 days." }, { status: 400 });
  }

  // Georgia is always UTC+4.
  const rangeStart = `${from}T00:00:00+04:00`;
  const rangeEnd = `${addCalendarDays(to, 1)}T00:00:00+04:00`;

  const [visits, timeOff, hours] = await Promise.all([
    ctx.supabase.from("appointments").select(VISIT_FIELDS)
      .eq("salon_id", ctx.salonId).gte("treatment_date", from).lte("treatment_date", to)
      .neq("status", "canceled").order("starts_at", { ascending: true }).limit(2000),
    ctx.supabase.from("time_off").select("id,staff_id,starts_at,ends_at,reason")
      .eq("salon_id", ctx.salonId).lt("starts_at", rangeEnd).gt("ends_at", rangeStart).limit(500),
    ctx.supabase.from("staff_working_hours").select("staff_id,weekday,start_time,end_time,is_break")
      .eq("salon_id", ctx.salonId),
  ]);
  if (visits.error || timeOff.error || hours.error) {
    return NextResponse.json({ error: "კალენდარი ვერ ჩაიტვირთა. / Could not load the calendar." }, { status: 500 });
  }

  const normalized = ((visits.data ?? []) as unknown as Row[]).map(({ payments, ...row }) => ({
    ...row,
    client: Array.isArray(row.client) ? row.client[0] : row.client,
    staff: Array.isArray(row.staff) ? row.staff[0] : row.staff,
    payment: (payments ?? []).find((payment) => !payment.voided_at) ?? null,
  }));

  return NextResponse.json({ visits: normalized, timeOff: timeOff.data ?? [], hours: hours.data ?? [] });
}
