"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { smsParts } from "@/lib/sms";
import { Alert, Badge, Card, CardHeader, EmptyState, useToast } from "@/components/ui";

type ChoiceKey = "sms_reminder_24h" | "sms_reminder_2h" | "sms_booking_confirmation";
type Choices = Record<ChoiceKey, boolean>;
type Text = { ka: string; en: string };

export interface SentSms {
  id: string;
  message_type: string;
  status: string;
  error: string | null;
  scheduled_at: string;
  sms_parts: number | null;
  client_name: string | null;
}

const TYPE_LABEL: Record<string, Text> = {
  reminder_24h: { ka: "შეხსენება, დღით ადრე", en: "Reminder, a day before" },
  reminder_2h: { ka: "შეხსენება, 2 სთ-ით ადრე", en: "Reminder, 2 hours before" },
  booking_confirmation: { ka: "დადასტურება", en: "Confirmation" },
};

const STATUS: Record<string, { label: Text; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  pending: { label: { ka: "დაგეგმილი", en: "Scheduled" }, tone: "neutral" },
  processing: { label: { ka: "იგზავნება", en: "Sending" }, tone: "brand" },
  retry: { label: { ka: "იგზავნება", en: "Sending" }, tone: "brand" },
  sent: { label: { ka: "გაიგზავნა", en: "Sent" }, tone: "success" },
  delivered: { label: { ka: "მივიდა", en: "Delivered" }, tone: "success" },
  failed: { label: { ka: "ვერ მივიდა", en: "Not delivered" }, tone: "danger" },
  suppressed: { label: { ka: "არ გაიგზავნა", en: "Not sent" }, tone: "warning" },
  canceled: { label: { ka: "გაუქმდა", en: "Canceled" }, tone: "neutral" },
};

// Why a message was not sent, from the queue's reason to words a salon understands.
const REASON: Array<[string, Text]> = [
  ["paid plan", { ka: "SMS ფასიან პაკეტზე ირთვება", en: "SMS come with a paid plan" }],
  ["No SMS left", { ka: "SMS ამოიწურა", en: "No SMS left" }],
  ["already started", { ka: "ვიზიტი უკვე დაიწყო", en: "The visit had already started" }],
  ["disabled by salon", { ka: "გამორთულია პარამეტრებში", en: "Switched off in settings" }],
  ["consent", { ka: "კლიენტმა SMS არ მოისურვა", en: "The client did not want SMS" }],
  ["inactive", { ka: "პაკეტი არააქტიურია", en: "The plan is not active" }],
  ["trial has expired", { ka: "საცდელი პერიოდი დასრულდა", en: "The trial has ended" }],
  ["canceled", { ka: "ვიზიტი გაუქმდა", en: "The visit was canceled" }],
  ["rescheduled", { ka: "ვიზიტი გადაიტანეს", en: "The visit was moved" }],
];

