"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import { Button } from "@/components/ui";

export default function SmsOptout({ code, salonName, alreadyStopped }: { code: string; salonName: string; alreadyStopped: boolean }) {
  const { t } = useLanguage();
  const [done, setDone] = useState(alreadyStopped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function stop() {
    setBusy(true); setError(false);
    const response = await fetch("/api/public/sms-optout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    setBusy(false);
    if (response?.ok) setDone(true); else setError(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <div className="flex justify-center"><MoargeLogo size="md" variant="icon" /></div>
        {done ? (
          <>
            <CheckCircle2 className="mx-auto mt-5 h-10 w-10 text-emerald-600" />
            <h1 className="mt-3 text-xl font-bold text-stone-900">{t("შეთავაზებები გამოირთო", "Offers are off")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{t(`სარეკლამო SMS აღარ მოგივათ. სალონი: ${salonName}. ვიზიტის შეხსენებები ჩვეულებრივ მოვა.`, `You won't get offer SMS from ${salonName}. Visit reminders still arrive as usual.`)}</p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-bold text-stone-900">{t("სარეკლამო SMS-ის შეწყვეტა", "Stop offer SMS")}</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{t(`აღარ გსურთ შეთავაზებები და დაბრუნების შეხსენებები? სალონი: ${salonName}.`, `Stop offers and come-back reminders from ${salonName}?`)}</p>
            <Button size="lg" block className="mt-5" loading={busy} onClick={() => void stop()}>{t("შეწყვეტა", "Stop")}</Button>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{t("ვერ მოხერხდა. სცადეთ ცოტა ხანში.", "That didn't work. Try again in a moment.")}</p>}
            <p className="mt-4 text-xs text-stone-500">{t("ვიზიტის შეხსენებები ამით არ ჩერდება.", "This doesn't stop visit reminders.")}</p>
          </>
        )}
      </div>
    </main>
  );
}
