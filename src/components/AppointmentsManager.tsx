"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  getTreatmentLabel,
  getAppointmentStatusLabel,
  getReminderStatusLabel,
  useLanguage,
} from "@/lib/i18n";
import Link from "next/link";

interface AppointmentsManagerProps {
  initialAppointments: Appointment[];
  clients: Client[];
  reminderIntervalDays: number;
  timezone: string;
  customServices?: CustomBookingService[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  slotIntervalMinutes?: number;
  staffMembers?: Array<{ id: string; full_name: string; is_active: boolean }>;
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
  staffMembers = [],
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
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  );
  const [treatmentTime, setTreatmentTime] = useState(searchParams.get("time") ?? "11:00");
  const [selectedStaffId, setSelectedStaffId] = useState(searchParams.get("staffId") ?? "");
  const [serverSlots, setServerSlots] = useState<Array<{ slot_time: string; staff_id: string }>>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [treatmentType, setTreatmentType] = useState<TreatmentType>("laser_epilation");
  const [serviceName, setServiceName] = useState<string>("");
  const [servicePrice, setServicePrice] = useState<number>(0);
  const [serviceDuration, setServiceDuration] = useState<number>(45);
  const [isEpilation, setIsEpilation] = useState<boolean>(true);

  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
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
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [clients, clientId, clientSearch]);

  // Smart slot availability for the date selected inside the modal
  useEffect(() => {
    if (!modalOpen || !selectedServiceId) return;
    const params = new URLSearchParams({ date: treatmentDate, service_id: selectedServiceId });
    if (selectedStaffId) params.set("staff_id", selectedStaffId);
    if (editingAppt?.id) params.set("exclude_appointment_id", editingAppt.id);
    let active = true;
    void fetch(`/api/availability?${params}`).then((response) => response.json()).then((result) => {
      if (!active) return;
      const slots = Array.isArray(result.slots) ? result.slots as Array<{ slot_time: string; staff_id: string }> : [];
      setServerSlots(slots);
    }).catch(() => { if (active) setServerSlots([]); });
    return () => { active = false; };
  }, [modalOpen, treatmentDate, selectedServiceId, selectedStaffId, editingAppt?.id]);

  const modalTimes = useMemo(() => Array.from(new Set(serverSlots
    .filter((slot) => !selectedStaffId || slot.staff_id === selectedStaffId)
    .map((slot) => slot.slot_time.slice(0, 5)))), [serverSlots, selectedStaffId]);
  useEffect(() => {
    if (modalOpen && modalTimes.length > 0 && !modalTimes.includes(treatmentTime)) setTreatmentTime(modalTimes[0]);
  }, [modalOpen, modalTimes, treatmentTime]);
  const modalSmartAvailability = useMemo(() => ({
    availableSlots: modalTimes,
    standardSlots: modalTimes.map((time) => ({ time, available: true, conflicting_time: null })),
    isAvailable: modalTimes.includes(treatmentTime),
    conflictingTime: null as string | null,
  }), [modalTimes, treatmentTime]);

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

    const firstEnabledService =
      customServices.find((s) => s.enabled !== false) || customServices[0];

    const initialDuration = firstEnabledService?.duration_minutes || 45;
    if (firstEnabledService) {
      setSelectedServiceId(firstEnabledService.id);
      setTreatmentType(firstEnabledService.type);
      setIsEpilation(firstEnabledService.is_epilation);
      setServicePrice(firstEnabledService.price_gel);
      setServiceDuration(firstEnabledService.duration_minutes);
      setServiceName(lang === "ka" ? firstEnabledService.name_ka : firstEnabledService.name_en);
    } else {
      setSelectedServiceId("custom");
      setTreatmentType("custom");
      setIsEpilation(true);
      setServicePrice(0);
      setServiceDuration(45);
      setServiceName("");
    }

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
      initialDuration,
      dynamicSlots
    );
    setTreatmentTime(
      check.isAvailable ? defaultSlot : check.availableSlots[0] ?? defaultSlot
    );

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

    const matchedService = customServices.find(
      (s) =>
        s.id === appt.service_id ||
        s.id === appt.treatment_type ||
        s.type === appt.treatment_type
    );

    setSelectedServiceId(appt.service_id || matchedService?.id || appt.treatment_type);
    setTreatmentType(appt.treatment_type);
    setIsEpilation(
      appt.is_epilation ??
        matchedService?.is_epilation ??
        isEpilationTreatment(appt.treatment_type)
    );
    setServicePrice(appt.price_gel ?? matchedService?.price_gel ?? 0);
    setServiceDuration(appt.duration_minutes ?? matchedService?.duration_minutes ?? 45);
    setServiceName(
      appt.service_name ||
        (matchedService
          ? lang === "ka"
            ? matchedService.name_ka
            : matchedService.name_en
          : appt.treatment_type)
    );

    setStatus(appt.status);
    setSelectedStaffId((appt as Appointment & { staff_id?: string }).staff_id ?? "");
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
        staff_id: selectedStaffId || null,
        service_id: selectedServiceId || null,
        service_name: serviceName || null,
        price_gel: servicePrice ?? null,
        duration_minutes: serviceDuration ?? 45,
        is_epilation: isEpilation,
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
                `ვიზიტი განახლდა და ავტომატური შეხსენება დაიგეგმა ${data.reconciliation.scheduledForDate}-ისთვის.`,
                `Appointment updated and automatic reminder scheduled for ${data.reconciliation.scheduledForDate}.`
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
          const offsetDays = Math.max(0, reminderIntervalDays - 1);
          const targetDate = addCalendarDays(
            appt.treatment_date,
            offsetDays
          );
          setToast(
            t(
              `მონიშნულია დასრულებულად! შეხსენება დაიგეგმა მომდევნო ვიზიტამდე 1 დღით ადრე (${targetDate}-ს).`,
              `Marked completed! Reminder scheduled 1 day prior to next visit (${targetDate}).`
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
          const statusText = getAppointmentStatusLabel(newStatus, lang);
          setToast(
            t(
              `ვიზიტის სტატუსი შეიცვალა: ${statusText}`,
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

  // Compute preview of reminder date inside modal (1 day before next recommended cycle)
  const previewReminderDate = useMemo(() => {
    try {
      if (status === "completed" && isEpilationTreatment(treatmentType)) {
        return addCalendarDays(treatmentDate, Math.max(0, reminderIntervalDays - 1));
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

  // Build service options strictly from the salon's active customServices catalog
  const serviceOptions = useMemo(() => {
    const list: Array<{
      id: string;
      value: string;
      type: TreatmentType;
      name: string;
      label: string;
      price: number;
      duration: number;
      isEpil: boolean;
    }> = [];

    for (const srv of customServices) {
      if (srv.enabled === false) continue;
      const srvName = lang === "ka" ? srv.name_ka : srv.name_en;
      list.push({
        id: srv.id,
        value: srv.id,
        type: srv.type,
        name: srvName,
        label: `${srvName} (${srv.price_gel} ₾ • ${srv.duration_minutes} ${t("წთ", "min")})`,
        price: srv.price_gel,
        duration: srv.duration_minutes,
        isEpil: srv.is_epilation,
      });
    }

    // If editing a historical appointment whose service is not in active catalog
    if (editingAppt) {
      const exists = list.some(
        (o) =>
          o.id === editingAppt.service_id ||
          o.id === editingAppt.treatment_type ||
          o.type === editingAppt.treatment_type
      );
      if (!exists) {
        const legacyLabel =
          editingAppt.service_name ||
          getTreatmentLabel(editingAppt.treatment_type, lang, customServices);
        list.push({
          id: editingAppt.service_id || editingAppt.treatment_type,
          value: editingAppt.service_id || editingAppt.treatment_type,
          type: editingAppt.treatment_type,
          name: legacyLabel,
          label: `${legacyLabel} (${t("ისტორიული", "Historical")})`,
          price: editingAppt.price_gel ?? 0,
          duration: editingAppt.duration_minutes ?? 45,
          isEpil: editingAppt.is_epilation,
        });
      }
    }

    return list;
  }, [customServices, lang, t, editingAppt]);

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
            {t("ვიზიტის ჩაწერა", "Record Appointment")}
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
              ["all", "completed", "arrived", "scheduled", "no_show", "missed", "canceled"] as const
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
                  : getAppointmentStatusLabel(st, lang)}
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
                    "ჩაწერეთ ეპილაციის ვიზიტი ავტომატური ელ-ფოსტის შეხსენების დასაგეგმად.",
                    "Record an epilation appointment to automatically schedule an email reminder."
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
                          "მომდევნო ციკლი და შეხსენება",
                          "Next Expected Cycle & Reminder"
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
                            <div className="font-medium text-stone-900 flex items-center gap-1.5 flex-wrap">
                              <span>
                                {appt.service_name ||
                                  getTreatmentLabel(
                                    appt.treatment_type,
                                    lang,
                                    customServices
                                  )}
                              </span>
                              {appt.price_gel !== null &&
                                appt.price_gel !== undefined && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 font-bold text-rose-700">
                                    {appt.price_gel} ₾
                                  </span>
                                )}
                              {appt.duration_minutes && (
                                <span className="text-[11px] text-stone-400">
                                  • {appt.duration_minutes} {t("წთ", "min")}
                                </span>
                              )}
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
                              {getAppointmentStatusLabel(appt.status, lang)}
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
                                      {getReminderStatusLabel(
                                        activeReminder.status,
                                        lang
                                      )}
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
                                  "მონიშნეთ დასრულებულად შეხსენების დასაგეგმად",
                                  "Mark completed to schedule reminder"
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
                                      "დასრულებულად მონიშვნა და შეხსენების ავტომატური დაგეგმვა",
                                      "Mark Completed & Schedule Automated Reminder"
                                    )}
                                  >
                                    {t("დასრულება", "Complete")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(appt, "arrived")}
                                    className="px-2.5 py-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-800 text-xs font-semibold"
                                  >{t("მივიდა", "Arrived")}</button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickStatusChange(appt, "missed")
                                    }
                                    className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition cursor-pointer"
                                  >
                                    {t("გაცდენა", "Missed")}
                                  </button>
                                  <button type="button" onClick={() => handleQuickStatusChange(appt, "no_show")} className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold">{t("არ გამოცხადდა", "No show")}</button>
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
                  "ნაჩვენებია დაჯავშნილი ვიზიტები და რეკომენდებული განმეორებითი ვიზიტის თარიღები. დააჭირეთ ნებისმიერ დღეს ვიზიტის ჩასაწერად.",
                  "Shows booked treatments and upcoming recommended cycle dates. Click any date to record an appointment."
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
                        {t("ციკლი", "Cycle")}: {ret.client?.full_name}
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">{t("სპეციალისტი", "Staff member")}</label>
                  <select value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white">
                    <option value="">{t("ნებისმიერი ხელმისაწვდომი", "Any available")}</option>
                    {staffMembers.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                  </select>
                </div>
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
                      status === "missed" ||
                      status === "no_show"
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
                  {modalTimes.map((slot) => {
                    const isFree = true;
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
                {modalTimes.length === 0 && <p className="text-xs text-amber-800">{t("არჩეული სერვისისთვის ამ თარიღზე თავისუფალი დრო არ არის.", "No available time for this service on the selected date.")}</p>}

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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                      {t("პროცედურა / სერვისი *", "Treatment / Service *")}
                    </label>
                    <Link
                      href="/settings"
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline"
                      target="_blank"
                    >
                      {t("მართვა / შაბლონები", "Manage / Templates")}
                    </Link>
                  </div>
                  {serviceOptions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      {t(
                        "სერვისები არ გაქვთ დამატებული. გადადით პარამეტრებში ან აირჩიეთ მზა შაბლონი.",
                        "No services configured. Please go to Settings or choose a template."
                      )}
                    </div>
                  ) : (
                    <select
                      value={selectedServiceId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedServiceId(val);
                        const opt = serviceOptions.find((o) => o.id === val);
                        if (opt) {
                          setTreatmentType(opt.type);
                          setIsEpilation(opt.isEpil);
                          setServicePrice(opt.price);
                          setServiceDuration(opt.duration);
                          setServiceName(opt.name);
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    >
                      {serviceOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {serviceDuration > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
                      <span>
                        {t("ხანგრძლივობა:", "Duration:")}{" "}
                        <strong>{serviceDuration} {t("წთ", "min")}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        {t("ფასი:", "Price:")} <strong>{servicePrice} ₾</strong>
                      </span>
                      <span>•</span>
                      <span
                        className={
                          isEpilation
                            ? "text-rose-600 font-semibold"
                            : "text-stone-500"
                        }
                      >
                        {isEpilation
                          ? t("ეპილაცია (ავტო-შეხსენება)", "Epilation (Auto-reminder)")
                          : t("სტანდარტული ვიზიტი", "Standard visit")}
                      </span>
                    </div>
                  )}
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
                        "დასრულებული (ავტო-შეხსენების დაგეგმვა)",
                        "Completed (Schedules Auto-Reminder)"
                      )}
                    </option>
                    <option value="arrived">{t("მივიდა", "Arrived")}</option>
                    <option value="scheduled">
                      {t("დაგეგმილი (მომავალი)", "Scheduled (Upcoming)")}
                    </option>
                    <option value="arrived">{t("მივიდა", "Arrived")}</option>
                    <option value="missed">{t("გაცდენილი", "Missed")}</option>
                    <option value="no_show">{t("არ გამოცხადდა", "No show")}</option>
                    <option value="no_show">{t("არ გამოცხადდა", "No show")}</option>
                    <option value="canceled">
                      {t("გაუქმებული", "Canceled")}
                    </option>
                  </select>
                </div>
              </div>

              {/* Dynamic Reminder Preview Banner */}
              {previewReminderDate ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>
                      {t(
                        "ავტომატური ელ-ფოსტის შეხსენება (მომდევნო ციკლამდე 1 დღით ადრე):",
                        "Automatic Email Reminder (1 day before next cycle):"
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
                    "მხოლოდ დასრულებული ეპილაციის ვიზიტები ქმნის ავტომატურ შეხსენებას მომდევნო ციკლამდე 1 დღით ადრე.",
                    "Only completed epilation appointments schedule an automatic reminder 1 day prior to the next cycle."
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
