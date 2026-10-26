"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

type Staff = { id: string; full_name: string; color: string; is_active: boolean };
type Booking = { id: string; treatment_date: string; treatment_time: string; starts_at: string; ends_at: string; staff_id: string; status: string; client?: { full_name?: string } | null; service_name?: string | null };

function dateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function localDate(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function localTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export default function StaffCalendar({ initialBookings, staff, timezone }: { initialBookings: Booking[]; staff: Staff[]; timezone: string }) {
  const { t } = useLanguage();
  const [view, setView] = useState<"day" | "week">("day");
  const [anchorDate, setAnchorDate] = useState(() => dateString(new Date()));
  const [bookings, setBookings] = useState(initialBookings);
  const [blocking, setBlocking] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockStaff, setBlockStaff] = useState("");
  const [message, setMessage] = useState("");
  const days = useMemo(() => {
    const base = new Date(`${anchorDate}T12:00:00`);
    const start = new Date(base);
    if (view === "week") start.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return Array.from({ length: view === "day" ? 1 : 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return dateString(d); });
  }, [anchorDate, view]);
  const activeStaff = staff.filter((item) => item.is_active);
  const columns = days.flatMap((day) => activeStaff.map((member) => ({ day, member })));
  const hours = Array.from({ length: 52 }, (_, i) => 8 * 60 + i * 15);

  function onDrop(event: React.DragEvent<HTMLDivElement>, day: string, staffId: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/appointment-id");
    const bounds = event.currentTarget.getBoundingClientRect();
    const minute = Math.max(8 * 60, Math.min(21 * 60, 8 * 60 + Math.floor((event.clientY - bounds.top) / 24) * 15));
    const time = `${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
    void fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ treatment_date: day, treatment_time: time, staff_id: staffId }) })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not move appointment."); setMessage(t("ჯავშანი გადატანილია.", "Appointment rescheduled.")); window.location.reload(); })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : t("გადატანა ვერ მოხერხდა.", "Could not reschedule.")));
  }

  async function blockTime(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/time-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: blockStaff || null, starts_at: new Date(blockStart).toISOString(), ends_at: new Date(blockEnd).toISOString(), reason: "Blocked from calendar" }) });
    const result = await response.json();
    setMessage(response.ok ? t("დრო დაბლოკილია.", "Time blocked.") : result.error ?? t("დროის დაბლოკვა ვერ მოხერხდა.", "Could not block time."));
    if (response.ok) { setBlocking(false); window.location.reload(); }
  }

  return <section className="mx-6 mt-6 rounded-2xl border border-rose-100 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{t("სპეციალისტების კალენდარი", "Staff calendar")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label={t("თარიღი", "Date")} type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" />
        <button onClick={() => setView("day")} className={`rounded-lg border px-3 py-2 text-xs ${view === "day" ? "bg-rose-600 text-white" : "bg-white"}`}>{t("დღე", "Day")}</button>
        <button onClick={() => setView("week")} className={`rounded-lg border px-3 py-2 text-xs ${view === "week" ? "bg-rose-600 text-white" : "bg-white"}`}>{t("კვირა", "Week")}</button>
        <button onClick={() => setBlocking((value) => !value)} className="rounded-lg border px-3 py-2 text-xs font-semibold">{t("დროის დაბლოკვა", "Block time")}</button>
      </div>
    </div>
    {blocking && <form onSubmit={blockTime} className="mt-4 grid gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-4">
      <select value={blockStaff} onChange={(event) => setBlockStaff(event.target.value)} className="rounded-lg border px-2 py-2 text-sm"><option value="">{t("მთელი სალონი", "Whole salon")}</option>{activeStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select>
      <input required type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
      <input required type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" />
      <button className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white">{t("შენახვა", "Save")}</button>
    </form>}
    {message && <p role="status" className="mt-3 text-sm text-rose-700">{message}</p>}
    <div className="mt-5 overflow-x-auto">
      <div className="flex min-w-max">
        <aside className="w-[52px] shrink-0"><div className="h-12 border-b p-2 text-[9px] text-stone-400">{timezone}</div><div className="relative h-[1248px]">{hours.map((minute) => <div key={minute} className="absolute right-2 text-[10px] text-stone-400" style={{ top: ((minute - 8*60) / 15) * 24 - 6 }}>{minute % 60 === 0 ? `${String(minute/60).padStart(2,"0")}:00` : ""}</div>)}</div></aside>
        {columns.map(({ day, member }) => <div key={`${day}-${member.id}`} className="min-w-[150px] flex-1">
          <header className="h-12 border-b border-l p-2 text-center text-xs font-semibold"><div>{day}</div><div className="mt-1" style={{ color: member.color }}>{member.full_name}</div></header>
          <div className="relative h-[1248px] border-l border-b" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 23px, #f5f5f4 23px, #f5f5f4 24px)" }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, day, member.id)}>
          {hours.map((minute) => <button key={minute} type="button" aria-label={t(`დაჯავშნა ${day} ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`, `Book ${day} ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`)} onDoubleClick={() => { const time = `${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`; window.location.href = `/appointments?new=1&date=${day}&time=${time}&staffId=${member.id}`; }} className="absolute inset-x-0 h-6 hover:bg-rose-50/60" style={{ top: ((minute - 8*60) / 15) * 24 }} />)}
          {bookings.filter((booking) => booking.staff_id === member.id && localDate(booking.starts_at, timezone) === day && booking.status !== "canceled" && booking.status !== "no_show" && booking.status !== "missed").map((booking) => {
            const start = localTime(booking.starts_at, timezone).split(":").map(Number);
            const end = localTime(booking.ends_at, timezone).split(":").map(Number);
            const top = ((start[0]*60+start[1]-8*60)/15)*24;
            const height = Math.max(24, ((end[0]*60+end[1]-start[0]*60-start[1])/15)*24);
            return <Link draggable onDragStart={(event) => event.dataTransfer.setData("text/appointment-id", booking.id)} key={booking.id} href={`/appointments?edit=${booking.id}`} className="absolute z-[2] overflow-hidden rounded-md border-l-4 bg-rose-50 px-2 py-1 text-[10px] shadow-sm" style={{ left: 3, right: 3, top, height, borderColor: member.color }} title={t("გადაათრიეთ გადასატანად", "Drag to reschedule")}>{localTime(booking.starts_at, timezone)} · {booking.client?.full_name ?? booking.service_name ?? t("ჯავშანი", "Booking")}</Link>;
          })}
          </div>
        </div>)}
      </div>
    </div>
    <p className="mt-2 text-[11px] text-stone-500">{t("სწრაფი ჯავშნისთვის უჯრას ორჯერ დააჭირეთ. ჯავშანი გადაათრიეთ სხვა სპეციალისტის ან დღის სვეტში.", "Double-click an empty slot to create a booking. Drag an appointment to another staff member or day.")}</p>
  </section>;
}