export default function SmsSettings({ initial, wallet, smsLive, samples, sent }: {
  initial: Choices;
  wallet: { includedLeft: number; included: number; bought: number };
  /** False before 1 December, when SMS start with the paid plans. */
  smsLive: boolean;
  /** The exact text a client would get for each message, filled with sample values. */
  samples: Partial<Record<ChoiceKey, string>>;
  sent: SentSms[];
}) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [choices, setChoices] = useState<Choices>(initial);
  const [saving, setSaving] = useState<ChoiceKey | null>(null);

  async function toggle(key: ChoiceKey, value: boolean) {
    const before = choices;
    setChoices({ ...choices, [key]: value });
    setSaving(key);
    try {
      const response = await fetch("/api/settings/sms", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error();
      toast.success(t("შენახულია.", "Saved."));
    } catch {
      setChoices(before);
      toast.error(t("შენახვა ვერ მოხერხდა.", "Could not save."));
    } finally {
      setSaving(null);
    }
  }

  const options: Array<[ChoiceKey, Text, Text]> = [
    ["sms_reminder_24h", { ka: "ვიზიტამდე ერთი დღით ადრე", en: "A day before the visit" }, { ka: "ყველაზე სასარგებლო: კლიენტს ახსოვს და დროულად მოდის.", en: "The most useful one: clients remember and come on time." }],
    ["sms_reminder_2h", { ka: "ვიზიტამდე ორი საათით ადრე", en: "Two hours before the visit" }, { ka: "მეორე შეხსენება იმავე დღეს.", en: "A second reminder on the day." }],
    ["sms_booking_confirmation", { ka: "დადასტურება ჯავშნისას", en: "Confirmation when booking" }, { ka: "ჩაწერისთანავე, ჯავშნის კოდით.", en: "Right after booking, with the booking code." }],
  ];
  const reason = (error: string | null) => {
    if (!error) return null;
    const found = REASON.find(([needle]) => error.includes(needle));
    return found ? found[1][lang] : null;
  };
  const when = (iso: string) => new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tbilisi" }).format(new Date(iso));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("SMS შეხსენებები", "SMS reminders")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("კლიენტი იღებს მოკლე SMS-ს moarge-ის სახელით, სალონის სახელით ტექსტში.", "Clients get a short SMS from moarge, with your salon's name in the text.")}</p>
      </header>

      {!smsLive
        ? <Alert tone="info">{t("SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე. ბიზნესში თვეში 1 000 SMS შედის. არჩევანი შეგიძლიათ ახლავე გააკეთოთ.", "SMS reminders start on 1 December, on paid plans. Business includes 1,000 SMS a month. You can make your choices now.")}{" "}<Link href="/pricing" className="font-semibold underline">{t("ფასები", "Prices")}</Link></Alert>
        : wallet.included === 0 && wallet.bought === 0 && <Alert tone="info">{t("SMS შეხსენებები ფასიან პაკეტშია. ბიზნესში თვეში 1 000 SMS შედის.", "SMS reminders come with paid plans. Business includes 1,000 SMS a month.")}{" "}<Link href="/pricing" className="font-semibold underline">{t("ფასები", "Prices")}</Link></Alert>}

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">{t("ამ თვეში დარჩა", "Left this month")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{wallet.includedLeft}<span className="text-sm font-normal text-stone-400"> / {wallet.included}</span></p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-500">{t("ნაყიდი SMS", "Bought SMS")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{wallet.bought}</p>
        </div>
      </div>

      <Card>
        <CardHeader title={t("რა გაეგზავნოს კლიენტს", "What clients get")} description={t("SMS მიდის მხოლოდ იმ კლიენტებთან, ვინც ჯავშნისას SMS შეხსენება აირჩია.", "SMS only go to clients who chose SMS reminders when booking.")} />
        <div className="divide-y divide-stone-100">
          {options.map(([key, title, hint]) => {
            const sample = samples[key];
            const parts = sample ? smsParts(sample) : 0;
            return (
              <div key={key} className="py-4 first:pt-0 last:pb-0">
                <label className="flex min-h-11 items-center justify-between gap-4">
                  <span><span className="block font-semibold text-stone-900">{title[lang]}</span><span className="text-sm text-stone-500">{hint[lang]}</span></span>
                  <input type="checkbox" role="switch" disabled={saving === key} className="h-6 w-6 shrink-0 accent-rose-600 disabled:opacity-50"
                    checked={choices[key]} onChange={(event) => void toggle(key, event.target.checked)} />
                </label>
                {sample && choices[key] && (
                  <div className="mt-3 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-800 sm:max-w-md">
                    {sample}
                    <p className="mt-1 text-xs text-stone-500">{t(`${sample.length} სიმბოლო · ${parts} SMS`, `${sample.length} characters · ${parts} SMS`)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("გაგზავნილი SMS", "Sent SMS")} description={t("ბოლო 50 შეტყობინება.", "The last 50 messages.")} />
        {sent.length === 0
          ? <EmptyState icon={<MessageSquare />} title={t("ჯერ SMS არ გაგზავნილა", "No SMS yet")} text={t("აქ გამოჩნდება ყოველი შეხსენება და მისი სტატუსი.", "Every reminder and its status will show up here.")} />
          : <ul className="divide-y divide-stone-100">
            {sent.map((row) => {
              const status = STATUS[row.status] ?? STATUS.pending;
              const why = row.status === "suppressed" || row.status === "canceled" || row.status === "failed" ? reason(row.error) : null;
              return (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">{row.client_name ?? t("კლიენტი", "Client")}</p>
                    <p className="text-sm text-stone-500">{(TYPE_LABEL[row.message_type] ?? { ka: row.message_type, en: row.message_type })[lang]} · {when(row.scheduled_at)}</p>
                    {why && <p className="text-xs text-stone-500">{why}</p>}
                  </div>
                  <Badge tone={status.tone}>{status.label[lang]}</Badge>
                </li>
              );
            })}
          </ul>}
      </Card>
    </div>
  );
}
