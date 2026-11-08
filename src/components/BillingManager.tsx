"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, MessageSquare } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatGel, type PricePackage } from "@/lib/pricing";
import { formatShortDate } from "@/lib/dates";
import { Alert, Badge, Button, Card, CardHeader, Chip, ChipRow, Skeleton } from "@/components/ui";

type Text = { ka: string; en: string };

interface BillingData {
  subscription: { status: string; plan_code: string; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean; grace_ends_at: string | null } | null;
  invoices: Array<{ id: string; kind: string; status: string; total_gel: number; created_at: string; invoice_lines: Array<{ description: string; line_type: string }> }>;
  wallet: { included_quota: number; prepaid_balance: number; used_this_period: number } | null;
  activeStaffCount: number;
  plans: PricePackage[];
  months: number[];
  earlyBirdPercent: number;
  refund: { percent: number; withinDays: number };
  smsPack: { minimum: number; priceGel: number };
  paymentsEnabled: boolean;
}

const DISCOUNT: Record<number, number> = { 1: 0, 6: 10, 12: 20 };
const PACK_CHOICES = [1, 2, 5];

/** The last day something is active, in Tbilisi: an end at midnight belongs to the day before. */
function lastDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(new Date(iso).getTime() - 1000));
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

const STATUS: Record<string, { label: Text; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  open: { label: { ka: "გადასახდელი", en: "To pay" }, tone: "warning" },
  paid: { label: { ka: "გადახდილი", en: "Paid" }, tone: "success" },
  void: { label: { ka: "გაუქმებული", en: "Void" }, tone: "neutral" },
  failed: { label: { ka: "ვერ გადაიხადა", en: "Failed" }, tone: "danger" },
  refunded: { label: { ka: "დაბრუნებული", en: "Refunded" }, tone: "neutral" },
};

