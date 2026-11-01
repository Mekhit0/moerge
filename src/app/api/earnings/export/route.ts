import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { earningsAccess, loadEarnings, NO_EARNINGS_ACCESS, parsePeriod } from "@/lib/earnings-server";
import { payout } from "@/lib/earnings";

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** GET /api/earnings/export?from&to: master payouts as a CSV file that opens in Excel. */
export async function GET(request: NextRequest) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = earningsAccess(ctx);
  if (access === "none") return NextResponse.json({ error: NO_EARNINGS_ACCESS }, { status: 403 });
  const period = parsePeriod(new URL(request.url).searchParams);
  if (!period) return NextResponse.json({ error: "Choose a period of up to one year." }, { status: 400 });
  const data = await loadEarnings(ctx, period, access);
  if (!data) return NextResponse.json({ error: "Could not load the numbers." }, { status: 500 });

  const header = ["სპეციალისტი / Specialist", "ვიზიტები / Visits", "გადახდილი ₾ / Paid", "საკომისიო % / Rate", "საკომისიო ₾ / Commission", "თიფი ₾ / Tips", "გასაცემი ₾ / Payout"];
  const rows = data.masters
    .filter((row) => row.completed > 0 || row.paid_total > 0)
    .map((row) => [row.full_name, row.completed, row.paid_total.toFixed(2), row.rate, row.commission.toFixed(2), row.tips.toFixed(2), payout(row).toFixed(2)]);
  const lines = [[`${period.from} - ${period.to}`], header, ...rows].map((line) => line.map(csvCell).join(","));
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moarge-payouts-${period.from}-${period.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
