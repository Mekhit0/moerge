"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Report = {
  revenue_gel: number; booking_count: number; completed_count: number; no_show_count: number;
  no_show_rate: number; returning_clients: number;
  by_staff: Array<{ staff_name: string; booking_count: number; revenue_gel: number }>;
  top_services: Array<{ service_name: string; booking_count: number; revenue_gel: number }>;
};

function formatDate(date: Date) { return date.toISOString().slice(0, 10); }

export default function ReportsManager() {
  const { t } = useLanguage();
  const today = new Date();
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 29);
  const [from, setFrom] = useState(formatDate(monthAgo));
  const [to, setTo] = useState(formatDate(today));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const result = await response.json();
      if (!response.ok) setError(result.error ?? t("ანგარიშის ჩატვირთვა ვერ მოხერხდა.", "Could not load report."));
      else setReport(result.report as Report);
    } catch { setError(t("ქსელური შეცდომა.", "Network error.")); }
    finally { setLoading(false); }
  }, [from, to, t]);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const metrics = report ? [
    [t("შემოსავალი", "Revenue"), `${Number(report.revenue_gel).toFixed(2)} ₾`],
    [t("ჯავშნები", "Bookings"), report.booking_count],
    [t("არ გამოცხადდა", "No-show rate"), `${report.no_show_rate}%`],
    [t("დაბრუნებული კლიენტები", "Returning clients"), report.returning_clients],
  ] : [];
  return <div className="space-y-6 pb-10">
    <header className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">{t("ანგარიშები", "Reports")}</h1>
      <p className="mt-1 text-sm text-stone-500">{t("შეადარეთ სალონის შედეგები არჩეულ პერიოდში.", "Review salon performance for a selected date range.")}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs">{t("დან", "From")}<input className="mt-1 block rounded-xl border border-stone-200 px-3 py-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-xs">{t("მდე", "To")}<input className="mt-1 block rounded-xl border border-stone-200 px-3 py-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" disabled={loading} onClick={() => void loadReport()} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? t("იტვირთება...", "Loading...") : t("განახლება", "Refresh")}</button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-rose-100 bg-white p-5"><div className="text-sm text-stone-500">{label}</div><strong className="mt-2 block text-2xl">{value}</strong></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-3xl border border-rose-100 bg-white p-5"><h2 className="font-bold">{t("სპეციალისტების მიხედვით", "By staff")}</h2><div className="mt-4 divide-y">{report?.by_staff.map((row) => <div key={row.staff_name} className="flex justify-between gap-3 py-3 text-sm"><span>{row.staff_name}<small className="ml-2 text-stone-400">{row.booking_count} {t("ჯავშანი", "bookings")}</small></span><strong>{Number(row.revenue_gel).toFixed(2)} ₾</strong></div>)}{!report?.by_staff.length && <p className="py-4 text-sm text-stone-500">{t("მონაცემები არ არის", "No data for this period")}</p>}</div></section>
      <section className="rounded-3xl border border-rose-100 bg-white p-5"><h2 className="font-bold">{t("პოპულარული სერვისები", "Top services")}</h2><div className="mt-4 divide-y">{report?.top_services.map((row) => <div key={row.service_name} className="flex justify-between gap-3 py-3 text-sm"><span>{row.service_name}<small className="ml-2 text-stone-400">{row.booking_count} {t("ჯავშანი", "bookings")}</small></span><strong>{Number(row.revenue_gel).toFixed(2)} ₾</strong></div>)}{!report?.top_services.length && <p className="py-4 text-sm text-stone-500">{t("მონაცემები არ არის", "No data for this period")}</p>}</div></section>
    </div>
  </div>;
}

