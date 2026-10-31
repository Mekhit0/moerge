"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Bell, CalendarDays, Check, Copy, Download, ExternalLink, Phone, Plus, UserPlus, Wallet } from "lucide-react";
import { AppointmentStatus } from "@/lib/types";
import { getAppointmentStatusLabel, useLanguage } from "@/lib/i18n";

export type DashboardAppointment = {
  id: string;
  client?: { id: string; full_name: string; phone?: string | null } | null;
  staff?: { id: string; full_name: string; color?: string | null } | null;
  treatment_type: string;
  service_name?: string | null;
  treatment_date: string;
  treatment_time: string;
  starts_at: string;
  status: AppointmentStatus;
  price_gel?: number | null;
};

interface DashboardClientProps {
  salonName: string;
  staffName: string;
  timezone: string;
  bookingUrl: string;
  canManage: boolean;
  todayAppointments: DashboardAppointment[];
  upcomingAppointments: DashboardAppointment[];
  scheduledReminders: number;
  setup: { services: boolean; staff: boolean; workingHours: boolean; firstBooking: boolean };
}

const NOT_EARNING: AppointmentStatus[] = ["canceled", "no_show", "missed"];

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-rose-50 text-rose-700",
  arrived: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-50 text-red-700",
  missed: "bg-red-50 text-red-700",
  canceled: "bg-stone-100 text-stone-500",
};

