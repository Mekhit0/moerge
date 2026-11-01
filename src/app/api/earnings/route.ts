import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { earningsAccess, loadEarnings, NO_EARNINGS_ACCESS, parsePeriod } from "@/lib/earnings-server";
import { previousPeriod } from "@/lib/earnings";

/** GET /api/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD: the period and the same number of days before it. */
export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = earningsAccess(ctx);
  if (access === "none") return NextResponse.json({ error: NO_EARNINGS_ACCESS }, { status: 403 });
  const period = parsePeriod(new URL(request.url).searchParams);
  if (!period) return NextResponse.json({ error: "აირჩიეთ პერიოდი, მაქსიმუმ ერთი წელი. / Choose a period of up to one year." }, { status: 400 });

  const before = previousPeriod(period);
  const [current, previous] = await Promise.all([loadEarnings(ctx, period, access), loadEarnings(ctx, before, access)]);
  if (!current || !previous) return NextResponse.json({ error: "მონაცემები ვერ ჩაიტვირთა. / Could not load the numbers." }, { status: 500 });
  return NextResponse.json({ access, period, previous_period: before, current, previous });
}
