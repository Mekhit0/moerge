"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Plus, Scissors, Users } from "lucide-react";
import { AppointmentStatus } from "@/lib/types";
import { getAppointmentStatusLabel, useLanguage } from "@/lib/i18n";

interface DashboardClientProps {
  salonName: string;
  timezone: string;
  stats: { activeClients: number; upcomingAppointments: number; upcomingReminders: number };
  recentClients: Array<{ id: string; full_name: string }>;
  upcomingReminders: DashboardReminder[];
  upcomingAppointments: DashboardAppointment[];
}

export type DashboardAppointment = {
  id: string;
  client?: { full_name: string } | null;
  staff?: { full_name: string } | null;
  treatment_type: string;
  service_name?: string | null;
  treatment_date: string;
  treatment_time: string;
  status: AppointmentStatus;
};

export type DashboardReminder = {
  id: string;
  scheduled_for_date: string;
  client?: { full_name: string; email: string | null } | null;
};

const quickLinks = [
  { href: "/appointments", ka: "ვიზიტები", en: "Appointments", icon: CalendarDays },
  { href: "/clients", ka: "კლიენტები", en: "Clients", icon: Users },
  { href: "/settings/staff", ka: "სპეციალისტები", en: "Specialists", icon: Users },
  { href: "/settings/services", ka: "სერვისები", en: "Services", icon: Scissors },
  { href: "/settings/schedules", ka: "გრაფიკი", en: "Schedules", icon: Clock3 },
];

export default function DashboardClient({ salonName, timezone, stats, recentClients, upcomingReminders, upcomingAppointments }: DashboardClientProps) {
  const { lang, t } = useLanguage();
  const dateFormat = new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-US", {
    timeZone: timezone || "Asia/Tbilisi", weekday: "long", day: "numeric", month: "long",
  });

  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-stone-500">{dateFormat.format(new Date())}</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">{salonName}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("დღევანდელი საქმე და უახლოესი ვიზიტები", "Today’s work and upcoming visits")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/appointments?new=1" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"><Plus className="h-4 w-4" />{t("ვიზიტის ჩაწერა", "Add appointment")}</Link>
        <Link href="/clients?new=1" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"><Plus className="h-4 w-4" />{t("კლიენტის დამატება", "Add client")}</Link>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-3" aria-label={t("მოკლე მიმოხილვა", "Overview")}>
      <StatCard label={t("აქტიური კლიენტები", "Active clients")} value={stats.activeClients} icon={<Users className="h-5 w-5" />} />
      <StatCard label={t("უახლოესი ვიზიტები", "Upcoming appointments")} value={stats.upcomingAppointments} icon={<CalendarDays className="h-5 w-5" />} />
      <StatCard label={t("დაგეგმილი შეხსენებები", "Scheduled reminders")} value={stats.upcomingReminders} icon={<Clock3 className="h-5 w-5" />} />
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900">{t("უახლოესი ვიზიტები", "Upcoming appointments")}</h2>
          <Link href="/appointments" className="text-sm font-medium text-rose-700 hover:underline">{t("ყველას ნახვა", "View all")}</Link>
        </div>
        {upcomingAppointments.length ? <ul className="divide-y divide-stone-100">
          {upcomingAppointments.map((appointment) => <li key={appointment.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">{appointment.client?.full_name ?? t("კლიენტი", "Client")}</p>
              <p className="mt-0.5 truncate text-xs text-stone-500">{appointment.service_name || appointment.treatment_type}{appointment.staff?.full_name ? ` · ${appointment.staff.full_name}` : ""}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-stone-700">{appointment.treatment_date}</p>
              <p className="text-xs text-stone-500">{appointment.treatment_time ? String(appointment.treatment_time).slice(0, 5) : ""} · {getAppointmentStatusLabel(appointment.status, lang)}</p>
            </div>
          </li>)}
        </ul> : <Empty text={t("ვიზიტები ჯერ არ არის ჩანიშნული.", "No appointments are scheduled yet.")} />}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900">{t("მომავალი შეხსენებები", "Upcoming reminders")}</h2>
          <Link href="/email-history" className="text-sm font-medium text-rose-700 hover:underline">{t("ისტორია", "History")}</Link>
        </div>
        {upcomingReminders.length ? <ul className="divide-y divide-stone-100">
          {upcomingReminders.map((reminder) => <li key={reminder.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">{reminder.client?.full_name ?? t("კლიენტი", "Client")}</p>
              <p className="mt-0.5 truncate text-xs text-stone-500">{reminder.client?.email ?? ""}</p>
            </div>
            <p className="shrink-0 text-sm text-stone-600">{reminder.scheduled_for_date}</p>
          </li>)}
        </ul> : <Empty text={t("შეხსენებები ავტომატურად გამოჩნდება დასრულებული ვიზიტების შემდეგ.", "Reminders will appear here after eligible visits are completed.")} />}
      </div>
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold text-stone-900">{t("სწრაფი გადასვლა", "Quick links")}</h2>
      <nav className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label={t("სწრაფი გადასვლა", "Quick links")}>
        {quickLinks.map(({ href, ka, en, icon: Icon }) => <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-medium text-stone-700 hover:border-rose-300 hover:bg-rose-50"><Icon className="h-4 w-4 text-rose-600" />{t(ka, en)}</Link>)}
      </nav>
      {!!recentClients.length && <p className="mt-3 text-xs text-stone-500">{t(`ბოლო დამატებული კლიენტი: ${recentClients[0].full_name}`, `Most recently added client: ${recentClients[0].full_name}`)}</p>}
    </section>
  </main>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: import("react").ReactNode }) {
  return <article className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
    <div><p className="text-xs font-medium text-stone-500">{label}</p><p className="mt-1 text-2xl font-bold text-stone-900">{value}</p></div>
    <span className="rounded-xl bg-rose-50 p-3 text-rose-700">{icon}</span>
  </article>;
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-stone-500">{text}</p>;
}