export default function DashboardClient({
  salonName,
  staffName,
  timezone,
  bookingUrl,
  canManage,
  todayAppointments,
  upcomingAppointments,
  scheduledReminders,
  setup,
}: DashboardClientProps) {
  const { lang, t } = useLanguage();
  const locale = lang === "ka" ? "ka-GE" : "en-US";
  // Set after mount so server and browser render the same markup.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const timeOf = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const dayOf = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
  const money = (value: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ₾`;

  const active = todayAppointments.filter((item) => !NOT_EARNING.includes(item.status));
  const remaining = now === null ? null : active.filter((item) => item.status === "scheduled" && new Date(item.starts_at).getTime() >= now).length;
  const expectedIncome = active.reduce((sum, item) => sum + Number(item.price_gel ?? 0), 0);
  const nextId = now === null ? null : active.find((item) => item.status === "scheduled" && new Date(item.starts_at).getTime() >= now)?.id;
  const firstName = staffName.split(" ")[0] || staffName;

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
        <p className="text-sm font-medium capitalize text-rose-600">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">{t(`გამარჯობა, ${firstName}`, `Hello, ${firstName}`)}</h1>
        <p className="mt-1 text-sm text-stone-500">{salonName}</p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Link href="/appointments?new=1" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-base font-semibold text-white shadow-sm hover:bg-rose-700 sm:flex-none">
          <Plus className="h-5 w-5" />{t("ახალი ჯავშანი", "New booking")}
        </Link>
        <Link href="/clients?new=1" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 text-base font-semibold text-stone-700 hover:bg-stone-50 sm:flex-none">
          <UserPlus className="h-5 w-5 text-rose-500" />{t("ახალი კლიენტი", "New client")}
        </Link>
      </div>
    </header>

    {canManage && doneCount < setupSteps.length && (
      <section className="rounded-2xl border border-rose-200 bg-white p-5" aria-label={t("სალონის მომზადება", "Salon setup")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900">{t("სალონის მომზადება", "Get your salon ready")}</h2>
          <span className="text-sm font-medium text-stone-500">{doneCount} / {setupSteps.length}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-50">
          <div className="h-full rounded-full bg-rose-600 transition-all" style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {setupSteps.map((step) => <li key={step.href}>
            {step.done ? (
              <div className="flex min-h-12 items-center gap-3 rounded-xl bg-emerald-50 px-4 text-sm text-emerald-800">
                <Check className="h-5 w-5 shrink-0" /><span className="line-through decoration-emerald-300">{step.label}</span>
              </div>
            ) : (
              <Link href={step.href} className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-800 hover:border-rose-300 hover:bg-rose-50">
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-rose-300" />{step.label}
              </Link>
            )}
          </li>)}
        </ol>
      </section>
    )}

    <section className={`grid gap-3 ${canManage ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} aria-label={t("დღის მიმოხილვა", "Today at a glance")}>
      <StatCard
        label={t("დღევანდელი ვიზიტები", "Visits today")}
        value={String(active.length)}
        hint={remaining === null ? undefined : t(`დარჩენილია ${remaining}`, `${remaining} still to come`)}
        icon={<CalendarDays className="h-5 w-5" />}
      />
      {canManage && <StatCard
        label={t("დღის სავარაუდო შემოსავალი", "Expected income today")}
        value={money(expectedIncome)}
        hint={t("ჩაწერილი ვიზიტების ფასებით", "Based on booked visit prices")}
        icon={<Wallet className="h-5 w-5" />}
      />}
      <StatCard
        label={t("დაგეგმილი შეხსენებები", "Reminders planned")}
        value={String(scheduledReminders)}
        hint={t("გაიგზავნება ავტომატურად", "Sent automatically")}
        icon={<Bell className="h-5 w-5" />}
      />
    </section>

    <section className="grid gap-5 lg:grid-cols-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-900">{t("დღის განრიგი", "Today's schedule")}</h2>
          <Link href="/appointments" className="text-sm font-medium text-rose-700 hover:underline">{t("კალენდარი", "Calendar")}</Link>
        </div>
        {todayAppointments.length ? <ul className="space-y-2">
          {todayAppointments.map((appointment) => {
            const isPast = now !== null && appointment.status === "scheduled" && new Date(appointment.starts_at).getTime() < now;
            const isNext = appointment.id === nextId;
            const faded = isPast || NOT_EARNING.includes(appointment.status);
            return <li key={appointment.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${isNext ? "border-rose-300 bg-rose-50/60" : "border-stone-100"} ${faded ? "opacity-60" : ""}`}
              style={{ borderLeftWidth: 4, borderLeftColor: appointment.staff?.color || "#e11d48" }}>
              <div className="w-14 shrink-0 text-center">
                <p className="text-lg font-bold text-stone-900">{timeOf(appointment.starts_at)}</p>
                {isNext && <p className="text-[11px] font-semibold text-rose-600">{t("შემდეგი", "Next")}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{appointment.client?.full_name ?? t("კლიენტი", "Client")}</p>
                <p className="truncate text-sm text-stone-500">
                  {appointment.service_name || appointment.treatment_type}
                  {appointment.staff?.full_name ? ` · ${appointment.staff.full_name}` : ""}
                </p>
              </div>
              {appointment.client?.phone && (
                <a href={`tel:${appointment.client.phone}`} aria-label={t("დარეკვა", "Call")} className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-rose-50 hover:text-rose-700 sm:inline-flex">
                  <Phone className="h-4 w-4" />
                </a>
              )}
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[appointment.status] ?? STATUS_STYLES.scheduled}`}>
                {getAppointmentStatusLabel(appointment.status, lang)}
              </span>
            </li>;
          })}
        </ul> : <div className="py-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-rose-200" />
          <p className="mt-3 text-sm text-stone-500">{t("დღეს ვიზიტები არ არის.", "No visits today.")}</p>
          <Link href="/appointments?new=1" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
            <Plus className="h-4 w-4" />{t("ახალი ჯავშანი", "New booking")}
          </Link>
        </div>}
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-stone-900">{t("მომდევნო ვიზიტები", "Coming up")}</h2>
          {upcomingAppointments.length ? <ul className="divide-y divide-stone-100">
            {upcomingAppointments.map((appointment) => <li key={appointment.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{appointment.client?.full_name ?? t("კლიენტი", "Client")}</p>
                <p className="truncate text-xs text-stone-500">{appointment.service_name || appointment.treatment_type}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-stone-600">
                <p className="font-medium">{dayOf(appointment.starts_at)}</p>
                <p>{timeOf(appointment.starts_at)}</p>
              </div>
            </li>)}
          </ul> : <p className="py-4 text-sm text-stone-500">{t("მომავალი ვიზიტები ჯერ არ არის.", "No upcoming visits yet.")}</p>}
        </div>

        <BookingLinkCard bookingUrl={bookingUrl} />
      </div>
    </section>
  </div>;
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

  return <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
    <h2 className="font-semibold text-stone-900">{t("ონლაინ ჩაწერა", "Online booking")}</h2>
    <p className="mt-1 text-sm text-stone-600">{t("გაუზიარეთ ბმული Instagram-ზე ან Facebook-ზე, ან დაბეჭდეთ QR კოდი სალონისთვის.", "Share the link on Instagram or Facebook, or print the QR code for your salon.")}</p>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <button type="button" onClick={copy} className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-rose-50">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-rose-500" />}
        {copied ? t("დაკოპირდა", "Copied") : t("კოპირება", "Copy")}
      </button>
      <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-rose-50">
        <ExternalLink className="h-4 w-4 text-rose-500" />{t("გახსნა", "Open")}
      </a>
      <a href={qrDataUrl || undefined} download="moarge-qr.png" aria-disabled={!qrDataUrl} className="inline-flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700 hover:bg-rose-50">
        <Download className="h-4 w-4 text-rose-500" />{t("QR კოდი", "QR code")}
      </a>
    </div>
  </div>;
}

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: React.ReactNode }) {
  return <article className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
    <div className="min-w-0">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
    <span className="shrink-0 rounded-xl bg-rose-50 p-3 text-rose-700">{icon}</span>
  </article>;
}
