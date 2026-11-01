"use client";

import React, { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { EN_WEEKDAYS, KA_WEEKDAYS_SHORT, formatShortDate } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { cn } from "@/components/ui";

// One series in the brand rose; magnitude uses a rose ramp checked for even steps and contrast
// against the white card (rose 400, 600, 700, 900). Empty cells stay neutral.
const BAR = "#e11d48";
const RAMP = ["#fb7185", "#e11d48", "#be123c", "#881337"];

/** Paid money per day as thin bars, with a hover tooltip and a table view for screen readers. */
export function DailyBars({ days }: { days: Array<{ day: string; paid_total: number; visits: number }> }) {
  const { lang, t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((day) => Number(day.paid_total)), 0);
  const year = new Date().getFullYear();
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const active = hover !== null ? days[hover] : null;

  if (max === 0) return <p className="py-8 text-center text-sm text-stone-500">{t("ამ პერიოდში გადახდები არ არის.", "No payments in this period.")}</p>;

  return (
    <div>
      <div className="relative h-48" onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-stone-200" />
        <span className="pointer-events-none absolute right-0 top-0 -translate-y-full pb-0.5 text-xs text-stone-500">{formatGel(max, lang)}</span>
        <div className="absolute inset-x-0 bottom-0 border-t border-stone-200" />
        <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden="true">
          {days.map((day, index) => {
            const height = max > 0 ? (Number(day.paid_total) / max) * 100 : 0;
            return (
              <div key={day.day} className="relative flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(index)} onTouchStart={() => setHover(index)}>
                <div className={cn("w-full rounded-t-[4px] transition-opacity", hover !== null && hover !== index && "opacity-50")}
                  style={{ height: `${height}%`, minHeight: Number(day.paid_total) > 0 ? 2 : 0, backgroundColor: BAR }} />
              </div>
            );
          })}
        </div>
        {active && hover !== null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}>
            <p className="font-semibold text-stone-900">{formatShortDate(active.day, lang, year)}</p>
            <p className="text-stone-700">{formatGel(Number(active.paid_total), lang)} · {active.visits} {t("ვიზიტი", "visits")}</p>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[11px] text-stone-500" aria-hidden="true">
        {days.map((day, index) => (
          <span key={day.day} className="min-w-0 flex-1 truncate text-center">{index % labelEvery === 0 ? formatShortDate(day.day, lang).split(" ")[0] : ""}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("გადახდილი დღეების მიხედვით", "Paid per day")}</caption>
        <thead><tr><th>{t("დღე", "Day")}</th><th>{t("გადახდილი", "Paid")}</th><th>{t("ვიზიტები", "Visits")}</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.day}><td>{day.day}</td><td>{formatGel(Number(day.paid_total), lang)}</td><td>{day.visits}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Busiest weekdays and hours. Rows Monday to Sunday, columns the hours that had visits. */
export function BusyHeatmap({ cells }: { cells: Array<{ weekday: number; hour: number; visits: number }> }) {
  const { lang, t } = useLanguage();
  const [hover, setHover] = useState<{ weekday: number; hour: number; visits: number } | null>(null);
  if (cells.length === 0) return <p className="py-8 text-center text-sm text-stone-500">{t("ვიზიტები ჯერ არ არის.", "No visits yet.")}</p>;

  const hours = cells.map((cell) => cell.hour);
  const first = Math.min(...hours, 10);
  const last = Math.max(...hours, 19);
  const columns = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const max = Math.max(...cells.map((cell) => Number(cell.visits)));
  const count = (weekday: number, hour: number) => Number(cells.find((cell) => cell.weekday === weekday && cell.hour === hour)?.visits ?? 0);
  const step = (value: number) => RAMP[Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length - 1e-9))];
  const weekdays = [1, 2, 3, 4, 5, 6, 0];
  const dayName = (weekday: number) => lang === "ka" ? KA_WEEKDAYS_SHORT[weekday] : EN_WEEKDAYS[weekday].slice(0, 3);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `2.5rem repeat(${columns.length}, minmax(1.5rem, 1fr))` }} onMouseLeave={() => setHover(null)}>
          <span />
          {columns.map((hour) => <span key={hour} className="text-center text-[11px] text-stone-500">{hour}</span>)}
          {weekdays.map((weekday) => (
            <React.Fragment key={weekday}>
              <span className="flex items-center text-xs text-stone-600">{dayName(weekday)}</span>
              {columns.map((hour) => {
                const value = count(weekday, hour);
                return (
                  <span key={hour} className="h-7 rounded-[4px]" style={{ backgroundColor: value > 0 ? step(value) : "#f5f5f4" }}
                    onMouseEnter={() => setHover({ weekday, hour, visits: value })} onTouchStart={() => setHover({ weekday, hour, visits: value })}
                    aria-label={`${dayName(weekday)} ${hour}:00, ${value}`} />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <p className="min-h-5 text-stone-700" aria-live="polite">
          {hover ? t(`${dayName(hover.weekday)} ${hover.hour}:00 · ${hover.visits} ვიზიტი`, `${dayName(hover.weekday)} ${hover.hour}:00 · ${hover.visits} visits`) : t("მიიტანეთ ან შეეხეთ უჯრას.", "Point at or tap a cell.")}
        </p>
        <span className="flex items-center gap-1.5">
          {t("ნაკლები", "Fewer")}
          <span className="h-3 w-3 rounded-sm bg-stone-100" />
          {RAMP.map((color) => <span key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />)}
          {t("მეტი", "More")}
        </span>
      </div>
    </div>
  );
}
