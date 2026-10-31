"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Bell, CalendarDays, Check, Copy, Download, ExternalLink, Plus, UserCheck, UserPlus, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatLongDate, shortDayLabels } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { Button, ButtonLink, Card, CardHeader, EmptyState, INACTIVE_STATUSES, StatCard, StatusBadge, cn } from "@/components/ui";
import { VisitSheet, timeOfVisit } from "@/components/visits/VisitSheet";
import type { Visit } from "@/components/visits/types";

/** Kept for the dashboard page: a visit as the Today screen loads it. */
export type DashboardAppointment = Visit;

interface DashboardClientProps {
  salonName: string;
  staffName: string;
  timezone: string;
  today: string;
  bookingUrl: string;
  canManage: boolean;
  todayAppointments: Visit[];
  upcomingAppointments: Visit[];
  paidToday: { total: number; tips: number; count: number };
  scheduledReminders: number;
  setup: { services: boolean; staff: boolean; workingHours: boolean; firstBooking: boolean };
}

type SheetState = { id: string; startWith: "details" | "pay" } | null;

export default function DashboardClient({
  salonName,
  staffName,
  timezone,
  today,
  bookingUrl,
  canManage,
  todayAppointments,
  upcomingAppointments,
  paidToday,
  scheduledReminders,
  setup,
}: DashboardClientProps) {
  const { lang, t } = useLanguage();
  // Local copy so status changes show instantly; refreshed whenever the server sends new data.
  const [visits, setVisits] = useState(todayAppointments);
  const [sheet, setSheet] = useState<SheetState>(null);
  // Set after mount so server and browser render the same markup.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setVisits(todayAppointments), [todayAppointments]);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const active = visits.filter((item) => !INACTIVE_STATUSES.includes(item.status));
  const remaining = now === null ? null : active.filter((item) => item.status === "scheduled" && new Date(item.starts_at).getTime() >= now).length;
  const expectedIncome = active.reduce((sum, item) => sum + Number(item.price_gel ?? 0), 0);
  const nextId = now === null ? null : active.find((item) => item.status === "scheduled" && new Date(item.starts_at).getTime() >= now)?.id;
  const firstName = staffName.split(" ")[0] || staffName;
  const selected = useMemo(() => visits.find((visit) => visit.id === sheet?.id) ?? null, [visits, sheet]);

  function updateVisit(updated: Visit) {
    setVisits((current) => current.map((visit) => (visit.id === updated.id ? updated : visit)));
  }

  const setupSteps = [
    { done: setup.services, label: t("დაამატეთ სერვისები და ფასები", "Add services and prices"), href: "/settings/services" },
    { done: setup.staff, label: t("დაამატეთ სპეციალისტები", "Add your staff"), href: "/settings/staff" },
    { done: setup.workingHours, label: t("მიუთითეთ სამუშაო საათები", "Set working hours"), href: "/settings/schedules" },
    { done: setup.firstBooking, label: t("ჩაწერეთ პირველი ვიზიტი", "Add your first booking"), href: "/appointments?new=1" },
  ];
  const doneCount = setupSteps.filter((step) => step.done).length;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-brand">{formatLongDate(today, lang)}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">{t(`გამარჯობა, ${firstName}`, `Hello, ${firstName}`)}</h1>
        <p className="mt-1 text-sm text-stone-500">{salonName}</p>
      </div>
      {canManage && <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <ButtonLink href="/appointments?new=1" size="lg" className="flex-1 sm:flex-none" icon={<Plus className="h-5 w-5" />}>{t("ახალი ჯავშანი", "New booking")}</ButtonLink>
        <ButtonLink href="/clients?new=1" variant="secondary" size="lg" className="flex-1 sm:flex-none" icon={<UserPlus className="h-5 w-5 text-brand" />}>{t("ახალი კლიენტი", "New client")}</ButtonLink>
      </div>}
    </header>

    {canManage && doneCount < setupSteps.length && (
      <Card className="border-rose-200" aria-label={t("სალონის მომზადება", "Salon setup")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900">{t("სალონის მომზადება", "Get your salon ready")}</h2>
          <span className="text-sm font-medium text-stone-500">{doneCount} / {setupSteps.length}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {setupSteps.map((step) => <li key={step.href}>
            {step.done ? (
              <div className="flex min-h-12 items-center gap-3 rounded-xl bg-emerald-50 px-4 text-sm text-emerald-800">
                <Check className="h-5 w-5 shrink-0" /><span className="line-through decoration-emerald-300">{step.label}</span>
              </div>
            ) : (
              <Link href={step.href} className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-800 hover:border-rose-300 hover:bg-brand-soft">
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-rose-300" />{step.label}
              </Link>
            )}
          </li>)}
        </ol>
      </Card>
    )}

    <section className={cn("grid grid-cols-2 gap-3", canManage ? "xl:grid-cols-4" : "xl:grid-cols-2")} aria-label={t("დღის მიმოხილვა", "Today at a glance")}>
      <StatCard
        label={t("ვიზიტები დღეს", "Visits today")}
        value={String(active.length)}
        hint={remaining === null ? undefined : t(`დარჩენილია ${remaining}`, `${remaining} still to come`)}
        icon={<CalendarDays className="h-5 w-5" />}
      />
      {canManage && <StatCard
        label={t("გადახდილი დღეს", "Paid today")}
        value={formatGel(paidToday.total, lang)}
        hint={paidToday.tips > 0 ? t(`+ ${formatGel(paidToday.tips, lang)} თიფი`, `+ ${formatGel(paidToday.tips, lang)} tips`) : t(`${paidToday.count} გადახდა`, `${paidToday.count} payments`)}
        icon={<Wallet className="h-5 w-5" />}
      />}
      {canManage && <StatCard
        label={t("სავარაუდო დღეს", "Expected today")}
        value={formatGel(expectedIncome, lang)}
        hint={t("ჩაწერილი ფასებით", "From booked prices")}
        icon={<Wallet className="h-5 w-5" />}
      />}
      {canManage ? <StatCard
        label={t("შეხსენებები", "Reminders")}
        value={String(scheduledReminders)}
        hint={t("გაიგზავნება თავად", "Sent automatically")}
        icon={<Bell className="h-5 w-5" />}
      /> : <StatCard
        label={t("დასრულებული", "Done")}
        value={String(visits.filter((visit) => visit.status === "completed").length)}
        hint={t("დღეს", "Today")}
        icon={<Check className="h-5 w-5" />}
      />}
    </section>

    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title={t("დღის განრიგი", "Today's schedule")}
          description={visits.length ? t("შეეხეთ ვიზიტს მოქმედებებისთვის.", "Tap a visit for actions.") : undefined}
          action={<Link href="/appointments" className="text-sm font-medium text-brand-strong hover:underline">{t("კალენდარი", "Calendar")}</Link>} />
        {visits.length ? <ul className="space-y-2">
          {visits.map((visit) => {
            const isPast = now !== null && visit.status === "scheduled" && new Date(visit.starts_at).getTime() < now;
            const isNext = visit.id === nextId;
            const faded = isPast || INACTIVE_STATUSES.includes(visit.status);
            const paid = Boolean(visit.payment && !visit.payment.voided_at);
            return <li key={visit.id}
              className={cn("flex items-center gap-2 rounded-xl border bg-white pr-2 transition", isNext ? "border-rose-300 bg-brand-soft/60" : "border-stone-100", faded && "opacity-60")}
              style={{ borderLeftWidth: 4, borderLeftColor: visit.staff?.color || "#e11d48" }}>
              <button type="button" onClick={() => setSheet({ id: visit.id, startWith: "details" })}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl px-3 py-3 text-left hover:bg-stone-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                <span className="w-14 shrink-0 text-center">
                  <span className="block text-lg font-bold text-stone-900">{timeOfVisit(visit, timezone)}</span>
                  {isNext && <span className="block text-[11px] font-semibold text-brand">{t("შემდეგი", "Next")}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-stone-900">{visit.client?.full_name ?? t("კლიენტი", "Client")}</span>
                  <span className="block truncate text-sm text-stone-500">
                    {visit.service_name || visit.treatment_type}{visit.staff?.full_name ? ` · ${visit.staff.full_name}` : ""}
                  </span>
                </span>
                <span className="hidden sm:block">
                  {paid
                    ? <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">{t("გადახდილია", "Paid")}</span>
                    : <StatusBadge status={visit.status} />}
                </span>
              </button>
              <QuickAction visit={visit} paid={paid} office={canManage} onOpen={(startWith) => setSheet({ id: visit.id, startWith })} />
            </li>;
          })}
        </ul> : (
          <EmptyState icon={<CalendarDays />} title={t("დღეს ვიზიტები არ არის.", "No visits today.")}
            action={canManage ? <ButtonLink href="/appointments?new=1" icon={<Plus className="h-4 w-4" />}>{t("ახალი ჯავშანი", "New booking")}</ButtonLink> : undefined} />
        )}
      </Card>

      <div className="grid grid-cols-1 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
        <Card>
          <CardHeader title={t("მომდევნო ვიზიტები", "Coming up")} className="mb-2" />
          {upcomingAppointments.length ? <ul className="divide-y divide-stone-100">
            {upcomingAppointments.map((visit) => {
              const day = shortDayLabels(visit.treatment_date, lang);
              return <li key={visit.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{visit.client?.full_name ?? t("კლიენტი", "Client")}</p>
                  <p className="truncate text-xs text-stone-500">{visit.service_name || visit.treatment_type}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-stone-600">
                  <p className="font-medium">{day.weekday}, {day.day} {day.month}</p>
                  <p>{timeOfVisit(visit, timezone)}</p>
                </div>
              </li>;
            })}
          </ul> : <p className="py-4 text-sm text-stone-500">{t("მომავალი ვიზიტები ჯერ არ არის.", "No upcoming visits yet.")}</p>}
        </Card>

        {canManage && <BookingLinkCard bookingUrl={bookingUrl} />}
      </div>
    </section>

    <VisitSheet visit={selected} timezone={timezone} canVoid={canManage} office={canManage} startWith={sheet?.startWith ?? "details"}
      onClose={() => setSheet(null)} onUpdate={updateVisit} />
  </div>;
}

/**
 * One-tap next step on a row: Arrived for booked visits, Pay for arrived or unpaid done visits.
 * Masters do not take payment, so their arrived visits offer Done instead.
 */
function QuickAction({ visit, paid, office, onOpen }: { visit: Visit; paid: boolean; office: boolean; onOpen: (startWith: "details" | "pay") => void }) {
  const { t } = useLanguage();
  if (!office && visit.status === "arrived") {
    return <Button size="sm" className="min-h-11 shrink-0" aria-label={t("დასრულება", "Done")} icon={<Check className="h-4 w-4" />} onClick={() => onOpen("details")}>
      <span className="hidden sm:inline">{t("დასრულება", "Done")}</span>
    </Button>;
  }
  if (visit.status === "scheduled") {
    return <Button size="sm" variant="secondary" className="min-h-11 shrink-0" aria-label={t("მოვიდა", "Arrived")} icon={<UserCheck className="h-4 w-4 text-brand" />} onClick={() => onOpen("details")}>
      <span className="hidden sm:inline">{t("მოვიდა", "Arrived")}</span>
    </Button>;
  }
  if (office && (visit.status === "arrived" || visit.status === "completed") && !paid) {
    return <Button size="sm" className="min-h-11 shrink-0" aria-label={t("გადახდა", "Pay")} icon={<Wallet className="h-4 w-4" />} onClick={() => onOpen("pay")}>
      <span className="hidden sm:inline">{t("გადახდა", "Pay")}</span>
    </Button>;
  }
  return null;
}

function BookingLinkCard({ bookingUrl }: { bookingUrl: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    void QRCode.toDataURL(bookingUrl, { width: 480, margin: 2, color: { dark: "#292524", light: "#ffffff" } }).then(setQrDataUrl);
  }, [bookingUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const tile = "inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-brand-soft";
  return <Card className="border-rose-200 bg-brand-soft/50">
    <h2 className="font-semibold text-stone-900">{t("ონლაინ ჩაწერა", "Online booking")}</h2>
    <p className="mt-1 text-sm text-stone-600">{t("გაუზიარეთ ბმული Instagram-ზე ან Facebook-ზე, ან დაბეჭდეთ QR კოდი სალონისთვის.", "Share the link on Instagram or Facebook, or print the QR code for your salon.")}</p>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <button type="button" onClick={copy} className={tile}>
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-brand" />}
        {copied ? t("დაკოპირდა", "Copied") : t("კოპირება", "Copy")}
      </button>
      <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className={tile}>
        <ExternalLink className="h-4 w-4 text-brand" />{t("გახსნა", "Open")}
      </a>
      <a href={qrDataUrl || undefined} download="moarge-qr.png" aria-disabled={!qrDataUrl} className={tile}>
        <Download className="h-4 w-4 text-brand" />{t("QR კოდი", "QR code")}
      </a>
    </div>
  </Card>;
}
