"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  CalendarCheck2,
  Clock,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Appointment, Client, EmailLog } from "@/lib/types";
import {
  getTreatmentLabel,
  getAppointmentStatusLabel,
  getReminderStatusLabel,
  useLanguage,
} from "@/lib/i18n";

interface ClientProfileViewProps {
  client: Client;
  appointments: Appointment[];
  emailLogs: EmailLog[];
  totalSpent: number;
  lastVisit: string | null;
}

export default function ClientProfileView({
  client,
  appointments,
  emailLogs,
  totalSpent,
  lastVisit,
}: ClientProfileViewProps) {
  const { lang, t } = useLanguage();
  const [tagsText, setTagsText] = useState((client.tags ?? []).join(", "));
  const [savingTags, setSavingTags] = useState(false);
  const [tagMessage, setTagMessage] = useState("");

  async function saveTags() {
    setSavingTags(true);
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean) }),
      });
      const result = await response.json();
      setTagMessage(response.ok ? t("თეგები შენახულია.", "Tags saved.") : result.error ?? t("შენახვა ვერ მოხერხდა.", "Could not save tags."));
    } catch { setTagMessage(t("ქსელური შეცდომა.", "Network error.")); }
    finally { setSavingTags(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-rose-600"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("კლიენტების ბაზაში დაბრუნება", "Back to Client Directory")}
        </Link>

        <Link
          href={`/appointments?new=1&clientId=${client.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          {t(
            `ვიზიტის ჩაწერა (${client.full_name})`,
            `Record Appointment for ${client.full_name}`
          )}
        </Link>
      </div>

      {/* Profile Summary Header */}
      <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-stone-900">
                {client.full_name}
              </h2>
              {client.is_archived && (
                <span className="px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 text-xs font-bold uppercase">
                  {t("არქივი", "Archived")}
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  client.email_consent && !client.unsubscribed_at
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {client.email_consent && !client.unsubscribed_at
                  ? t(
                      "ელ-ფოსტის შეხსენება აქტიურია",
                      "Email Reminders Active"
                    )
                  : t(
                      "გამოწერა გაუქმებულია",
                      "Unsubscribed from Emails"
                    )}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-rose-500" />
                {client.email}
              </span>
              {client.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {client.phone} ({t("მხოლოდ საცნობაროდ", "desk reference only")})
                </span>
              )}
            </div>

            {client.notes && (
              <p className="mt-4 p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 text-xs text-stone-700">
                <strong>{t("სალონის შენიშვნა:", "Salon Notes:")}</strong>{" "}
                {client.notes}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {(client.tags ?? []).map((tag) => <span key={tag} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">{tag}</span>)}
            </div>
            <div className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row">
              <input aria-label={t("კლიენტის თეგები", "Client tags")} value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder={t("თეგები მძიმით გამოყავით", "Separate tags with commas")} className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs" />
              <button type="button" disabled={savingTags} onClick={saveTags} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">{savingTags ? t("ინახება", "Saving") : t("თეგების შენახვა", "Save tags")}</button>
            </div>
            {tagMessage && <p aria-live="polite" className="mt-1 text-xs text-stone-500">{tagMessage}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-stone-50 p-3"><div className="text-stone-500">{t("ბოლო ვიზიტი", "Last visit")}</div><strong>{lastVisit ?? "—"}</strong></div>
              <div className="rounded-xl bg-stone-50 p-3"><div className="text-stone-500">{t("დასრულებული ვიზიტები", "Completed visits")}</div><strong>{appointments.filter((appointment) => appointment.status === "completed").length}</strong></div>
              <div className="rounded-xl bg-stone-50 p-3"><div className="text-stone-500">{t("სულ დახარჯული", "Total spent")}</div><strong>{totalSpent.toFixed(2)} ₾</strong></div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 min-w-[220px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {t("ავტომატური შეხსენების ციკლი", "Care Reminder Cycle")}
            </div>
            <div className="mt-2 text-xs text-stone-600">
              {t("ბოლო ვიზიტი:", "Last completed:")}{" "}
              <strong>{client.last_completed_epilation_date ?? "—"}</strong>
            </div>
            <div className="mt-1 text-xs text-rose-700 font-semibold">
              {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
              <strong>{client.next_expected_appointment_date ?? "—"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment History */}
      <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <CalendarCheck2 className="w-4 h-4 text-rose-600" />
          {t(
            `ვიზიტების ისტორია (${appointments.length})`,
            `Appointment History (${appointments.length})`
          )}
        </h3>

        {appointments.length === 0 ? (
          <p className="mt-4 text-xs text-stone-500">
            {t(
              "ამ კლიენტისთვის ვიზიტები ჯერ არ არის ჩაწერილი.",
              "No appointments recorded for this client yet."
            )}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-stone-100">
            {appointments.map((appt) => {
              const rem = appt.reminders?.[0];
              return (
                <div
                  key={appt.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-stone-900">
                        {appt.service_name ||
                          getTreatmentLabel(appt.treatment_type, lang)}
                      </span>
                      {appt.price_gel !== null && appt.price_gel !== undefined && (
                        <span className="text-xs px-2 py-0.5 rounded bg-rose-50 font-bold text-rose-700">
                          {appt.price_gel} ₾
                        </span>
                      )}
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
                    <div className="text-xs text-stone-500 mt-0.5">
                      {t("თარიღი:", "Date:")} {appt.treatment_date} •{" "}
                      {appt.treatment_time.slice(0, 5)}
                      {appt.notes ? ` • ${appt.notes}` : ""}
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-xs">
                    {rem ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                        <Clock className="w-3 h-3" />
                        {t("შეხსენება", "Reminder")} (
                        {getReminderStatusLabel(rem.status, lang)}):{" "}
                        {rem.scheduled_for_date}
                      </div>
                    ) : (
                      <span className="text-stone-400">
                        {t("შეხსენების გარეშე", "No reminder linked")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client Email Audit Log */}
      <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-rose-600" />
          {t(
            `ელ-ფოსტის შეხსენებების ჟურნალი (${emailLogs.length})`,
            `Email Reminder Delivery Audit (${emailLogs.length})`
          )}
        </h3>
        {emailLogs.length === 0 ? (
          <p className="mt-4 text-xs text-stone-500">
            {t(
              "ამ კლიენტისთვის ელ-ფოსტის აქტივობა ჯერ არ ფიქსირდება.",
              "No email activity logged for this client yet."
            )}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-stone-100 text-xs">
            {emailLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold uppercase text-rose-700">
                    {log.event_type}
                  </span>{" "}
                  &bull; {log.subject}
                  {log.error_message && (
                    <div className="text-red-600 mt-0.5">
                      {t("მიზეზი:", "Reason:")} {log.error_message}
                    </div>
                  )}
                </div>
                <div className="text-stone-400">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
