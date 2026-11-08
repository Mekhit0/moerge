"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface TrialNoticeInfo {
  /** When the free period ends, already written out in both languages. */
  endsOn: { ka: string; en: string };
  endsAt: string;
  /** True before 1 December, while moarge is still free for everyone. */
  pilot: boolean;
}

/**
 * Tells owners and admins on a free period when it ends and what comes next. It can be closed;
 * it comes back if the end date changes.
 */
export default function TrialNotice({ info }: { info: TrialNoticeInfo }) {
  const { lang, t } = useLanguage();
  const storageKey = `moarge-trial-notice-${info.endsAt}`;
  const [hidden, setHidden] = useState(true);
  // In the last 3 days of a paid-era trial the notice stays, so nobody is surprised by the end.
  const urgent = !info.pilot && new Date(info.endsAt).getTime() - Date.now() < 3 * 86_400_000;

  useEffect(() => {
    try { setHidden(window.localStorage.getItem(storageKey) === "closed"); } catch { setHidden(false); }
  }, [storageKey]);

  if (hidden && !urgent) return null;
  function close() {
    setHidden(true);
    try { window.localStorage.setItem(storageKey, "closed"); } catch { /* the notice simply returns next time */ }
  }

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700 sm:p-4">
      <p className="min-w-0 flex-1 leading-relaxed">
        {info.pilot
          ? t(
            `1 დეკემბრიდან moarge ფასიანი ხდება: სოლო 19 ₾, ბიზნესი 59 ₾ თვეში. თქვენი უფასო პერიოდი სრულდება: ${info.endsOn.ka}. მონაცემები შენახული რჩება.`,
            `From 1 December moarge becomes paid: Solo 19 ₾, Business 59 ₾ a month. Your free period ends on ${info.endsOn.en}. Your data stays.`
          )
          : t(
            `თქვენი უფასო საცდელი სრულდება: ${info.endsOn.ka}. აირჩიეთ პაკეტი, რომ ანგარიში აქტიური დარჩეს. მონაცემები შენახული რჩება.`,
            `Your free trial ends on ${info.endsOn.en}. Pick a plan to keep the account active. Your data stays.`
          )}{" "}
        {info.pilot
          ? <Link href="/pricing" className="font-semibold text-rose-700 underline underline-offset-2">{t("ფასების ნახვა", "See prices")}</Link>
          : <Link href="/billing" className="font-semibold text-rose-700 underline underline-offset-2">{t("პაკეტის არჩევა", "Choose a plan")}</Link>}
      </p>
      {!urgent && <button type="button" onClick={close} aria-label={lang === "ka" ? "დახურვა" : "Close"}
        className="-m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
        <X className="h-4 w-4" />
      </button>}
    </div>
  );
}
