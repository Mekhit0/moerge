"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MailCheck,
  RotateCcw,
  XCircle,
  Calendar,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  EmailLog,
  Reminder,
  ReminderStatus,
  TreatmentType,
} from "@/lib/types";
import {
  getReminderStatusLabel,
  getTreatmentLabel,
  useLanguage,
} from "@/lib/i18n";

interface EmailHistoryManagerProps {
  initialReminders: Reminder[];
  initialLogs: EmailLog[];
  timezone: string;
  dryRunMode: boolean;
}

const STATUS_BADGE_CLASSES: Record<ReminderStatus, string> = {
  scheduled: "bg-amber-50 text-amber-800 border-amber-200",
  processing: "bg-sky-50 text-sky-800 border-sky-200",
  sent: "bg-indigo-50 text-indigo-800 border-indigo-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  bounced: "bg-red-100 text-red-900 border-red-300",
  failed: "bg-red-50 text-red-800 border-red-200",
  canceled: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function EmailHistoryManager({
  initialReminders,
  initialLogs,
  timezone,
  dryRunMode,
}: EmailHistoryManagerProps) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningDue, setRunningDue] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Cancel confirmation modal
  const [cancelTarget, setCancelTarget] = useState<Reminder | null>(null);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Reminder | null>(
    null
  );
  const [rescheduleDate, setRescheduleDate] = useState("");

  const filteredReminders = useMemo(() => {
    return reminders.filter((rem) => {
      if (statusFilter !== "all" && rem.status !== statusFilter) return false;
      if (dateFrom && rem.scheduled_for_date < dateFrom) return false;
      if (dateTo && rem.scheduled_for_date > dateTo) return false;
      return true;
    });
  }, [reminders, statusFilter, dateFrom, dateTo]);

  async function handleRunDueQueue() {
    setRunningDue(true);
    setToast(null);
    try {
      const res = await fetch("/api/cron/process-reminders", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text:
            data.error ||
            t(
              "შეხსენებების დამუშავება ვერ მოხერხდა.",
              "Failed to process due reminders."
            ),
        });
      } else {
        setToast({
          type: "success",
          text:
            data.claimedCount === 0
              ? t(
                  "ამჟამად გასაგზავნი შეხსენება რიგში არ არის.",
                  "No due reminders waiting in queue right now."
                )
              : t(
                  `წარმატებით დამუშავდა ${data.claimedCount} შეხსენება.`,
                  `Processed ${data.claimedCount} due reminder(s) successfully.`
                ),
        });
        const refreshed = await fetch("/api/reminders");
        const refData = await refreshed.json();
        if (refData.reminders) {
          setReminders(refData.reminders);
        }
        router.refresh();
      }
    } catch {
      setToast({
        type: "error",
        text: t(
          "ქსელური შეცდომა შეხსენებების გაშვებისას.",
          "Network error while triggering reminder worker."
        ),
      });
    } finally {
      setRunningDue(false);
    }
  }

  async function handleManualRetry(rem: Reminder) {
    setBusyId(rem.id);
    setToast(null);
    try {
      const res = await fetch(`/api/reminders/${rem.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text:
            data.error ||
            t("თავიდან გაგზავნა ვერ მოხერხდა.", "Could not retry reminder."),
        });
      } else {
        setReminders((prev) =>
          prev.map((r) =>
            r.id === rem.id ? { ...r, ...data.reminder } : r
          )
        );
        setToast({
          type: "success",
          text: t(
            `შეხსენება კლიენტისთვის (${
              rem.client?.full_name ?? "კლიენტი"
            }) დამუშავდა (${data.result?.outcome}). დუბლირებული ჩანაწერი არ შექმნილა.`,
            `Reminder for ${
              rem.client?.full_name ?? "client"
            } processed (${data.result?.outcome}). No duplicate records created.`
          ),
        });
        router.refresh();
      }
    } catch {
      setToast({
        type: "error",
        text: t(
          "ქსელური შეცდომა თავიდან გაგზავნისას.",
          "Network error during manual retry."
        ),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmCancel(rem: Reminder) {
    setBusyId(rem.id);
    try {
      const res = await fetch(`/api/reminders/${rem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          cancel_reason: "Canceled manually by staff from Email History",
        }),
      });
      const data = await res.json();
      if (res.ok && data.reminder) {
        setReminders((prev) =>
          prev.map((r) =>
            r.id === rem.id ? { ...r, ...data.reminder } : r
          )
        );
        setToast({
          type: "success",
          text: t(
            `გაუქმდა მოლოდინში მყოფი შეხსენება კლიენტისთვის: ${rem.client?.full_name}.`,
            `Canceled pending reminder for ${rem.client?.full_name}.`
          ),
        });
        router.refresh();
      } else {
        setToast({
          type: "error",
          text:
            data.error ||
            t("შეხსენების გაუქმება ვერ მოხერხდა.", "Failed to cancel reminder."),
        });
      }
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  async function handleConfirmReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleTarget) return;

    setBusyId(rescheduleTarget.id);
    try {
      const res = await fetch(`/api/reminders/${rescheduleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          scheduled_for_date: rescheduleDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.reminder) {
        setReminders((prev) =>
          prev.map((r) =>
            r.id === rescheduleTarget.id ? { ...r, ...data.reminder } : r
          )
        );
        setToast({
          type: "success",
          text: t(
            `შეხსენების თარიღი (${rescheduleTarget.client?.full_name}) გადატანილია ${rescheduleDate}-ზე.`,
            `Rescheduled reminder for ${rescheduleTarget.client?.full_name} to ${rescheduleDate}.`
          ),
        });
        setRescheduleTarget(null);
        router.refresh();
      } else {
        setToast({
          type: "error",
          text:
            data.error ||
            t(
              "თარიღის შეცვლა ვერ მოხერხდა.",
              "Failed to reschedule reminder."
            ),
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-rose-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <MailCheck className="w-6 h-6 text-rose-600" />
            {t(
              "ელ-ფოსტის შეხსენებების ისტორია და რიგი",
              "Email Reminder History & Delivery Queue"
            )}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {t(
              `აკონტროლეთ 21-დღიანი შეხსენებები, Resend-ის სტატუსები, Webhook მიწოდება და თავიდან გაგზავნის ისტორია (${timezone}).`,
              `Track scheduled 21-day reminders, Resend API acceptance, webhook delivery events, and retry history (${timezone}).`
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunDueQueue}
          disabled={runningDue}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-rose-600/20 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {runningDue
            ? t("მუშავდება...", "Running Worker...")
            : t("დროული შეხსენებების გაგზავნა", "Process Due Reminders Now")}
        </button>
      </div>

      {dryRunMode && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>
              {t(
                "ჩართულია სატესტო (Dry-Run) რეჟიმი:",
                "Development / Dry-Run Mode Active:"
              )}
            </strong>{" "}
            {t(
              "შეხსენებების გაგზავნა სიმულირდება და იწერება ჟურნალში რეალურ კლიენტებთან წერილის გაგზავნის გარეშე. რეალური გაგზავნის ჩართვა შეგიძლიათ ",
              "Processing due or retried reminders simulates email dispatch and logs full audit records without emailing real clients. You can toggle Live Mode in "
            )}
            <a href="/settings" className="underline font-semibold">
              {t("პარამეტრებში", "Settings")}
            </a>
            .
          </span>
        </div>
      )}

      {toast && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline ml-4 cursor-pointer"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      {/* Status & Date Filters */}
      <div className="bg-white p-4 rounded-2xl border border-rose-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              "all",
              "scheduled",
              "processing",
              "sent",
              "delivered",
              "bounced",
              "failed",
              "canceled",
            ] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === st
                  ? "bg-rose-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-rose-50"
              }`}
            >
              {st === "all"
                ? t("ყველა", "All")
                : getReminderStatusLabel(st, lang)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-stone-500 font-medium">
            {t("თარიღიდან:", "Scheduled From:")}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50"
          />
          <label className="text-stone-500 font-medium">
            {t("თარიღამდე:", "To:")}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="text-rose-600 font-semibold underline cursor-pointer"
            >
              {t("გასუფთავება", "Clear Dates")}
            </button>
          )}
        </div>
      </div>

      {/* Reminders Table */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden">
        {filteredReminders.length === 0 ? (
          <div className="p-12 text-center">
            <MailCheck className="w-10 h-10 text-rose-300 mx-auto" />
            <h3 className="mt-3 text-base font-semibold text-stone-800">
              {t(
                "არჩეული ფილტრით ელ-ფოსტის შეხსენებები არ მოიძებნა",
                "No email reminders match your filter"
              )}
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {t(
                "დასრულებული ეპილაციის ვიზიტები ავტომატურად აგენერირებს 21-დღიან შეხსენებებს აქ.",
                "Completed epilation appointments automatically generate 21-day reminders here."
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rose-100 bg-rose-50/40 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-6">
                    {t("კლიენტი და ელ-ფოსტა", "Client & Email")}
                  </th>
                  <th className="py-3.5 px-4">
                    {t("დაკავშირებული ვიზიტი", "Associated Appointment")}
                  </th>
                  <th className="py-3.5 px-4">
                    {t(
                      "დაგეგმილი vs გაგზავნილი თარიღი",
                      "Scheduled vs. Actual Send Date"
                    )}
                  </th>
                  <th className="py-3.5 px-4">
                    {t("სტატუსი და მიზეზი", "Status & Failure Reason")}
                  </th>
                  <th className="py-3.5 px-4">
                    {t("მცდელობები", "Retry Info")}
                  </th>
                  <th className="py-3.5 px-6 text-right">
                    {t("მოქმედება", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredReminders.map((rem) => {
                  const badgeClasses =
                    STATUS_BADGE_CLASSES[rem.status] ??
                    STATUS_BADGE_CLASSES.scheduled;
                  const canRetry =
                    (rem.status === "failed" && !rem.is_permanent_failure) ||
                    rem.status === "scheduled";
                  const canCancel = rem.status === "scheduled";
                  const canReschedule = [
                    "scheduled",
                    "failed",
                    "canceled",
                  ].includes(rem.status);

                  return (
                    <tr key={rem.id} className="hover:bg-rose-50/20 transition">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-stone-900">
                          {rem.client?.full_name ?? t("კლიენტი", "Client")}
                        </div>
                        <div className="text-xs text-stone-500">
                          {rem.client?.email}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <div className="font-medium text-stone-800">
                          {rem.appointment?.treatment_type
                            ? getTreatmentLabel(
                                rem.appointment.treatment_type,
                                lang
                              )
                            : t("ეპილაცია", "Epilation")}
                        </div>
                        <div className="text-stone-500 mt-0.5">
                          {t("ვიზიტი:", "Treated:")}{" "}
                          {rem.appointment?.treatment_date ?? "—"}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <div className="font-semibold text-stone-800">
                          {t("დაგეგმილი:", "Scheduled:")}{" "}
                          {rem.scheduled_for_date}
                        </div>
                        <div className="text-stone-500 mt-0.5">
                          {t("გაიგზავნა:", "Actual sent:")}{" "}
                          {rem.actual_sent_at
                            ? new Date(rem.actual_sent_at).toLocaleString()
                            : "—"}
                        </div>
                        {rem.delivered_at && (
                          <div className="text-emerald-700 font-medium mt-0.5">
                            {t("მიწოდებულია:", "Delivered:")}{" "}
                            {new Date(rem.delivered_at).toLocaleString()}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClasses}`}
                        >
                          {getReminderStatusLabel(rem.status, lang)}
                        </span>
                        {rem.failure_reason && (
                          <div className="mt-1.5 text-xs text-red-700 max-w-xs leading-snug">
                            {rem.failure_reason}
                          </div>
                        )}
                        {rem.cancel_reason && (
                          <div className="mt-1.5 text-xs text-stone-500 max-w-xs leading-snug">
                            {rem.cancel_reason}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs text-stone-600">
                        <div>
                          {t("მცდელობა:", "Attempts:")}{" "}
                          <strong>
                            {rem.attempt_count} / {rem.max_attempts}
                          </strong>
                        </div>
                        {rem.next_retry_at && rem.status === "scheduled" && (
                          <div className="text-amber-700 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("შემდეგი ცდა:", "Next retry:")}{" "}
                            {new Date(rem.next_retry_at).toLocaleTimeString()}
                          </div>
                        )}
                        {rem.provider_message_id && (
                          <div className="text-[11px] text-stone-400 font-mono truncate max-w-[140px] mt-0.5">
                            ID: {rem.provider_message_id}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canRetry && (
                            <button
                              type="button"
                              disabled={busyId === rem.id}
                              onClick={() => handleManualRetry(rem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                              title={
                                rem.status === "failed"
                                  ? t(
                                      "წარუმატებელი წერილის თავიდან გაგზავნა (უსაფრთხოდ)",
                                      "Retry Failed Email Safely (Idempotent)"
                                    )
                                  : t(
                                      "დაგეგმილი შეხსენების ახლავე გაგზავნა",
                                      "Send Scheduled Reminder Now"
                                    )
                              }
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {rem.status === "failed"
                                ? t("თავიდან ცდა", "Retry")
                                : t("ახლავე გაგზავნა", "Send Now")}
                            </button>
                          )}

                          {canReschedule && (
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleTarget(rem);
                                setRescheduleDate(rem.scheduled_for_date);
                              }}
                              className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-rose-700 transition cursor-pointer"
                              title={t(
                                "გაგზავნის თარიღის შეცვლა",
                                "Reschedule Send Date"
                              )}
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          )}

                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(rem)}
                              className="p-2 rounded-xl border border-stone-200 hover:bg-red-50 text-stone-600 hover:text-red-700 transition cursor-pointer"
                              title={t(
                                "მოლოდინში მყოფი შეხსენების გაუქმება",
                                "Cancel Pending Reminder"
                              )}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Event Log Stream */}
      <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">
          {t(
            `უცვლელი აუდიტის ჟურნალი და Webhook მოვლენები (${initialLogs.length})`,
            `Immutable Provider & Webhook Event Log (${initialLogs.length})`
          )}
        </h3>
        <p className="text-xs text-stone-500 mt-0.5">
          {t(
            "ცალ-ცალკე აღრიცხავს დაგეგმვას, Resend API-ს მიერ მიღებას, სატესტო სიმულაციას და რეალურ მიწოდებას/უარყოფას.",
            "Separately tracks scheduling, Resend API acceptance, dry-run simulations, and webhook delivery/bounce events."
          )}
        </p>

        {initialLogs.length === 0 ? (
          <p className="mt-4 text-xs text-stone-500">
            {t(
              "ელ-ფოსტის მოვლენები ჯერ არ არის ჩაწერილი.",
              "No email events recorded yet."
            )}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-stone-100 max-h-80 overflow-y-auto text-xs">
            {initialLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold uppercase text-[10px] mr-2">
                    {log.event_type}
                  </span>
                  <span className="font-medium text-stone-800">
                    {log.recipient_email}
                  </span>{" "}
                  <span className="text-stone-400">
                    &bull; {t("მცდელობა", "Attempt")} #{log.attempt_number}{" "}
                    &bull; Key:{" "}
                    <code className="text-[11px]">{log.idempotency_key}</code>
                  </span>
                  {log.error_message && (
                    <div className="text-red-600 mt-0.5">
                      {t("შეცდომა:", "Error:")} {log.error_message}
                    </div>
                  )}
                </div>
                <div className="text-stone-400 shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-stone-900">
              {t(
                "გავაუქმოთ მოლოდინში მყოფი შეხსენება?",
                "Cancel Pending Reminder?"
              )}
            </h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              {t(
                `ეს გააუქმებს დაგეგმილ ელ-ფოსტის შეხსენებას კლიენტისთვის ${cancelTarget.client?.full_name} (${cancelTarget.scheduled_for_date}). საჭიროების შემთხვევაში მოგვიანებით შეგიძლიათ თავიდან დაგეგმოთ.`,
                `This will cancel the scheduled reminder email for ${cancelTarget.client?.full_name} (${cancelTarget.scheduled_for_date}). You can reschedule it later if needed.`
              )}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                {t("დატოვება", "Keep Scheduled")}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCancel(cancelTarget)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {t("დიახ, გაუქმდეს", "Confirm Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-900">
                {t(
                  "შეხსენების თარიღის შეცვლა",
                  "Reschedule Reminder Date"
                )}
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {t(
                `განაახლეთ გაგზავნის თარიღი კლიენტისთვის ${rescheduleTarget.client?.full_name} დუბლირების გარეშე.`,
                `Update the scheduled send date for ${rescheduleTarget.client?.full_name} without creating a duplicate reminder.`
              )}
            </p>
            <form onSubmit={handleConfirmReschedule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("ახალი გაგზავნის თარიღი", "New Send Date")} ({timezone})
                </label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  {t("გაუქმება", "Cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {t("ახალი თარიღის შენახვა", "Save New Date")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
