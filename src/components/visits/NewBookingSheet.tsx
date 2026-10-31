"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Clock, Lock, Search, UserPlus, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatLongDate } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { normalizeGeorgianPhone } from "@/lib/validation";
import { minutesToTime, tbilisiIso, toMinutes } from "@/lib/calendar-layout";
import { Alert, Button, Chip, ChipRow, DayChips, Field, Input, Sheet, Skeleton, Tabs, Textarea, TimeChips, cn, useToast } from "@/components/ui";
import type { Visit } from "./types";

export interface BookingService {
  id: string;
  name_ka: string;
  name_en?: string | null;
  price_gel: number;
  duration_minutes: number;
}

export interface BookingStaff {
  id: string;
  full_name: string;
  color?: string | null;
  service_ids: string[];
}

export interface BookingClient {
  id: string;
  full_name: string;
  phone?: string | null;
}

export interface BookingDefaults {
  date: string;
  time?: string;
  staffId?: string;
  client?: BookingClient | null;
}

export interface TimeOffBlock {
  id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
}

type Mode = "book" | "block";
type Slot = { slot_time: string; staff_id: string };

/** Picks the Georgian or English half of an API message written as "ქართული / English". */
function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "ka" ? ka : en ?? ka;
}

/**
 * New booking from anywhere in the dashboard: client (search or new with name and phone),
 * service, master, day and a free time. Owners and admins can also block time here.
 */
