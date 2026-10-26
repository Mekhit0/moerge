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
  Clock,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Settings,
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
import MoargeLogo from "./MoargeLogo";

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
  const [copiedBookingUrl, setCopiedBookingUrl] = useState(false);

  function handleCopyBookingUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/book`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedBookingUrl(true);
      setTimeout(() => setCopiedBookingUrl(false), 2500);
    }
  }

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
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Top Banner / Salon Greeting Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-rose-100 shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MoargeLogo variant="icon" size="xs" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600">
              moarge SALON SUITE
            </span>
            <span className="text-stone-300">•</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t("სისტემა გამართულია", "System Online")}
            </span>
            <span className="text-stone-300">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
              <Clock className="w-3 h-3 text-rose-600" />
              {timezone}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            {salonName}
          </h2>

          <p className="text-xs sm:text-sm text-stone-500 max-w-2xl leading-relaxed">
            {t(
              `სალონის მართვის, ონლაინ ჯავშნებისა და ავტომატური შეხსენებების ცენტრი. კლიენტებს მომდევნო ვიზიტის შეხსენება მისდით პროცედურის ვადის დადგომამდე 1 დღით ადრე (${reminderIntervalDays}-დღიანი ციკლით).`,
              `Salon management, online booking, and automated client retention hub. Reminders are dispatched 1 day prior to procedure renewal (${reminderIntervalDays}-day cycle).`
            )}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/appointments?new=1"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition transform active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>{t("ვიზიტის ჩაწერა", "Record Appointment")}</span>
          </Link>

          <Link
            href="/clients?new=1"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4 text-rose-600" />
            <span>{t("ახალი კლიენტი", "Add Client")}</span>
          </Link>

          <button
            type="button"
            onClick={handleCopyBookingUrl}
            className="inline-flex items-center gap-2 px-3.5 py-3 rounded-2xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 text-rose-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
            title={t("ონლაინ ჯავშნის ბმულის კოპირება", "Copy Booking URL")}
          >
            {copiedBookingUrl ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-800 font-bold">{t("დაკოპირდა!", "Copied!")}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-rose-600" />
                <span>{t("ჯავშნის ბმული (/book)", "Copy /book")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 100% Automated Background Service Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border border-emerald-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stone-900">
                {t(
                  "100% ავტომატური შეხსენებების სერვისი აქტიურია",
                  "100% Automated Reminder Dispatch Active"
                )}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                CRON WORKER
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 max-w-3xl leading-relaxed">
              {t(
                "შეხსენებები იგზავნება ფონურ რეჟიმში. სისტემა ავტომატურად უგზავნის კლიენტს წერილს პროცედურის ვადის დადგომამდე 1 დღით ადრე (დილის 09:00 საათზე). პერსონალის მხრიდან ხელით ჩარევა ან ღილაკზე დაჭერა საჭირო არ არის.",
                "Reminders run entirely in the background. Clients automatically receive follow-ups 1 day prior to their procedure due date at 09:00 AM local time. No manual intervention required."
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunDueReminders}
          disabled={runningWorker}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold border border-stone-200 transition cursor-pointer shrink-0 disabled:opacity-50"
          title={t(
            "სისტემა ავტომატურად აგზავნის შეხსენებებს. ეს ღილაკი მხოლოდ ტესტირებისთვისაა.",
            "System dispatches automatically. This is for manual testing only."
          )}
        >
          <Send className="w-3.5 h-3.5 text-stone-500" />
          {runningWorker
            ? t("მუშავდება...", "Checking...")
            : t("სატესტო შემოწმება", "Manual Test")}
        </button>
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

      {/* 4 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t("კლიენტების ბაზა", "Client Base")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {stats.totalClients}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {t(
                `${stats.activeClients} აქტიური თანხმობით`,
                `${stats.activeClients} active consented clients`
              )}
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t("მომავალი შეხსენებები", "Queued Reminders")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {stats.upcomingReminders}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {stats.dueNowCount > 0 ? (
                <span className="text-rose-600 font-bold">
                  {t(
                    `${stats.dueNowCount} მზადაა გასაგზავნად`,
                    `${stats.dueNowCount} due for dispatch`
                  )}
                </span>
              ) : (
                t(
                  "ავტომატურად გაიგზავნება 1 დღით ადრე",
                  "Dispatched automatically 1 day prior"
                )
              )}
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t("მიწოდებული წერილები", "Delivered Emails")}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {stats.sentSuccessfully}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {t(
                `${stats.deliveredCount} დადასტურებულია Resend-ით`,
                `${stats.deliveredCount} confirmed delivered`
              )}
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t("სისტემის რეჟიმი", "System Mode")}
            </span>
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                dryRunMode
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {dryRunMode ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-lg font-bold text-stone-900 truncate">
              {dryRunMode
                ? t("სატესტო (Dry-Run)", "Dry-Run Simulation")
                : t("აქტიური (Live Resend)", "Live Resend Mode")}
            </div>
            <p className="mt-1 text-xs text-stone-500">
              <Link
                href="/settings"
                className="text-rose-600 hover:underline font-semibold"
              >
                {t("პარამეტრების მართვა →", "Manage in Settings →")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Appointments & Reminders (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Upcoming & Recent Appointments Card */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <CalendarCheck2 className="w-5 h-5 text-rose-600" />
                  {t(
                    "უახლოესი და ბოლო ვიზიტები",
                    "Upcoming & Recent Appointments"
                  )}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t(
                    "ჩანიშნული სეანსები და მომდევნო რეკომენდებული დაბრუნების თარიღები",
                    "Scheduled sessions and next expected procedure return dates"
                  )}
                </p>
              </div>
              <Link
                href="/appointments"
                className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition"
              >
                {t("ყველა ვიზიტი", "All Appointments")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingAppointments.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <CalendarCheck2 className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">
                  {t(
                    "ვიზიტები ჯერ არ არის ჩაწერილი",
                    "No appointments recorded yet"
                  )}
                </p>
                <Link
                  href="/appointments?new=1"
                  className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("პირველი ვიზიტის ჩაწერა", "Record First Appointment")}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {upcomingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-rose-50/20 -mx-2 px-2 rounded-xl transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900">
                          {appt.client?.full_name ?? t("კლიენტი", "Client")}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
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
                      <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="font-medium text-stone-700">
                          {appt.service_name ||
                            getTreatmentLabel(appt.treatment_type, lang)}
                        </span>
                        {appt.price_gel !== null && appt.price_gel !== undefined && (
                          <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
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
                        <div className="text-xs font-semibold text-rose-700">
                          {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
                          <span>{appt.next_expected_date}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-stone-400">
                          {t(
                            "დაასრულეთ შეხსენების დასაგეგმად",
                            "Complete to schedule reminder"
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Email Reminders Card */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-rose-600" />
                  {t(
                    "დაგეგმილი ავტომატური შეხსენებები",
                    "Automated Reminders Queue"
                  )}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t(
                    "ფონური წერილები, რომლებიც გაიგზავნება პროცედურის ვადის დადგომამდე 1 დღით ადრე",
                    "Background emails scheduled to send 1 day prior to procedure renewal"
                  )}
                </p>
              </div>
              <Link
                href="/email-history"
                className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition"
              >
                {t("მონიტორინგი", "View Queue")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingReminders.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <Mail className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">
                  {t(
                    "დაგეგმილი შეხსენებები ამჟამად არ არის",
                    "No pending reminders scheduled"
                  )}
                </p>
                <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                  {t(
                    "ვიზიტის დასრულებულად მონიშვნისთანავე სისტემა ავტომატურად დააგენერირებს მომდევნო შეხსენებას.",
                    "Completing an eligible appointment will automatically schedule the next care reminder."
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
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-rose-50/20 -mx-2 px-2 rounded-xl transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-stone-900">
                            {rem.client?.full_name ?? t("კლიენტი", "Client")}
                          </span>
                          {isDue && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase">
                              {t("დღეს იგზავნება", "Due Today")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {rem.client?.email} &bull;{" "}
                          {t("ვიზიტის თარიღი:", "Treated on")}{" "}
                          {rem.appointment?.treatment_date ?? "—"}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-xs font-bold text-rose-700">
                          {t("გაიგზავნება:", "Send Date:")}{" "}
                          <span>{rem.scheduled_for_date}</span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
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
        </div>

        {/* Column 2: Quick Salon Tools & Recent Clients (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Salon Tools Hub */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-7">
            <h3 className="text-base font-bold text-stone-900 mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-rose-600" />
              {t("სალონის სწრაფი მართვა", "Salon Quick Hub")}
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              {t("ძირითადი პარამეტრები და პირდაპირი ბმულები", "Essential settings and direct links")}
            </p>

            <div className="space-y-3 text-xs">
              {/* Online Booking Card */}
              <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">
                    {t("ონლაინ ჯავშნის გვერდი", "Online Booking Page")}
                  </span>
                  <Link
                    href="/book"
                    target="_blank"
                    className="text-rose-600 hover:text-rose-700 font-bold inline-flex items-center gap-1"
                  >
                    <span>{t("გახსნა", "View")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBookingUrl}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-rose-200 text-stone-700 font-semibold hover:bg-rose-50/50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedBookingUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">
                          {t("ბმული დაკოპირდა!", "Link Copied!")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span>{t("ბმულის კოპირება", "Copy Booking Link")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Direct Setting Shortcuts */}
              <Link
                href="/settings"
                className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:border-rose-300 hover:bg-rose-50/30 transition text-stone-800 font-semibold group"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition" />
                  <span>{t("სერვისები, ფასები და შეხსენების ციკლი", "Services, GEL Pricing & Intervals")}</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition" />
              </Link>

              <Link
                href="/email-history"
                className="flex items-center justify-between p-3.5 rounded-2xl border border-stone-200 hover:border-rose-300 hover:bg-rose-50/30 transition text-stone-800 font-semibold group"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition" />
                  <span>{t("ავტომატური შეხსენებების ისტორია & ჟურნალი", "Email Reminder Logs & Webhooks")}</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition" />
              </Link>
            </div>
          </div>

          {/* Recently Added Clients */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-rose-600" />
                  {t("ბოლო კლიენტები", "Recent Clients")}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t("დააჭირეთ კლიენტს ისტორიის სანახავად", "Click to view client history")}
                </p>
              </div>
              <Link
                href="/clients"
                className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition"
              >
                {t("ყველა კლიენტი", "All Clients")}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentClients.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-stone-50/70 border border-dashed border-stone-200">
                <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">
                  {t(
                    "კლიენტები ჯერ არ არის რეგისტრირებული",
                    "No clients registered yet"
                  )}
                </p>
                <Link
                  href="/clients?new=1"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("პირველი კლიენტის დამატება", "Add your first client")}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {recentClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="py-3 flex items-center justify-between hover:bg-rose-50/40 -mx-2 px-2 rounded-xl transition group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-stone-900 group-hover:text-rose-700 transition truncate">
                        {client.full_name}
                      </div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {client.email}
                      </div>
                      {client.next_expected_appointment_date && (
                        <div className="text-[11px] text-rose-600 mt-1 font-semibold">
                          {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
                          <span>{client.next_expected_appointment_date}</span>
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-rose-600 transition shrink-0" />
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
