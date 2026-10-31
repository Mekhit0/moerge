"use client";

import React, { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { shortDayLabels, tbilisiDate, timeToMinutes } from "@/lib/dates";
import { cn } from "./cn";

/** Swipeable row of upcoming days ("დღეს", "ხვალ", then weekday names), used for picking a date. */
export function DayChips({ value, onChange, days = 14, startOffset = 0, className }: {
  value: string; onChange: (value: string) => void; days?: number; startOffset?: number; className?: string;
}) {
  const { lang, t } = useLanguage();
  const items = useMemo(() => Array.from({ length: days }, (_, index) => {
    const offset = startOffset + index;
    const date = tbilisiDate(offset);
    const labels = shortDayLabels(date, lang);
    return {
      date,
      weekday: offset === 0 ? t("დღეს", "Today") : offset === 1 ? t("ხვალ", "Tmrw") : labels.weekday,
      day: labels.day,
      month: labels.month,
    };
  }), [days, startOffset, lang, t]);

  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}>
      {items.map((item) => {
        const selected = item.date === value;
        return (
          <button key={item.date} type="button" onClick={() => onChange(item.date)} aria-pressed={selected}
            className={cn(
              "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              selected ? "border-brand bg-brand text-white shadow-md shadow-brand/20" : "border-stone-200 bg-white text-stone-700 hover:border-rose-300"
            )}>
            <span className={cn("text-[11px] font-semibold", selected ? "text-rose-100" : "text-stone-500")}>{item.weekday}</span>
            <span className="text-xl font-bold leading-tight">{item.day}</span>
            <span className={cn("text-[11px]", selected ? "text-rose-100" : "text-stone-400")}>{item.month}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Free times as buttons, grouped into morning, afternoon and evening. */
export function TimeChips({ times, value, onChange, className }: {
  times: string[]; value: string; onChange: (value: string) => void; className?: string;
}) {
  const { t } = useLanguage();
  const groups = [
    { label: t("დილა", "Morning"), times: times.filter((time) => timeToMinutes(time) < 12 * 60) },
    { label: t("დღე", "Afternoon"), times: times.filter((time) => timeToMinutes(time) >= 12 * 60 && timeToMinutes(time) < 17 * 60) },
    { label: t("საღამო", "Evening"), times: times.filter((time) => timeToMinutes(time) >= 17 * 60) },
  ].filter((group) => group.times.length > 0);

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">{group.label}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {group.times.map((time) => (
              <button key={time} type="button" onClick={() => onChange(time)} aria-pressed={value === time}
                className={cn(
                  "min-h-12 rounded-xl border text-sm font-semibold transition active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  value === time ? "border-brand bg-brand text-white" : "border-stone-200 bg-white text-stone-800 hover:border-rose-300 hover:bg-brand-soft"
                )}>
                {time}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