/** Plan, SMS packs and invoices for owners and admins, from 1 December. */
export default function BillingManager() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<BillingData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [months, setMonths] = useState(1);
  const [packs, setPacks] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/billing").catch(() => null);
    if (!response?.ok) { setLoadError(true); return; }
    setData(await response.json());
  }, []);

  useEffect(() => {
    void load();
    const payment = new URLSearchParams(window.location.search).get("payment");
    if (payment) setMessage(payment === "success"
      ? { tone: "success", text: t("გადახდა დასრულდა. მადლობა!", "Payment complete. Thank you!") }
      : { tone: "error", text: t("გადახდა ვერ შესრულდა. სცადეთ თავიდან.", "The payment did not go through. Please try again.") });
  }, [load, t]);

  async function act(key: string, body: object) {
    setBusy(key); setMessage(null);
    try {
      const response = await fetch("/api/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (!response.ok) setMessage({ tone: response.status === 503 ? "warning" : "error", text: String(result.error ?? t("ვერ მოხერხდა.", "Something went wrong.")) });
      await load();
    } catch {
      setMessage({ tone: "error", text: t("ქსელური შეცდომა.", "Network error.") });
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <Alert tone="error">{t("გადახდის გვერდი ვერ ჩაიტვირთა. განაახლეთ გვერდი.", "The billing page could not load. Refresh the page.")}</Alert>;
  if (!data) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;

  const sub = data.subscription;
  const current = sub?.status === "active" ? data.plans.find((pkg) => pkg.code === sub.plan_code) : undefined;
  const trialEnd = sub?.status === "trialing" && sub.trial_ends_at ? sub.trial_ends_at : null;
  const trialOver = trialEnd ? new Date(trialEnd).getTime() <= Date.now() : false;
  const year = new Date().getFullYear();
  const day = (iso: string) => formatShortDate(lastDay(iso), lang, year);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("პაკეტი და გადახდა", "Plan and billing")}</h1>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Card>
        <CardHeader title={t("თქვენი პაკეტი", "Your plan")} />
        {current ? (
          <p className="text-base text-stone-700">
            <strong className="text-stone-900">{t(current.name.ka, current.name.en)}</strong>
            {sub?.current_period_end && <> · {sub.cancel_at_period_end
              ? t(`გაუქმდება ${day(sub.current_period_end)}-ს`, `Ends on ${day(sub.current_period_end)}`)
              : t(`განახლდება ${day(sub.current_period_end)}-ს`, `Renews on ${day(sub.current_period_end)}`)}</>}
          </p>
        ) : sub?.status === "past_due" ? (
          <Alert tone="warning">{t("გადასახდელი ინვოისი გაქვთ. გადაიხადეთ ქვემოთ, რომ ანგარიში აქტიური დარჩეს.", "You have an invoice to pay. Pay it below to keep the account active.")}</Alert>
        ) : trialEnd && !trialOver ? (
          <p className="text-base text-stone-700">
            {t(`უფასო საცდელი პერიოდი: ბოლო დღე ${day(trialEnd)}, დარჩა ${daysLeft(trialEnd)} დღე.`, `Free trial: last day ${day(trialEnd)}, ${daysLeft(trialEnd)} days left.`)}{" "}
            {t("აირჩიეთ პაკეტი ქვემოთ. SMS ფასიან პაკეტზე ირთვება.", "Pick a plan below. SMS start on a paid plan.")}
          </p>
        ) : (
          <Alert tone="warning">{t("საცდელი პერიოდი დასრულდა. ანგარიში მხოლოდ სანახავადაა, მონაცემები შენახულია. აირჩიეთ პაკეტი, რომ გააგრძელოთ.", "The trial has ended. The account is view-only and your data is kept. Pick a plan to continue.")}</Alert>
        )}
      </Card>

      {!data.paymentsEnabled && (
        <Alert tone="info">{t("ბარათით გადახდა რამდენიმე დღეში ჩაირთვება. მანამდე საცდელი პერიოდი გრძელდება და ანგარიში არ დაიბლოკება.", "Card payment opens in a few days. Until then your trial continues and the account will not be locked.")}</Alert>
      )}

      <Card>
        <CardHeader title={current ? t("პაკეტის შეცვლა", "Change plan") : t("აირჩიეთ პაკეტი", "Choose a plan")}
          description={data.earlyBirdPercent > 0 ? t(`დეკემბრის შეთავაზება: პირველ გადახდაზე -${data.earlyBirdPercent}%.`, `December offer: ${data.earlyBirdPercent}% off your first payment.`) : undefined} />
        <ChipRow className="mb-4">
          {data.months.map((value) => (
            <Chip key={value} selected={months === value} onClick={() => setMonths(value)}>
              {value === 1 ? t("თვიურად", "Monthly") : t(`${value} თვე`, `${value} months`)}{DISCOUNT[value] ? ` −${DISCOUNT[value]}%` : ""}
            </Chip>
          ))}
        </ChipRow>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.plans.map((pkg) => {
            const period = Math.round(pkg.monthlyGel * months * (1 - (DISCOUNT[months] ?? 0) / 100) * 100) / 100;
            const due = Math.round(period * (1 - data.earlyBirdPercent / 100) * 100) / 100;
            const tooManyStaff = data.activeStaffCount > pkg.staffLimit;
            const isCurrent = current?.code === pkg.code;
            return (
              <div key={pkg.code} className={`flex flex-col rounded-2xl border p-4 ${isCurrent ? "border-rose-300 bg-brand-soft/40" : "border-stone-200"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-stone-900">{t(pkg.name.ka, pkg.name.en)}</h3>
                  {isCurrent && <Badge tone="brand">{t("მიმდინარე", "Current")}</Badge>}
                </div>
                <p className="text-sm text-stone-500">{t(pkg.forWho.ka, pkg.forWho.en)}</p>
                <p className="mt-3 text-3xl font-black text-stone-900">{formatGel(pkg.monthlyGel)} ₾<span className="text-base font-medium text-stone-500"> {t("თვეში", "a month")}</span></p>
                <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{pkg.code === "solo"
                    ? t("1 სპეციალისტი", "1 specialist")
                    : t(`${pkg.staffIncluded} სპეციალისტი, დამატებითი ${pkg.extraStaffGel} ₾`, `${pkg.staffIncluded} specialists, extra ${pkg.extraStaffGel} ₾ each`)}</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{t(`${formatGel(pkg.smsIncluded)} SMS თვეში`, `${formatGel(pkg.smsIncluded)} SMS a month`)}</li>
                </ul>
                <p className="mt-4 text-sm text-stone-600">
                  {months === 1 ? t("გადასახდელი ახლა", "Due now") : t(`${months} თვე ერთად`, `${months} months at once`)}:{" "}
                  {due !== period && <span className="mr-1 text-stone-400 line-through">{formatGel(period)} ₾</span>}
                  <strong className="text-stone-900">{formatGel(due)} ₾</strong>
                </p>
                {tooManyStaff && <p className="mt-2 text-xs text-amber-700">{t(`ამ პაკეტში მაქსიმუმ ${pkg.staffLimit} აქტიური სპეციალისტია, თქვენ ${data.activeStaffCount} გყავთ.`, `This plan allows ${pkg.staffLimit} active specialists; you have ${data.activeStaffCount}.`)}</p>}
                <Button className="mt-4" block icon={<CreditCard className="h-4 w-4" />} loading={busy === pkg.code}
                  disabled={busy !== null || tooManyStaff || !data.paymentsEnabled}
                  onClick={() => void act(pkg.code, { action: "upgrade", plan: pkg.code, months })}>
                  {isCurrent ? t("გაგრძელება", "Renew") : t("არჩევა და გადახდა", "Choose and pay")}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-stone-500">
          {t(`თუ პირველი გადახდიდან ${data.refund.withinDays} დღეში მოგვწერთ, ${data.refund.percent}%-ს დაგიბრუნებთ.`, `Write to us within ${data.refund.withinDays} days of your first payment and we refund ${data.refund.percent}%.`)}
        </p>
      </Card>

      <Card>
        <CardHeader title={t("SMS", "SMS")} description={t("ჯერ პაკეტში შემავალი SMS იხარჯება, შემდეგ ნაყიდი. ნაყიდი SMS არ იწვება.", "Included SMS are used first, then bought ones. Bought SMS never expire.")} />
        <div className="mb-4 flex items-center gap-3 text-sm text-stone-700">
          <MessageSquare className="h-5 w-5 text-rose-600" />
          <span>{t(`ამ თვეში: ${formatGel(data.wallet?.used_this_period ?? 0)} / ${formatGel(data.wallet?.included_quota ?? 0)} · ნაყიდი: ${formatGel(data.wallet?.prepaid_balance ?? 0)}`,
            `This month: ${formatGel(data.wallet?.used_this_period ?? 0)} / ${formatGel(data.wallet?.included_quota ?? 0)} · bought: ${formatGel(data.wallet?.prepaid_balance ?? 0)}`)}</span>
        </div>
        <ChipRow className="mb-3">
          {PACK_CHOICES.map((value) => (
            <Chip key={value} selected={packs === value} onClick={() => setPacks(value)}>
              {formatGel(value * data.smsPack.minimum)} SMS · {formatGel(value * data.smsPack.minimum * data.smsPack.priceGel)} ₾
            </Chip>
          ))}
        </ChipRow>
        <Button variant="secondary" loading={busy === "sms"} disabled={busy !== null || !data.paymentsEnabled}
          onClick={() => void act("sms", { action: "buy_sms", packs })}>
          {t("SMS-ის ყიდვა", "Buy SMS")}
        </Button>
      </Card>

      <Card>
        <CardHeader title={t("ინვოისები", "Invoices")} />
        {data.invoices.length === 0 ? (
          <p className="text-sm text-stone-500">{t("ჯერ ინვოისი არ გაქვთ.", "No invoices yet.")}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.invoices.map((invoice) => {
              const status = STATUS[invoice.status] ?? STATUS.void;
              return (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="min-w-0 text-stone-700">{formatShortDate(lastDay(invoice.created_at), lang, year)} · {invoice.invoice_lines.find((line) => line.line_type !== "adjustment")?.description ?? invoice.kind}</span>
                  <span className="flex items-center gap-2">
                    <strong className="text-stone-900">{formatGel(Number(invoice.total_gel))} ₾</strong>
                    <Badge tone={status.tone}>{t(status.label.ka, status.label.en)}</Badge>
                    {invoice.status === "open" && (
                      <Button size="sm" loading={busy === invoice.id} disabled={busy !== null || !data.paymentsEnabled} onClick={() => void act(invoice.id, { action: "pay_invoice", invoiceId: invoice.id })}>
                        {t("გადახდა", "Pay")}
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {current && !sub?.cancel_at_period_end && (
        <button type="button" className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800"
          onClick={() => { if (window.confirm(t("პაკეტი გაუქმდება გადახდილი პერიოდის ბოლოს. გავაგრძელოთ?", "The plan will end at the end of the paid period. Continue?"))) void act("cancel", { action: "cancel" }); }}>
          {t("პაკეტის გაუქმება პერიოდის ბოლოს", "Cancel at the end of the period")}
        </button>
      )}
    </div>
  );
}
