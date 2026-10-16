"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarCheck2,
  Plus,
  List,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Sparkles,
  Ban,
  UserPlus,
  Users,
  Search,
  Zap,
} from "lucide-react";
import {
  Appointment,
  AppointmentStatus,
  Client,
  CustomBookingService,
  DEFAULT_CUSTOM_SERVICES,
  TreatmentType,
} from "@/lib/types";
import { isEpilationTreatment } from "@/lib/validation";
import {
  addCalendarDays,
  evaluateSmartSlotAvailability,
  generateDynamicTimeSlots,
} from "@/lib/scheduling";
import {
  APPOINTMENT_STATUS_I18N,
  REMINDER_STATUS_I18N,
  TREATMENT_LABELS_I18N,
  useLanguage,
} from "@/lib/i18n";

interface AppointmentsManagerProps {
  initialAppointments: Appointment[];
  clients: Client[];
  reminderIntervalDays: number;
  timezone: string;
  customServices?: CustomBookingService[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  slotIntervalMinutes?: number;
}

export default function AppointmentsManager({
  initialAppointments,
  clients: initialClients,
  reminderIntervalDays,
  timezone,
  customServices = DEFAULT_CUSTOM_SERVICES,
  workingHoursStart = "10:00",
  workingHoursEnd = "20:00",
  slotIntervalMinutes = 60,
}: AppointmentsManagerProps) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calendar month navigation state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Modal state for Create / Edit / Reschedule
  const [modalOpen, setModalOpen] = useState(searchParams.get("new") === "1");
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  // Client Mode: 'existing' vs 'new' (Quick Inline Add)
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    initialClients.length === 0 ? "new" : "existing"
  );
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState(
    searchParams.get("clientId") ?? (initialClients[0]?.id || "")
  );

  // Inline New Client Fields
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("+995 ");

  const [treatmentDate, setTreatmentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [treatmentTime, setTreatmentTime] = useState("11:00");
  const [treatmentType, setTreatmentType] = useState<TreatmentType>(
    customServices[0]?.type || "laser_epilation"
  );
  const [status, setStatus] = useState<AppointmentStatus>("completed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Cancel confirmation modal
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const dynamicSlots = useMemo(
    () =>
      generateDynamicTimeSlots(
        workingHoursStart,
        workingHoursEnd,
        slotIntervalMinutes
      ),
    [workingHoursStart, workingHoursEnd, slotIntervalMinutes]
  );

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "all") return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const searchableClients = useMemo(() => {
    const active = clients.filter((c) => !c.is_archived || c.id === clientId);
    if (!clientSearch.trim()) return active;
    const q = clientSearch.toLowerCase();
    return active.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [clients, clientId, clientSearch]);

  // Smart slot availability for the date selected inside the modal
  const bookedTimesOnModalDate = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          a.treatment_date === treatmentDate &&
          (a.status === "scheduled" || a.status === "completed") &&
          (!editingAppt || a.id !== editingAppt.id)
      )
      .map((a) => String(a.treatment_time).slice(0, 5));
  }, [appointments, treatmentDate, editingAppt]);

  const modalSmartAvailability = useMemo(
    () =>
      evaluateSmartSlotAvailability(
        treatmentTime,
        bookedTimesOnModalDate,
        45,
        dynamicSlots
      ),
    [treatmentTime, bookedTimesOnModalDate, dynamicSlots]
  );

  function openNewModal(
    defaultDate?: string,
    defaultStatus: AppointmentStatus = "completed"
  ) {
    setEditingAppt(null);
    const firstActiveClient = clients.find((c) => !c.is_archived);
    setClientId(firstActiveClient?.id ?? "");
    setClientMode(firstActiveClient ? "existing" : "new");
    setClientSearch("");
    setNewClientName("");
    setNewClientEmail("");
    setNewClientPhone("+995 ");

    const targetDate = defaultDate ?? new Date().toISOString().slice(0, 10);
    setTreatmentDate(targetDate);

    // Pick first available dynamic slot on that date
    const dayBooked = appointments
      .filter(
        (a) =>
          a.treatment_date === targetDate &&
          (a.status === "scheduled" || a.status === "completed")
      )
      .map((a) => String(a.treatment_time).slice(0, 5));
    const defaultSlot = dynamicSlots[0] || "10:00";
    const check = evaluateSmartSlotAvailability(
      defaultSlot,
      dayBooked,
      45,
      dynamicSlots
    );
    setTreatmentTime(
      check.isAvailable ? defaultSlot : check.availableSlots[0] ?? defaultSlot
    );

    const firstEnabledService =
      customServices.find((s) => s.enabled !== false) || customServices[0];
    setTreatmentType(firstEnabledService?.type || "laser_epilation");
    setStatus(defaultStatus);
    setNotes("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(appt: Appointment) {
    setEditingAppt(appt);
    setClientMode("existing");
    setClientId(appt.client_id);
    setTreatmentDate(appt.treatment_date);
    setTreatmentTime(appt.treatment_time.slice(0, 5));
    setTreatmentType(appt.treatment_type);
    setStatus(appt.status);
    setNotes(appt.notes ?? "");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSaveAppointment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        treatment_date: treatmentDate,
        treatment_time: treatmentTime,
        treatment_type: treatmentType,
        status,
        notes: notes.trim() || null,
      };

      if (!editingAppt && clientMode === "new") {
        payload.new_client = {
          full_name: newClientName.trim(),
          email: newClientEmail.trim().toLowerCase(),
          phone:
            newClientPhone.trim() && newClientPhone.trim() !== "+995"
              ? newClientPhone.trim()
              : null,
          email_consent: true,
        };
      } else {
        payload.client_id = clientId;
      }

      const url = editingAppt
        ? `/api/appointments/${editingAppt.id}`
        : "/api/appointments";
      const method = editingAppt ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          lang === "ka" && data.error_ka
            ? data.error_ka
            : data.error ||
              t(
                "ვიზიტის შენახვა ვერ მოხერხდა.",
                "Could not save appointment."
              );
        setFormError(msg);
        setSubmitting(false);
        return;
      }

      if (editingAppt) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === data.appointment.id ? data.appointment : a))
        );
        setToast(
          data.reconciliation?.action === "create"
            ? t(
                `ვიზიტი განახლდა და 21-დღიანი შეხსენება დაიგეგმა ${data.reconciliation.scheduledForDate}-ისთვის.`,
                `Appointment updated and 21-day reminder scheduled for ${data.reconciliation.scheduledForDate}.`
              )
            : data.reconciliation?.action === "update_existing"
            ? t(
                `ვიზიტის თარიღი შეიცვალა და არსებული შეხსენება განახლდა ${data.reconciliation.scheduledForDate}-ზე (დუბლირების გარეშე).`,
                `Appointment rescheduled and existing reminder updated to ${data.reconciliation.scheduledForDate} (no duplicate created).`
              )
            : data.reconciliation?.action === "cancel_existing"
            ? t(
                "ვიზიტი განახლდა და მოლოდინში მყოფი შეხსენება გაუქმდა.",
                "Appointment updated and pending reminder canceled."
              )
            : t("ვიზიტი განახლდა.", "Appointment updated.")
        );
      } else {
        setAppointments((prev) => [data.appointment, ...prev]);
        if (data.appointment?.client) {
          setClients((prev) => {
            const exists = prev.some((c) => c.id === data.appointment.client.id);
            return exists ? prev : [data.appointment.client, ...prev];
          });
        }
        setToast(
          data.reminder
            ? t(
                `დასრულებული ეპილაცია ჩაიწერა! ავტომატური ელ-ფოსტის შეხსენება დაიგეგმა ${data.reminder.scheduled_for_date}-ისთვის (${reminderIntervalDays} დღის შემდეგ).`,
                `Completed epilation recorded! Automatic email reminder scheduled for ${data.reminder.scheduled_for_date} (${reminderIntervalDays} days later).`
              )
            : t("ვიზიტი წარმატებით ჩაიწერა.", "Appointment recorded.")
        );
      }

      setModalOpen(false);
      router.refresh();
    } catch {
      setFormError(
        t(
          "ქსელური შეცდომა ვიზიტის შენახვისას.",
          "Network error while saving appointment."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickStatusChange(
    appt: Appointment,
    newStatus: AppointmentStatus
  ) {
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.appointment) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appt.id ? data.appointment : a))
        );
        if (
          newStatus === "completed" &&
          isEpilationTreatment(appt.treatment_type)
        ) {
          const targetDate = addCalendarDays(
            appt.treatment_date,
            reminderIntervalDays
          );
          setToast(
            t(
              `მონიშნულია დასრულებულად! 21-დღიანი შეხსენება დაიგეგმა ${targetDate}-ისთვის.`,
              `Marked completed! 21-day email reminder automatically scheduled for ${targetDate}.`
            )
          );
        } else if (newStatus === "canceled") {
          setToast(
            t(
              "ვიზიტი გაუქმდა და შესაბამისი შეხსენებაც გაუქმდა.",
              "Appointment canceled and any pending reminder was canceled."
            )
          );
        } else {
          setToast(
            t(
              `ვიზიტის სტატუსი შეიცვალა: ${APPOINTMENT_STATUS_I18N[lang][newStatus]}`,
              `Appointment marked as ${newStatus}.`
            )
          );
        }
        router.refresh();
      }
    } finally {
      setCancelTarget(null);
    }
  }

  // Compute preview of 21-day reminder date inside modal
  const previewReminderDate = useMemo(() => {
    try {
      if (status === "completed" && isEpilationTreatment(treatmentType)) {
        return addCalendarDays(treatmentDate, reminderIntervalDays);
      }
      return null;
    } catch {
      return null;
    }
  }, [treatmentDate, treatmentType, status, reminderIntervalDays]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{
      dateStr: string | null;
      dayNumber: number | null;
      appointments: Appointment[];
      expectedReturns: Appointment[];
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        dateStr: null,
        dayNumber: null,
        appointments: [],
        expectedReturns: [],
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${mStr}-${dStr}`;

      const dayAppts = appointments.filter((a) => a.treatment_date === dateStr);
      const dayReturns = appointments.filter(
        (a) => a.status === "completed" && a.next_expected_date === dateStr
      );

      cells.push({
        dateStr,
        dayNumber: d,
        appointments: dayAppts,
        expectedReturns: dayReturns,
      });
    }

    return cells;
  }, [calendarMonth, appointments]);

  const monthLabel = new Date(
    calendarMonth.year,
    calendarMonth.month,
    1
  ).toLocaleDateString(lang === "ka" ? "ka-GE" : "en-US", {
    month: "long",
    year: "numeric",
  });

  // Build combined service options from custom salon catalog + standard treatments
  const serviceOptions = useMemo(() => {
    const list: Array<{ value: TreatmentType; label: string; isEpil: boolean }> = [];
    for (const srv of customServices) {
      if (srv.enabled === false) continue;
      const val = lang === "ka" ? srv.name_ka : srv.name_en;
      list.push({
        value: srv.type,
        label: `${val} (${srv.price_gel} ₾ • ${srv.duration_minutes} ${t("წთ", "min")})`,
        isEpil: srv.is_epilation,
      });
    }
    const standardKeys = Object.keys(
      TREATMENT_LABELS_I18N[lang]
    ) as TreatmentType[];
    for (const k of standardKeys) {
      if (!list.some((item) => item.value === k)) {
        list.push({
          value: k,
          label: TREATMENT_LABELS_I18N[lang][k],
          isEpil: isEpilationTreatment(k),
        });
      }
    }
    return list;
  }, [customServices, lang, t]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-rose-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <CalendarCheck2 className="w-6 h-6 text-rose-600" />
            {t(
              "ვიზიტები და სწრაფი ჯავშნის მართვა",
              "Appointments & Quick Salon Booking"
            )}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {t(
              `სწრაფად ჩაწერეთ არსებული ან ახალი კლიენტი. დასრულებულ ეპილაციაზე ავტომატურად იგეგმება შეხსენება ${reminderIntervalDays} დღეში (${timezone}).`,
              `Quickly book existing or new walk-in clients. Completed epilation sessions automatically schedule a reminder ${reminderIntervalDays} days later (${timezone}).`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-stone-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-stone-600"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              {t("სია", "List")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-stone-600"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {t("კალენდარი", "Calendar")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => openNewModal(undefined, "scheduled")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold transition cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            {t("მომავალი ჯავშანი", "Schedule Future")}
          </button>

          <button
            type="button"
            onClick={() => openNewModal(undefined, "completed")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-rose-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("ვიზიტის ჩაწერა (+21დ)", "Record Appointment (+21d)")}
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      {viewMode === "list" ? (
        <>
          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              ["all", "completed", "scheduled", "missed", "canceled"] as const
            ).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize border transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-rose-50"
                }`}
              >
                {st === "all"
                  ? t("ყველა", "All")
                  : APPOINTMENT_STATUS_I18N[lang][st] ?? st}
              </button>
            ))}
          </div>

          {/* Appointments Table */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden">
            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarCheck2 className="w-10 h-10 text-rose-300 mx-auto" />
                <h3 className="mt-3 text-base font-semibold text-stone-800">
                  {t(
                    "არჩეული ფილტრით ვიზიტები არ მოიძებნა",
                    "No appointments match the selected filter"
                  )}
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  {t(
                    "ჩაწერეთ ეპილაციის ვიზიტი 21-დღიანი ავტომატური შეხსენების დასაგეგმად.",
                    "Record an epilation appointment to automatically schedule a 21-day email reminder."
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-rose-100 bg-rose-50/40 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                      <th className="py-3.5 px-6">
                        {t("კლიენტი", "Client")}
                      </th>
                      <th className="py-3.5 px-4">
                        {t("თარიღი და პროცედურა", "Treatment Date & Type")}
                      </th>
                      <th className="py-3.5 px-4">
                        {t("სტატუსი", "Status")}
                      </th>
                      <th className="py-3.5 px-4">
                        {t(
                          "მომდევნო ვიზიტი (+21 დღე) და შეხსენება",
                          "Next Expected (+21d) & Reminder"
                        )}
                      </th>
                      <th className="py-3.5 px-6 text-right">
                        {t("მოქმედება", "Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {filteredAppointments.map((appt) => {
                      const activeReminder = appt.reminders?.find(
                        (r) => r.status !== "canceled"
                      );
                      return (
                        <tr
                          key={appt.id}
                          className="hover:bg-rose-50/25 transition"
                        >
                          <td className="py-4 px-6">
                            <div className="font-semibold text-stone-900">
                              {appt.client?.full_name ?? t("კლიენტი", "Client")}
                            </div>
                            <div className="text-xs text-stone-500">
                              {appt.client?.email}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-stone-900">
                              {TREATMENT_LABELS_I18N[lang][
                                appt.treatment_type
                              ] ?? appt.treatment_type}
                            </div>
                            <div className="text-xs text-stone-500">
                              {appt.treatment_date} •{" "}
                              {appt.treatment_time.slice(0, 5)}
                            </div>
                            {appt.notes && (
                              <div className="text-xs text-stone-400 mt-0.5 line-clamp-1 max-w-xs">
                                {appt.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                                appt.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : appt.status === "scheduled"
                                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                                  : appt.status === "missed"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-stone-100 text-stone-600"
                              }`}
                            >
                              {APPOINTMENT_STATUS_I18N[lang][appt.status] ??
                                appt.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs">
                            {appt.next_expected_date ? (
                              <div>
                                <div className="font-semibold text-rose-700">
                                  {t("მომდევნო ვიზიტი:", "Next expected:")}{" "}
                                  {appt.next_expected_date}
                                </div>
                                {activeReminder ? (
                                  <div className="text-stone-500 mt-0.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-rose-500" />
                                    {t("შეხსენება:", "Email reminder:")}{" "}
                                    <strong className="uppercase">
                                      {REMINDER_STATUS_I18N[lang][
                                        activeReminder.status
                                      ] ?? activeReminder.status}
                                    </strong>{" "}
                                    ({activeReminder.scheduled_for_date})
                                  </div>
                                ) : (
                                  <div className="text-stone-400 mt-0.5">
                                    {t(
                                      "აქტიური შეხსენება არ არის",
                                      "No active reminder"
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : isEpilationTreatment(appt.treatment_type) ? (
                              <span className="text-stone-400">
                                {t(
                                  "მონიშნეთ დასრულებულად +21დ შეხსენებისთვის",
                                  "Mark completed to schedule +21d reminder"
                                )}
                              </span>
                            ) : (
                              <span className="text-stone-400">
                                {t(
                                  "არა-ეპილაციის პროცედურა (ავტო-შეხსენების გარეშე)",
                                  "Non-epilation treatment (no auto reminder)"
                                )}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {appt.status === "scheduled" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickStatusChange(appt, "completed")
                                    }
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
                                    title={t(
                                      "დასრულებულად მონიშვნა და 21-დღიანი შეხსენების ჩართვა",
                                      "Mark Completed & Schedule 21-Day Reminder"
                                    )}
                                  >
                                    {t("დასრულება", "Complete")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickStatusChange(appt, "missed")
                                    }
                                    className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition cursor-pointer"
                                  >
                                    {t("გაცდენა", "Missed")}
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditModal(appt)}
                                className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-rose-700 transition cursor-pointer"
                                title={t(
                                  "ვიზიტის რედაქტირება ან გადატანა",
                                  "Edit or Reschedule Appointment"
                                )}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {appt.status !== "canceled" && (
                                <button
                                  type="button"
                                  onClick={() => setCancelTarget(appt)}
                                  className="p-2 rounded-xl border border-stone-200 hover:bg-red-50 text-stone-600 hover:text-red-700 transition cursor-pointer"
                                  title={t(
                                    "ვიზიტის გაუქმება",
                                    "Cancel Appointment"
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
        </>
      ) : (
        /* Interactive Monthly Calendar View */
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-stone-900">{monthLabel}</h3>
              <p className="text-xs text-stone-500">
                {t(
                  "ნაჩვენებია როგორც დაჯავშნილი ვიზიტები, ისე 21-დღიანი შეხსენების თარიღები. დააჭირეთ ნებისმიერ დღეს ვიზიტის ჩასაწერად.",
                  "Shows both booked treatments and 21-day reminder target dates. Click any date to record an appointment."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) =>
                    prev.month === 0
                      ? { year: prev.year - 1, month: 11 }
                      : { year: prev.year, month: prev.month - 1 }
                  )
                }
                className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((prev) =>
                    prev.month === 11
                      ? { year: prev.year + 1, month: 0 }
                      : { year: prev.year, month: prev.month + 1 }
                  )
                }
                className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
            <div>{t("კვი", "Sun")}</div>
            <div>{t("ორშ", "Mon")}</div>
            <div>{t("სამ", "Tue")}</div>
            <div>{t("ოთხ", "Wed")}</div>
            <div>{t("ხუთ", "Thu")}</div>
            <div>{t("პარ", "Fri")}</div>
            <div>{t("შაბ", "Sat")}</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell, idx) =>
              cell.dateStr === null ? (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[104px] rounded-2xl bg-stone-50/40"
                />
              ) : (
                <div
                  key={cell.dateStr}
                  onClick={() => openNewModal(cell.dateStr!, "scheduled")}
                  className="min-h-[104px] p-2 rounded-2xl border border-stone-200/80 hover:border-rose-300 bg-white hover:bg-rose-50/20 transition cursor-pointer flex flex-col justify-between"
                >
                  <div className="text-xs font-bold text-stone-700">
                    {cell.dayNumber}
                  </div>
                  <div className="space-y-1 mt-1">
                    {cell.appointments.map((a) => (
                      <div
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(a);
                        }}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate ${
                          a.status === "completed"
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-sky-100 text-sky-900"
                        }`}
                      >
                        {a.treatment_time.slice(0, 5)} {a.client?.full_name}
                      </div>
                    ))}
                    {cell.expectedReturns.map((ret) => (
                      <div
                        key={`ret-${ret.id}`}
                        className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 text-[10px] font-semibold truncate"
                      >
                        +21d: {ret.client?.full_name}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Appointment Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-xl w-full p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-stone-900">
                  {editingAppt
                    ? t(
                        "ვიზიტის რედაქტირება / გადატანა",
                        "Edit / Reschedule Appointment"
                      )
                    : t("სალონის სწრაფი ჯავშანი", "Quick Salon Appointment")}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t(
                    `დროის სარტყელი: ${timezone} (24-საათიანი ფორმატი)`,
                    `Time zone: ${timezone} (24h format)`
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAppointment} className="mt-5 space-y-4">
              {/* Quick Mode Switch: Existing Client vs Inline New Client */}
              {!editingAppt && (
                <div className="flex items-center bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setClientMode("existing")}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      clientMode === "existing"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-stone-600"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {t("არსებული კლიენტი", "Existing Client")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode("new")}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      clientMode === "new"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-stone-600"
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {t(
                      "ახალი კლიენტი (სწრაფი დამატება)",
                      "New Client (Quick Add)"
                    )}
                  </button>
                </div>
              )}

              {clientMode === "existing" || editingAppt ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                      {t("აირჩიეთ კლიენტი *", "Select Client *")}
                    </label>
                    {!editingAppt && clients.length > 4 && (
                      <div className="relative w-48">
                        <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder={t("ძებნა სახელით...", "Quick filter...")}
                          className="w-full pl-7 pr-2 py-1 rounded-lg border border-stone-200 text-xs"
                        />
                      </div>
                    )}
                  </div>
                  <select
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={Boolean(editingAppt)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:bg-stone-100"
                  >
                    <option value="" disabled>
                      {t("აირჩიეთ კლიენტი...", "Select a client...")}
                    </option>
                    {searchableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.email})
                        {c.phone ? ` • ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Inline New Client Creation Fields */
                <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-3">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-600" />
                    {t(
                      "ახალი კლიენტი შეიქმნება და ჩაეწერება ერთდროულად",
                      "Creates new client profile & records appointment in 1 step"
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        {t("სახელი და გვარი *", "Full Name *")}
                      </label>
                      <input
                        type="text"
                        required
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder={t("მაგ: ანა კალანდაძე", "e.g. Ana Kalandadze")}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        {t("ელ-ფოსტა (შეხსენებისთვის) *", "Email Address *")}
                      </label>
                      <input
                        type="email"
                        required
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        placeholder="ana@gmail.com"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      {t("ტელეფონი (არასავალდებულო)", "Phone (Optional)")}
                    </label>
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="+995 555 12 34 56"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("ვიზიტის თარიღი *", "Treatment Date *")}
                  </label>
                  <input
                    type="date"
                    required
                    value={treatmentDate}
                    onChange={(e) => {
                      setTreatmentDate(e.target.value);
                      setFormError(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("ვიზიტის დრო (24სთ) *", "Treatment Time *")}
                  </label>
                  <input
                    type="time"
                    required
                    value={treatmentTime}
                    onChange={(e) => {
                      setTreatmentTime(e.target.value);
                      setFormError(null);
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                      modalSmartAvailability.isAvailable ||
                      status === "canceled" ||
                      status === "missed"
                        ? "border-stone-200 focus:ring-rose-500"
                        : "border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500"
                    }`}
                  />
                </div>
              </div>

              {/* Smart Availability Picker inside Staff Modal */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    {t(
                      `საათების სტატუსი (${workingHoursStart}–${workingHoursEnd}):`,
                      `Smart Slot Status (${workingHoursStart}–${workingHoursEnd}):`
                    )}
                  </span>
                  <span className="text-emerald-700">
                    {t(
                      `${modalSmartAvailability.availableSlots.length} თავისუფალი`,
                      `${modalSmartAvailability.availableSlots.length} free`
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {dynamicSlots.map((slot) => {
                    const slotObj = modalSmartAvailability.standardSlots.find(
                      (s) => s.time === slot
                    );
                    const isFree = slotObj ? slotObj.available : true;
                    const isSelected = treatmentTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setTreatmentTime(slot);
                          setFormError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                          !isFree
                            ? isSelected
                              ? "bg-red-100 border-red-400 text-red-900"
                              : "bg-stone-100 border-stone-200 text-stone-400 line-through"
                            : isSelected
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-white text-stone-700 border-stone-200 hover:border-rose-300"
                        }`}
                      >
                        {slot}
                        {!isFree && <Ban className="w-3 h-3 text-red-400" />}
                      </button>
                    );
                  })}
                </div>

                {!modalSmartAvailability.isAvailable &&
                  status !== "canceled" &&
                  status !== "missed" && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>
                          {t(
                            `დრო ${treatmentTime} დაკავებულია!`,
                            `Time ${treatmentTime} is already booked!`
                          )}
                        </strong>{" "}
                        {t(
                          `ემთხვევა ${modalSmartAvailability.conflictingTime}-ზე არსებულ ვიზიტს. აირჩიეთ თავისუფალი საათი ზემოთ.`,
                          `Conflicts with an existing ${modalSmartAvailability.conflictingTime} appointment. Please choose a free slot above.`
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("პროცედურა / სერვისი *", "Treatment / Service *")}
                  </label>
                  <select
                    value={treatmentType}
                    onChange={(e) =>
                      setTreatmentType(e.target.value as TreatmentType)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {serviceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("ვიზიტის სტატუსი *", "Appointment Status *")}
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as AppointmentStatus)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="completed">
                      {t(
                        "დასრულებული (რთავს +21დ შეხსენებას)",
                        "Completed (Triggers +21d Reminder)"
                      )}
                    </option>
                    <option value="scheduled">
                      {t("დაგეგმილი (მომავალი)", "Scheduled (Upcoming)")}
                    </option>
                    <option value="missed">{t("გაცდენილი", "Missed")}</option>
                    <option value="canceled">
                      {t("გაუქმებული", "Canceled")}
                    </option>
                  </select>
                </div>
              </div>

              {/* Dynamic 21-Day Reminder Preview Banner */}
              {previewReminderDate ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>
                      {t(
                        "ავტომატური 21-დღიანი ელ-ფოსტის შეხსენება:",
                        "Automatic 21-Day Email Reminder:"
                      )}
                    </strong>{" "}
                    {t(
                      `დაიგეგმება ${previewReminderDate}-ისთვის 09:00 საათზე (${timezone}).`,
                      `Will be scheduled for ${previewReminderDate} at 09:00 (${timezone}).`
                    )}
                    {editingAppt &&
                      t(
                        " არსებული შეხსენება განახლდება დუბლირების გარეშე.",
                        " Existing pending reminder will be updated in-place without creating duplicates."
                      )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-stone-100 text-xs text-stone-600">
                  {t(
                    "მხოლოდ დასრულებული ეპილაციის ვიზიტები ქმნის 21-დღიან ავტომატურ შეხსენებას.",
                    "Only completed epilation appointments schedule an automatic 21-day reminder."
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "პროცედურის შენიშვნები (არასავალდებულო)",
                    "Treatment Notes (Optional)"
                  )}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t(
                    "დამუშავებული ზონები, ლაზერის სიმძლავრე...",
                    "Zones treated, laser fluence, post-care balm..."
                  )}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 cursor-pointer"
                >
                  {t("გაუქმება", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (!modalSmartAvailability.isAvailable &&
                      status !== "canceled" &&
                      status !== "missed")
                  }
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {submitting
                    ? t("ინახება...", "Saving...")
                    : editingAppt
                    ? t("ცვლილებების შენახვა", "Save Appointment Changes")
                    : t("ვიზიტის შენახვა", "Save Appointment")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Canceling Appointment */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-stone-900">
              {t("გავაუქმოთ ეს ვიზიტი?", "Cancel this appointment?")}
            </h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              {t(
                `კლიენტის (${cancelTarget.client?.full_name}) ვიზიტის გაუქმება ${cancelTarget.treatment_date}-ზე ასევე ავტომატურად გააუქმებს მასთან დაკავშირებულ მოლოდინში მყოფ ელ-ფოსტის შეხსენებას.`,
                `Canceling ${cancelTarget.client?.full_name}'s appointment on ${cancelTarget.treatment_date} will also cancel any pending email reminder linked to this session.`
              )}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                {t("უკან დაბრუნება", "Keep Appointment")}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickStatusChange(cancelTarget, "canceled")
                }
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {t("დიახ, გაუქმდეს ვიზიტი", "Confirm Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