export function NewBookingSheet({ open, defaults, services, staff, canBlock, onClose, onCreated, onBlocked }: {
  open: boolean;
  defaults: BookingDefaults;
  services: BookingService[];
  staff: BookingStaff[];
  canBlock: boolean;
  onClose: () => void;
  onCreated: (visit: Visit) => void;
  onBlocked: (block: TimeOffBlock) => void;
}) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("book");
  const [client, setClient] = useState<BookingClient | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookingClient[] | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // Reset to the tapped slot every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setMode("book");
    setClient(defaults.client ?? null);
    setQuery("");
    setResults(null);
    setNewClient(false);
    setNewName("");
    setNewPhone("");
    setServiceId("");
    setStaffId(defaults.staffId ?? "");
    setDate(defaults.date);
    setTime(defaults.time ?? "");
    setNotes("");
    setSlots(null);
    setError(null);
    const start = defaults.time ?? "10:00";
    setBlockStart(start);
    setBlockEnd(minutesToTime(Math.min(toMinutes(start) + 60, 23 * 60 + 45)));
    setBlockReason("");
  }, [open, defaults]);

  // Client search, debounced.
  useEffect(() => {
    if (!open || client || newClient) return;
    const term = query.trim();
    if (term.length < 2) { setResults(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(term)}&limit=6`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setResults((data.clients ?? []).map((row: BookingClient) => ({ id: row.id, full_name: row.full_name, phone: row.phone }))))
        .catch(() => undefined);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, open, client, newClient]);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const staffForService = useMemo(
    () => (service ? staff.filter((member) => member.service_ids.includes(service.id)) : staff),
    [service, staff]
  );

  // A master chosen on the calendar who does not offer the service is cleared.
  useEffect(() => {
    if (staffId && service && !staffForService.some((member) => member.id === staffId)) setStaffId("");
  }, [service, staffForService, staffId]);

  // Free times for the chosen service, master and day.
  useEffect(() => {
    if (!open || !serviceId) { setSlots(null); return; }
    const controller = new AbortController();
    setSlots(null);
    const params = new URLSearchParams({ date, service_id: serviceId });
    if (staffId) params.set("staff_id", staffId);
    fetch(`/api/availability?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setSlots(ok ? (data.slots ?? []).map((slot: Slot) => ({ slot_time: String(slot.slot_time).slice(0, 5), staff_id: slot.staff_id })) : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, serviceId, staffId, date]);

  const times = useMemo(() => Array.from(new Set((slots ?? []).map((slot) => slot.slot_time))).sort(), [slots]);
  const wantedTimeMissing = Boolean(slots && defaults.time && date === defaults.date && time === defaults.time && !times.includes(time));

  const phoneValid = normalizeGeorgianPhone(newPhone) !== null;
  const clientReady = Boolean(client) || (newClient && newName.trim().length >= 2 && phoneValid);
  const canSave = clientReady && Boolean(service) && Boolean(time) && times.includes(time);

  async function save() {
    if (!service || !canSave) return;
    setSaving(true);
    setError(null);
    // With "anyone", book the first master who is free at that time.
    const chosenStaff = staffId || (slots ?? []).find((slot) => slot.slot_time === time)?.staff_id || null;
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(client ? { client_id: client.id } : { new_client: { full_name: newName.trim(), phone: newPhone.trim() } }),
          treatment_date: date,
          treatment_time: time,
          treatment_type: service.id,
          service_id: service.id,
          staff_id: chosenStaff,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(response.status === 409
          ? t("ეს დრო უკვე დაკავებულია. აირჩიეთ სხვა.", "That time was just taken. Please choose another.")
          : localMessage(String(data.error ?? t("ჯავშანი ვერ შეინახა.", "The booking could not be saved.")), lang));
        if (response.status === 409) setTime("");
        return;
      }
      const row = data.appointment as Visit & { client?: BookingClient };
      onCreated({ ...row, payment: null });
      toast.success(t(`ჯავშანი შენახულია · ${time}`, `Booked · ${time}`));
      onClose();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ თავიდან.", "Network error. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function block() {
    if (!blockStart || !blockEnd || blockEnd <= blockStart) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staffId || null,
          starts_at: tbilisiIso(date, toMinutes(blockStart)),
          ends_at: tbilisiIso(date, toMinutes(blockEnd)),
          reason: blockReason.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(localMessage(String(data.error ?? "Error"), lang)); return; }
      onBlocked(data.timeOff ?? data.time_off ?? data);
      toast.success(t("დრო დაიბლოკა.", "Time blocked."));
      onClose();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ თავიდან.", "Network error. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const footer = mode === "book"
    ? <Button size="lg" block loading={saving} disabled={!canSave} onClick={() => void save()}>
        {time && service ? t(`ჯავშანი · ${time}`, `Book · ${time}`) : t("ჯავშნის შენახვა", "Save booking")}
      </Button>
    : <Button size="lg" block loading={saving} disabled={!blockStart || !blockEnd || blockEnd <= blockStart} icon={<Lock className="h-5 w-5" />} onClick={() => void block()}>
        {t("დროის დაბლოკვა", "Block time")}
      </Button>;

  return (
    <Sheet open={open} onClose={onClose} title={mode === "book" ? t("ახალი ჯავშანი", "New booking") : t("დროის დაბლოკვა", "Block time")}
      description={formatLongDate(date, lang)} footer={footer}>
      <div className="space-y-6">
        {canBlock && (
          <Tabs label={t("მოქმედება", "Action")} value={mode} onChange={(value) => { setMode(value); setError(null); }}
            items={[{ value: "book", label: t("ჯავშანი", "Booking") }, { value: "block", label: t("დაბლოკვა", "Block time") }]} />
        )}
        {error && <Alert tone="error">{error}</Alert>}

        {mode === "book" ? <>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("კლიენტი", "Client")}</h3>
            {client ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-brand-soft/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">{client.full_name}</p>
                  {client.phone && <p className="text-sm text-stone-500">{client.phone}</p>}
                </div>
                <button type="button" onClick={() => setClient(null)} aria-label={t("კლიენტის შეცვლა", "Change client")}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-white"><X className="h-5 w-5" /></button>
              </div>
            ) : newClient ? (
              <div className="space-y-3 rounded-2xl border border-stone-200 p-4">
                <Field label={t("სახელი და გვარი", "Full name")}>{(props) => <Input {...props} autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} />}</Field>
                <Field label={t("ტელეფონი", "Phone")} error={newPhone && !phoneValid ? t("შეიყვანეთ ქართული მობილური, მაგ. 555 12 34 56.", "Enter a Georgian mobile, e.g. 555 12 34 56.") : null}>
                  {(props) => <Input {...props} type="tel" inputMode="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="5XX XX XX XX" />}
                </Field>
                <button type="button" onClick={() => setNewClient(false)} className="min-h-11 text-sm font-semibold text-stone-500 hover:text-stone-800">{t("არსებული კლიენტის ძებნა", "Search existing clients")}</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <Input aria-label={t("კლიენტის ძებნა", "Search clients")} className="pl-11" value={query} onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("სახელი ან ტელეფონი", "Name or phone")} />
                </div>
                {results && results.length > 0 && (
                  <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
                    {results.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => setClient(item)} className="flex w-full min-h-12 items-center justify-between gap-3 px-4 py-2 text-left hover:bg-stone-50">
                          <span className="truncate font-medium text-stone-900">{item.full_name}</span>
                          <span className="shrink-0 text-sm text-stone-500">{item.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {results && results.length === 0 && <p className="px-1 text-sm text-stone-500">{t("კლიენტი ვერ მოიძებნა.", "No client found.")}</p>}
                <Button variant="secondary" block icon={<UserPlus className="h-4 w-4 text-brand" />}
                  onClick={() => { setNewClient(true); if (/\d{3,}/.test(query)) setNewPhone(query.trim()); else setNewName(query.trim()); }}>
                  {t("ახალი კლიენტი", "New client")}
                </Button>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("სერვისი", "Service")}</h3>
            {services.length === 0 ? (
              <p className="text-sm text-stone-500">{t("ჯერ დაამატეთ სერვისები პარამეტრებში.", "Add services in Settings first.")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {services.map((item) => (
                  <button key={item.id} type="button" aria-pressed={item.id === serviceId} onClick={() => { setServiceId(item.id); setTime(defaults.time && date === defaults.date ? defaults.time : ""); }}
                    className={cn("flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left transition",
                      item.id === serviceId ? "border-brand bg-brand-soft ring-2 ring-brand/20" : "border-stone-200 bg-white hover:border-rose-300")}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-stone-900">{lang === "ka" ? item.name_ka : item.name_en || item.name_ka}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Clock className="h-3 w-3" />{item.duration_minutes} {t("წთ", "min")}</span>
                    </span>
                    <span className="shrink-0 font-bold text-stone-800">{formatGel(Number(item.price_gel), lang)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {service && <>
            {staffForService.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("სპეციალისტი", "Specialist")}</h3>
                <ChipRow>
                  <Chip selected={!staffId} onClick={() => { setStaffId(""); setTime(""); }}>{t("ნებისმიერი", "Anyone")}</Chip>
                  {staffForService.map((member) => (
                    <Chip key={member.id} selected={staffId === member.id} dotColor={member.color ?? undefined} onClick={() => { setStaffId(member.id); setTime(""); }}>{member.full_name}</Chip>
                  ))}
                </ChipRow>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("დღე", "Day")}</h3>
              <DayChips value={date} onChange={(value) => { setDate(value); setTime(""); }} days={21} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("თავისუფალი დრო", "Free times")}</h3>
              {wantedTimeMissing && <Alert tone="warning" className="mb-3">{t(`${defaults.time} დაკავებულია ან არასამუშაო დროა. აირჩიეთ სხვა.`, `${defaults.time} is taken or outside working hours. Choose another.`)}</Alert>}
              {slots === null ? (
                <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div>
              ) : times.length === 0 ? (
                <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">{t("ამ დღეს თავისუფალი დრო არ არის.", "No free times on this day.")}</p>
              ) : (
                <TimeChips times={times} value={time} onChange={setTime} />
              )}
            </section>

            <Field label={t("შენიშვნა", "Note")} optionalLabel={t("(არასავალდებულო)", "(optional)")}>
              {(props) => <Textarea {...props} rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />}
            </Field>
          </>}
        </> : (
          <section className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("ვისთვის", "For")}</h3>
              <ChipRow>
                <Chip selected={!staffId} onClick={() => setStaffId("")}>{t("მთელი სალონი", "Whole salon")}</Chip>
                {staff.map((member) => (
                  <Chip key={member.id} selected={staffId === member.id} dotColor={member.color ?? undefined} onClick={() => setStaffId(member.id)}>{member.full_name}</Chip>
                ))}
              </ChipRow>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("დღე", "Day")}</h3>
              <DayChips value={date} onChange={setDate} days={21} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("დან", "From")}>{(props) => <Input {...props} type="time" step={900} value={blockStart} onChange={(event) => setBlockStart(event.target.value)} />}</Field>
              <Field label={t("მდე", "Until")} error={blockEnd && blockStart && blockEnd <= blockStart ? t("დასრულება უნდა იყოს დაწყების შემდეგ.", "End must be after start.") : null}>
                {(props) => <Input {...props} type="time" step={900} value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} />}
              </Field>
            </div>
            <Field label={t("მიზეზი", "Reason")} optionalLabel={t("(არასავალდებულო)", "(optional)")}>
              {(props) => <Input {...props} value={blockReason} maxLength={300} onChange={(event) => setBlockReason(event.target.value)} placeholder={t("მაგ: შესვენება, ექიმთან ვიზიტი", "e.g. lunch, doctor")} />}
            </Field>
          </section>
        )}
      </div>
    </Sheet>
  );
}
