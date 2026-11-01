"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Percent } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatShortDate } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { changePercent, occupancy, payout, presetPeriod, type EarningsData, type MasterNumbers, type Period, type Preset } from "@/lib/earnings";
import { Alert, Button, ButtonLink, Card, CardHeader, Chip, ChipRow, Dialog, Field, Input, Skeleton, cn, useToast } from "@/components/ui";
import { BusyHeatmap, DailyBars } from "./EarningsCharts";

type Access = "owner" | "office" | "master";
interface Loaded { period: Period; previous_period: Period; current: EarningsData; previous: EarningsData }

function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "en" && en ? en : ka;
}

/** A number tile with the change from the same number of days before. */
function Tile({ label, value, current, previous, hint }: { label: string; value: string; current?: number; previous?: number; hint?: string }) {
  const { t } = useLanguage();
  const change = current !== undefined && previous !== undefined ? changePercent(current, previous) : null;
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {change !== null ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-stone-600">
          {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />}
          {t(`${change > 0 ? "+" : ""}${change}% წინა პერიოდთან`, `${change > 0 ? "+" : ""}${change}% vs before`)}
        </p>
      ) : hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Earnings and analytics for a period: money, masters with commission and payout, clients, top
 * services and the busiest hours. Owners see everything, admins only when the owner allows it,
 * masters their own numbers.
 */
export default function EarningsView({ access, today, adminsSeeEarnings }: { access: Access; today: string; adminsSeeEarnings: boolean }) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>("last30");
  const [custom, setCustom] = useState<Period>(presetPeriod("last30", today));
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateFor, setRateFor] = useState<MasterNumbers | null>(null);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareWithAdmins, setShareWithAdmins] = useState(adminsSeeEarnings);
  const period = preset === "custom" ? custom : presetPeriod(preset, today);
  const year = Number(today.slice(0, 4));

  const load = useCallback(async (range: Period) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/earnings?from=${range.from}&to=${range.to}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(result.error ?? "Error"));
      setData(result as Loaded);
    } catch (caught) {
      setError(localMessage(caught instanceof Error ? caught.message : "Error", lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  const periodKey = `${period.from}|${period.to}`;
  useEffect(() => {
    const [from, to] = periodKey.split("|");
    if (from <= to) void load({ from, to });
  }, [periodKey, load]);

  async function saveRate() {
    if (!rateFor) return;
    const value = Number(rate.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 100) { toast.error(t("პროცენტი 0-დან 100-მდე.", "Use a percent from 0 to 100.")); return; }
    setBusy(true);
    const response = await fetch("/api/earnings/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: rateFor.staff_id, commission_percent: value }) });
    setBusy(false);
    if (!response.ok) { toast.error(localMessage(String((await response.json().catch(() => ({}))).error ?? "Error"), lang)); return; }
    toast.success(t("საკომისიო შენახულია. მოქმედებს ახალ გადახდებზე.", "Commission saved. It applies to new payments."));
    setRateFor(null);
    void load(period);
  }

  async function toggleAdmins(next: boolean) {
    setShareWithAdmins(next);
    const response = await fetch("/api/earnings/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admins_see_earnings: next }) });
    if (!response.ok) { setShareWithAdmins(!next); toast.error(t("ცვლილება ვერ შეინახა.", "The change could not be saved.")); }
  }

  const presets: Array<{ value: Preset; label: string }> = [
    { value: "today", label: t("დღეს", "Today") },
    { value: "week", label: t("ეს კვირა", "This week") },
    { value: "month", label: t("ეს თვე", "This month") },
    { value: "last30", label: t("30 დღე", "30 days") },
    { value: "custom", label: t("სხვა", "Custom") },
  ];
  const now = data?.current;
  const before = data?.previous;
  const isMaster = access === "master";
  const me = isMaster ? now?.masters[0] : undefined;
  const averageCheck = (numbers?: EarningsData) => numbers && numbers.money.payments > 0 ? Number(numbers.money.paid_total) / numbers.money.payments : 0;
  const returning = now ? now.clients.served - now.clients.new : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{isMaster ? t("ჩემი შემოსავალი", "My earnings") : t("შემოსავალი", "Earnings")}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {formatShortDate(period.from, lang, year)}{period.to !== period.from ? ` - ${formatShortDate(period.to, lang, year)}` : ""}
            {data && ` · ${t("შედარება", "compared with")} ${formatShortDate(data.previous_period.from, lang, year)} - ${formatShortDate(data.previous_period.to, lang, year)}`}
          </p>
        </div>
        <ButtonLink href={`/api/earnings/export?from=${period.from}&to=${period.to}`} variant="secondary" prefetch={false} icon={<Download className="h-4 w-4 text-brand" />}>
          {t("გასაცემები Excel-ში", "Payouts to Excel")}
        </ButtonLink>
      </header>

      <div className="space-y-3">
        <ChipRow>{presets.map((item) => <Chip key={item.value} selected={preset === item.value} onClick={() => setPreset(item.value)}>{item.label}</Chip>)}</ChipRow>
        {preset === "custom" && <div className="grid max-w-md grid-cols-2 gap-3">
          <Field label={t("დან", "From")}>{(props) => <Input {...props} type="date" value={custom.from} max={custom.to} onChange={(event) => event.target.value && setCustom((value) => ({ ...value, from: event.target.value }))} />}</Field>
          <Field label={t("მდე", "To")}>{(props) => <Input {...props} type="date" value={custom.to} min={custom.from} max={today} onChange={(event) => event.target.value && setCustom((value) => ({ ...value, to: event.target.value }))} />}</Field>
        </div>}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading && !data && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28" />)}</div>}

      {now && before && <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
        {isMaster ? (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("მთავარი რიცხვები", "Key numbers")}>
            <Tile label={t("გასაცემი", "To receive")} value={formatGel(me ? payout(me) : 0, lang)} hint={t("საკომისიო და თიფი", "Commission and tips")} />
            <Tile label={t("საკომისიო", "Commission")} value={formatGel(me?.commission ?? 0, lang)} hint={me ? t(`${me.rate}% ახალ გადახდებზე`, `${me.rate}% on new payments`) : undefined} />
            <Tile label={t("თიფი", "Tips")} value={formatGel(Number(now.money.tips), lang)} current={Number(now.money.tips)} previous={Number(before.money.tips)} />
            <Tile label={t("ვიზიტები", "Visits")} value={String(now.visits.completed)} current={now.visits.completed} previous={before.visits.completed} />
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("მთავარი რიცხვები", "Key numbers")}>
            <Tile label={t("გადახდილი", "Paid")} value={formatGel(Number(now.money.paid_total), lang)} current={Number(now.money.paid_total)} previous={Number(before.money.paid_total)} />
            <Tile label={t("ვიზიტები", "Visits")} value={String(now.visits.completed)} current={now.visits.completed} previous={before.visits.completed} />
            <Tile label={t("საშუალო ჩეკი", "Average check")} value={formatGel(averageCheck(now), lang)} current={averageCheck(now)} previous={averageCheck(before)} />
            <Tile label={t("თიფი", "Tips")} value={formatGel(Number(now.money.tips), lang)} current={Number(now.money.tips)} previous={Number(before.money.tips)} hint={t("ეკუთვნის სპეციალისტებს", "Belongs to the specialists")} />
          </section>
        )}

        <Card>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-stone-500">{t("ნაღდი", "Cash")}</p><p className="mt-0.5 font-semibold text-stone-900">{formatGel(Number(now.money.cash), lang)}</p></div>
            <div><p className="text-stone-500">{t("ბარათი", "Card")}</p><p className="mt-0.5 font-semibold text-stone-900">{formatGel(Number(now.money.card), lang)}</p></div>
            <div><p className="text-stone-500">{t("ფასდაკლებები", "Discounts")}</p><p className="mt-0.5 font-semibold text-stone-900">{formatGel(Number(now.money.discounts), lang)}</p></div>
            <div><p className="text-stone-500">{t("ჩაწერილი ფასებით", "At booked prices")}</p><p className="mt-0.5 font-semibold text-stone-900">{formatGel(Number(now.expected_total), lang)}</p></div>
          </div>
          <p className="mt-3 text-xs text-stone-500">{t("ნაღდი და ბარათი თიფის ჩათვლით.", "Cash and card include tips.")}</p>
          {now.money.unpaid_count > 0 && <Alert tone="warning" className="mt-3">
            {t(`${now.money.unpaid_count} დასრულებული ვიზიტი გადახდის გარეშეა (${formatGel(Number(now.money.unpaid_value), lang)}).`, `${now.money.unpaid_count} done visits have no payment (${formatGel(Number(now.money.unpaid_value), lang)}).`)}
          </Alert>}
        </Card>

        {now.daily.length > 1 && <Card>
          <CardHeader title={t("გადახდილი დღეების მიხედვით", "Paid per day")} />
          <DailyBars days={now.daily} />
        </Card>}

        {!isMaster && <Card>
          <CardHeader title={t("სპეციალისტები", "Specialists")} description={t("საკომისიო ითვლება ფასდაკლების შემდეგ თანხაზე. თიფი სრულად სპეციალისტს ეკუთვნის.", "Commission is on the amount after discount. Tips go to the specialist in full.")} />
          {now.masters.length === 0 ? <p className="text-sm text-stone-500">{t("სპეციალისტები ჯერ არ არის.", "No specialists yet.")}</p> : <>
            {/* Phones and tablets: one card per specialist. Wide screens: a table. */}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
              {now.masters.map((master) => {
                const busyShare = occupancy(master);
                return (
                  <li key={master.staff_id} className="rounded-2xl border border-stone-100 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-stone-900">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: master.color ?? "#e11d48" }} /><span className="truncate">{master.full_name}</span>
                      </span>
                      <span className="text-right"><span className="block text-xs text-stone-500">{t("გასაცემი", "Payout")}</span><span className="whitespace-nowrap text-lg font-bold text-stone-900">{formatGel(payout(master), lang)}</span></span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                      <div><dt className="text-xs text-stone-500">{t("ვიზიტი", "Visits")}</dt><dd className="font-medium tabular-nums">{master.completed}</dd></div>
                      <div><dt className="text-xs text-stone-500">{t("გადახდილი", "Paid")}</dt><dd className="whitespace-nowrap font-medium tabular-nums">{formatGel(master.paid_total, lang)}</dd></div>
                      <div><dt className="text-xs text-stone-500">{t("თიფი", "Tips")}</dt><dd className="whitespace-nowrap font-medium tabular-nums">{formatGel(master.tips, lang)}</dd></div>
                      <div><dt className="text-xs text-stone-500">{t("დატვირთვა", "Busy")}</dt><dd className="font-medium tabular-nums">{busyShare === null ? "·" : `${busyShare}%`}</dd></div>
                      <div><dt className="text-xs text-stone-500">{t("არ მოვიდა", "No-shows")}</dt><dd className="font-medium tabular-nums">{master.no_show}</dd></div>
                      <div><dt className="text-xs text-stone-500">{t("საკომისიო", "Commission")}</dt><dd className="whitespace-nowrap font-medium tabular-nums">{formatGel(master.commission, lang)} <span className="text-xs text-stone-500">{master.rate}%</span></dd></div>
                    </dl>
                    {access === "owner" && <Button variant="secondary" className="mt-3 w-full" icon={<Percent className="h-4 w-4 text-brand" />}
                      onClick={() => { setRateFor(master); setRate(String(master.rate)); }}>{t("საკომისიოს შეცვლა", "Change commission")}</Button>}
                  </li>
                );
              })}
            </ul>
            <div className="hidden xl:block">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                    <th className="py-2 pr-3 font-medium">{t("სპეციალისტი", "Specialist")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("ვიზიტი", "Visits")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("გადახდილი", "Paid")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("საშ. ჩეკი", "Avg check")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("დატვირთვა", "Busy")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("არ მოვიდა", "No-shows")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("საკომისიო", "Commission")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("თიფი", "Tips")}</th>
                    <th className="py-2 pl-3 text-right font-medium">{t("გასაცემი", "Payout")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {now.masters.map((master) => {
                    const busyShare = occupancy(master);
                    return (
                      <tr key={master.staff_id}>
                        <td className="py-3 pr-3">
                          <span className="flex items-center gap-2 font-semibold text-stone-900">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: master.color ?? "#e11d48" }} />{master.full_name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{master.completed}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatGel(master.paid_total, lang)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{master.payments > 0 ? formatGel(master.paid_total / master.payments, lang) : "·"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{busyShare === null ? "·" : `${busyShare}%`}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{master.no_show}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {access === "owner"
                            ? <button type="button" onClick={() => { setRateFor(master); setRate(String(master.rate)); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-brand-strong hover:bg-brand-soft">
                                {formatGel(master.commission, lang)} <span className="text-xs font-normal text-stone-500">{master.rate}%</span>
                              </button>
                            : <>{formatGel(master.commission, lang)} <span className="text-xs text-stone-500">{master.rate}%</span></>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatGel(master.tips, lang)}</td>
                        <td className="py-3 pl-3 text-right font-semibold tabular-nums text-stone-900">{formatGel(payout(master), lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {access === "owner" && <p className="mt-3 text-xs text-stone-500">{t("შეეხეთ საკომისიოს პროცენტის შესაცვლელად. ახალი პროცენტი მოქმედებს ახალ გადახდებზე.", "Tap a commission to change the percent. The new percent applies to new payments.")}</p>}
            </div>
          </>}
        </Card>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("კლიენტები და ვიზიტები", "Clients and visits")} />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-stone-500">{t("მოემსახურა", "Clients served")}</dt><dd className="mt-0.5 text-lg font-semibold text-stone-900">{now.clients.served}</dd></div>
              <div><dt className="text-stone-500">{t("ახალი / დაბრუნებული", "New / returning")}</dt><dd className="mt-0.5 text-lg font-semibold text-stone-900">{now.clients.new} / {returning}</dd></div>
              <div><dt className="text-stone-500">{t("არ მოვიდა", "No-shows")}</dt><dd className="mt-0.5 text-lg font-semibold text-stone-900">{now.visits.no_show}{now.visits.booked > 0 ? <span className="ml-1 text-sm font-normal text-stone-500">{Math.round((now.visits.no_show / now.visits.booked) * 100)}%</span> : null}</dd></div>
              <div><dt className="text-stone-500">{t("გაუქმდა", "Canceled")}</dt><dd className="mt-0.5 text-lg font-semibold text-stone-900">{now.visits.canceled}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title={t("პოპულარული სერვისები", "Top services")} />
            {now.services.length === 0 ? <p className="text-sm text-stone-500">{t("ამ პერიოდში ვიზიტები არ არის.", "No visits in this period.")}</p> : (
              <ul className="space-y-2.5">
                {now.services.map((item) => {
                  const top = Number(now.services[0].visits) || 1;
                  return (
                    <li key={item.name} className="text-sm">
                      <div className="flex justify-between gap-3"><span className="truncate font-medium text-stone-900">{item.name || t("სერვისი", "Service")}</span><span className="shrink-0 tabular-nums text-stone-600">{item.visits} · {formatGel(Number(item.paid_total), lang)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand" style={{ width: `${(Number(item.visits) / top) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title={t("დატვირთული დღეები და საათები", "Busiest days and hours")} description={t("ვიზიტების რაოდენობა", "Number of visits")} />
          <BusyHeatmap cells={now.heatmap} />
        </Card>

        {access === "owner" && <Card>
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span>
              <span className="block font-semibold text-stone-900">{t("ადმინისტრატორებიც ხედავენ შემოსავალს", "Admins can see earnings")}</span>
              <span className="text-sm text-stone-500">{t("გამორთულზე მხოლოდ თქვენ ხედავთ ამ გვერდს.", "When off, only you see this page.")}</span>
            </span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={shareWithAdmins} onChange={(event) => void toggleAdmins(event.target.checked)} />
          </label>
        </Card>}
      </div>}

      <Dialog open={Boolean(rateFor)} onClose={() => setRateFor(null)} title={t("საკომისიო", "Commission")} description={rateFor?.full_name}
        footer={<div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setRateFor(null)}>{t("გაუქმება", "Cancel")}</Button>
          <Button size="lg" loading={busy} onClick={() => void saveRate()}>{t("შენახვა", "Save")}</Button>
        </div>}>
        <Field label={t("პროცენტი", "Percent")} hint={t("მოქმედებს ახალ გადახდებზე. ძველი გადახდები არ იცვლება.", "Applies to new payments. Past payments do not change.")}>
          {(props) => <div className="relative"><Input {...props} type="number" inputMode="decimal" min={0} max={100} step="0.5" value={rate} onChange={(event) => setRate(event.target.value)} className="pr-10" />
            <Percent className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /></div>}
        </Field>
      </Dialog>
    </div>
  );
}
