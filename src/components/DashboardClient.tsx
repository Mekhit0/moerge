"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  ArrowUpRight,
  CalendarCheck2,
  Mail,
  Sparkles,
} from "lucide-react";
import {
  Appointment,
  Client,
  Reminder,
} from "@/lib/types";
import {
  getAppointmentStatusLabel,
  getReminderStatusLabel,
  getTreatmentLabel,
  useLanguage,
} from "@/lib/i18n";

interface DashboardClientProps {
  salonName: string;
  timezone: string;
  reminderIntervalDays: number;
  dryRunMode: boolean;
  stats: {
    totalClients: number;
    activeClients: number;
    upcomingReminders: number;
    dueNowCount: number;
    sentSuccessfully: number;
    deliveredCount: number;
    failedDeliveries: number;
  };
  recentClients: Client[];
  upcomingReminders: Reminder[];
  upcomingAppointments: Appointment[];
}

export default function DashboardClient({
  salonName,
  timezone,
  reminderIntervalDays,
  dryRunMode,
  stats,
  recentClients,
  upcomingReminders,
  upcomingAppointments,
}: DashboardClientProps) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [runningWorker, setRunningWorker] = useState(false);
  const [workerBanner, setWorkerBanner] = useState<string | null>(null);

  async function handleRunDueReminders() {
    setRunningWorker(true);
    setWorkerBanner(null);
    try {
      const res = await fetch("/api/cron/process-reminders", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkerBanner(
          t(
            `შეცდომა: ${data.error || "შეხსენებების გაგზავნა ვერ მოხერხდა."}`,
            `Error: ${data.error || "Failed to process due reminders."}`
          )
        );
      } else if (data.claimedCount === 0) {
        setWorkerBanner(
          t(
            "ამჟამად გასაგზავნი შეხსენება არ არის — ყველა დაგეგმილი შეხსენება დროულად სრულდება.",
            "No due reminders waiting right now — all scheduled reminders are up to date."
          )
        );
      } else {
        setWorkerBanner(
          t(
            `დამუშავდა ${data.claimedCount} შეხსენება (${
              dryRunMode ? "სატესტო სიმულაცია" : "გაიგზავნა Resend-ით"
            }).`,
            `Processed ${data.claimedCount} due reminder(s) (${
              dryRunMode ? "Dry-Run simulated" : "Dispatched via Resend"
            }).`
          )
        );
        router.refresh();
      }
    } catch {
      setWorkerBanner(
        t(
          "შეხსენებების სერვერთან დაკავშირება ვერ მოხერხდა.",
          "Failed to reach reminder worker endpoint."
        )
      );
    } finally {
      setRunningWorker(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-rose-100 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-600">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MOERGE</span>
            <span className="text-stone-300">•</span>
            <span>{t("სალონის მართვის პანელი", "Salon Operations Overview")}</span>
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-stone-900">
            {t(
              `კეთილი იყოს თქვენი დაბრუნება — ${salonName}`,
              `Welcome back to ${salonName}`
            )}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {t(
              `დასრულებული ეპილაციის პროცედურის შემდეგ კლიენტს ავტომატურად ეგზავნება ელ-ფოსტის შეხსენება ${reminderIntervalDays} დღეში (${timezone}).`,
              `Completed epilation treatments automatically schedule an email reminder ${reminderIntervalDays} days later (${timezone}).`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunDueReminders}
            disabled={runningWorker}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {runningWorker
              ? t("მუშავდება...", "Processing...")
              : stats.dueNowCount > 0
              ? t(
                  `შეხსენებების გაგზავნა (${stats.dueNowCount})`,
                  `Process Due Reminders (${stats.dueNowCount})`
                )
              : t("შეხსენებების შემოწმება", "Check Due Reminders")}
          </button>

          <Link
            href="/book"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold transition"
          >
            {t("ონლაინ ჩაწერის გვერდი", "Public Booking Page")}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/clients?new=1"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5 text-rose-600" />
            {t("კლიენტის დამატება", "Add Client")}
          </Link>

          <Link
            href="/appointments?new=1"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm shadow-rose-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("ვიზიტის ჩაწერა", "Record Appointment")}
          </Link>
        </div>
      </div>

      {workerBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center justify-between">
          <span>{workerBanner}</span>
          <button
            type="button"
            onClick={() => setWorkerBanner(null)}
            className="text-xs font-semibold text-rose-700 underline ml-4 cursor-pointer"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      {/* 4 Key KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-rose-100/90 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t("სულ კლიენტები", "Total Clients")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-stone-900">
            {stats.totalClients}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {t(
              `${stats.activeClients} აქტიური პროფილი`,
              `${stats.activeClients} active profiles registered`
            )}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-rose-100/90 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t("დაგეგმილი შეხსენებები", "Upcoming Reminders")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-stone-900">
            {stats.upcomingReminders}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {stats.dueNowCount > 0 ? (
              <span className="text-rose-600 font-semibold">
                {t(
                  `${stats.dueNowCount} მზადაა გასაგზავნად`,
                  `${stats.dueNowCount} due for immediate dispatch`
                )}
              </span>
            ) : (
              t(
                "დაგეგმილი 21-დღიანი ელ-ფოსტის შეხსენებები",
                "Scheduled 21-day email reminders"
              )
            )}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-rose-100/90 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t("გაგზავნილი შეხსენებები", "Reminders Sent")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-stone-900">
            {stats.sentSuccessfully}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {t(
              `${stats.deliveredCount} დადასტურებულად მიწოდებული`,
              `${stats.deliveredCount} webhook-confirmed delivered`
            )}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-rose-100/90 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {t("წარუმატებელი გაგზავნა", "Failed Deliveries")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-3xl font-bold text-stone-900">
            {stats.failedDeliveries}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            <Link
              href="/email-history?status=failed"
              className="text-rose-600 hover:underline font-medium"
            >
              {t(
                "ნახვა და თავიდან გაგზავნა →",
                "Inspect & retry in Email History →"
              )}
            </Link>
          </p>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Appointments & Reminder Dates (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Upcoming Email Reminders Card */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-rose-600" />
                  {t(
                    "მომავალი 21-დღიანი ელ-ფოსტის შეხსენებები",
                    "Upcoming 21-Day Email Reminders"
                  )}
                </h3>
                <p className="text-xs text-stone-500">
                  {t(
                    "დასრულებული ეპილაციის ვიზიტებიდან დაგეგმილი ავტომატური წერილები",
                    "Scheduled emails queued from completed epilation treatments"
                  )}
                </p>
              </div>
              <Link
                href="/email-history"
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
              >
                {t("ყველას ნახვა", "View All")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingReminders.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <p className="text-sm font-medium text-stone-700">
                  {t(
                    "დაგეგმილი ელ-ფოსტის შეხსენებები არ არის",
                    "No pending email reminders scheduled"
                  )}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {t(
                    "მონიშნეთ ეპილაციის ვიზიტი დასრულებულად 21-დღიანი შეხსენების დასაგეგმად.",
                    "Mark an epilation appointment as completed to schedule a 21-day reminder."
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {upcomingReminders.map((rem) => {
                  const isDue =
                    new Date(rem.scheduled_send_at).getTime() <= Date.now();
                  return (
                    <div
                      key={rem.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-stone-900">
                            {rem.client?.full_name ?? t("კლიენტი", "Client")}
                          </span>
                          {isDue && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase">
                              {t("დღეს იგზავნება", "Due Today")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500">
                          {rem.client?.email} &bull;{" "}
                          {t("ვიზიტის თარიღი:", "Treated on")}{" "}
                          {rem.appointment?.treatment_date ?? "—"}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs font-semibold text-rose-700">
                          {t("შეხსენების თარიღი:", "Reminder Date:")}{" "}
                          {rem.scheduled_for_date}
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {t("სტატუსი:", "Status:")}{" "}
                          {getReminderStatusLabel(rem.status, lang)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming & Recent Appointments Card */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-rose-600" />
                  {t(
                    "უახლოესი და ბოლო ვიზიტები",
                    "Upcoming & Recent Appointments"
                  )}
                </h3>
                <p className="text-xs text-stone-500">
                  {t(
                    "ჩანიშნული სეანსები და მომდევნო 21-დღიანი დაბრუნების თარიღები",
                    "Scheduled sessions and next expected 21-day return dates"
                  )}
                </p>
              </div>
              <Link
                href="/appointments"
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
              >
                {t("ვიზიტების მართვა", "Manage Appointments")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <p className="text-sm font-medium text-stone-700">
                  {t(
                    "ვიზიტები ჯერ არ არის ჩაწერილი",
                    "No appointments recorded yet"
                  )}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-stone-900">
                          {appt.client?.full_name ?? t("კლიენტი", "Client")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            appt.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : appt.status === "scheduled"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {getAppointmentStatusLabel(appt.status, lang)}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {appt.service_name ||
                            getTreatmentLabel(appt.treatment_type, lang)}
                        </span>
                        {appt.price_gel !== null && appt.price_gel !== undefined && (
                          <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">
                            {appt.price_gel} ₾
                          </span>
                        )}
                        <span>&bull;</span>
                        <span>{appt.treatment_date}</span>
                        <span>•</span>
                        <span>{appt.treatment_time ? String(appt.treatment_time).slice(0, 5) : ""}</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      {appt.next_expected_date ? (
                        <div className="text-xs font-medium text-rose-700">
                          {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
                          {appt.next_expected_date}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-400">
                          {t(
                            "დაასრულეთ +21დ შეხსენებისთვის",
                            "Complete to schedule +21d reminder"
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recently Added Clients (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-600" />
                  {t("ახლახან დამატებული კლიენტები", "Recently Added Clients")}
                </h3>
                <p className="text-xs text-stone-500">
                  {t(
                    "დააჭირეთ კლიენტს პროფილისა და ისტორიის სანახავად",
                    "Click any client to inspect their profile & history"
                  )}
                </p>
              </div>
              <Link
                href="/clients"
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
              >
                {t("ყველა კლიენტი", "All Clients")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentClients.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <p className="text-sm font-medium text-stone-700">
                  {t(
                    "კლიენტები ჯერ არ არის რეგისტრირებული",
                    "No clients registered yet"
                  )}
                </p>
                <Link
                  href="/clients?new=1"
                  className="mt-2 inline-block text-xs font-semibold text-rose-600 underline"
                >
                  {t("დაამატეთ პირველი კლიენტი", "Add your first client")}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {recentClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="py-3.5 flex items-center justify-between hover:bg-rose-50/40 -mx-3 px-3 rounded-xl transition"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-stone-900 truncate">
                        {client.full_name}
                      </div>
                      <div className="text-xs text-stone-500 truncate">
                        {client.email}
                      </div>
                      {client.next_expected_appointment_date && (
                        <div className="text-[11px] text-rose-600 mt-0.5 font-medium">
                          {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
                          {client.next_expected_appointment_date}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-stone-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
