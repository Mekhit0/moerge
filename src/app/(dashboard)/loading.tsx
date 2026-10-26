"use client";

import { useLanguage } from "@/lib/i18n";

export default function DashboardLoading() {
  const { t } = useLanguage();

  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t("იტვირთება", "Loading")}</span>
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-32 rounded bg-stone-200" />
        <div className="h-8 w-64 max-w-full rounded bg-stone-200" />
        <div className="h-4 w-80 max-w-full rounded bg-stone-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 animate-pulse">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="h-3 w-28 rounded bg-stone-200" />
            <div className="mt-4 h-6 w-16 rounded bg-stone-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2 animate-pulse">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="h-72 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="h-4 w-40 rounded bg-stone-200" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="h-9 rounded bg-stone-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
