"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

type StaffItem = { id: string; full_name: string; is_active: boolean };
type ServiceItem = { id: string; name_ka: string; name_en: string; price_gel: number; duration_minutes: number; is_active: boolean };
type TimeOffItem = { id: string; staff_id: string | null; starts_at: string; ends_at: string; reason: string | null };

export default function BookingSettingsManager({ section }: { section: "staff" | "services" | "schedules" | "time-off" }) {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [nameKa, setNameKa] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("0");
  const [duration, setDuration] = useState("45");
  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");

  const load = useCallback(async () => {
    const [staffResponse, serviceResponse, timeOffResponse] = await Promise.all([fetch("/api/staff"), fetch("/api/services"), fetch("/api/time-off")]);
    const staffData = await staffResponse.json();
    const serviceData = await serviceResponse.json();
    const timeOffData = await timeOffResponse.json();
    setStaff(staffData.staff ?? []);
    setServices(serviceData.services ?? []);
    setTimeOff(timeOffData.time_off ?? []);
    if (!staffId && staffData.staff?.[0]) setStaffId(staffData.staff[0].id);
  }, [staffId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(path: string, method: string, body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed.");
      setMessage(t("ცვლილება შენახულია.", "Changes saved."));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : t("შენახვა ვერ მოხერხდა.", "Could not save changes.")); }
    finally { setBusy(false); }
  }

  const title = {
    staff: t("სპეციალისტები", "Staff"), services: t("სერვისები", "Services"),
    schedules: t("სამუშაო განრიგი", "Working hours"), "time-off": t("დასვენების დრო", "Time off"),
  }[section];

  return <main className="mx-auto max-w-5xl p-6 sm:p-10">
    <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
    <p className="mt-1 text-sm text-stone-500">{t("განრიგი და დაჯავშნის გუნდი", "Manage the team and booking schedule")}</p>
    <nav className="mt-5 flex flex-wrap gap-2" aria-label={t("განრიგის პარამეტრები", "Booking settings")}>
      {(["staff", "services", "schedules", "time-off"] as const).map((item) => <Link key={item} href={`/settings/${item}`} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${item === section ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200 bg-white text-stone-700"}`}>{({ staff: t("სპეციალისტები", "Staff"), services: t("სერვისები", "Services"), schedules: t("განრიგი", "Schedules"), "time-off": t("დასვენება", "Time off") })[item]}</Link>)}
    </nav>
    {message && <p role="status" className="my-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}
    {section === "staff" && <section className="mt-6 rounded-2xl border bg-white p-5">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void submit("/api/staff", "POST", { full_name: name }); setName(""); }}>
        <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("სახელი და გვარი", "Full name")} className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
        <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">{t("დამატება", "Add")}</button>
      </form>
      <ul className="mt-4 divide-y">{staff.map((item) => <li key={item.id} className="flex items-center justify-between py-3"><span>{item.full_name}</span><button onClick={() => void submit(`/api/staff?id=${item.id}`, "DELETE", undefined)} className="text-sm text-rose-700">{item.is_active ? t("გამორთვა", "Deactivate") : t("გამორთულია", "Inactive")}</button></li>)}</ul>
    </section>}
    {section === "services" && <section className="mt-6 rounded-2xl border bg-white p-5">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit("/api/services", "POST", { name_ka: nameKa, name_en: nameEn, price_gel: Number(price), duration_minutes: Number(duration) }); setNameKa(""); setNameEn(""); }}>
        <input required value={nameKa} onChange={(event) => setNameKa(event.target.value)} placeholder="სახელი ქართულად" className="rounded-lg border px-3 py-2" />
        <input required value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Name in English" className="rounded-lg border px-3 py-2" />
        <input required type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} aria-label={t("ფასი ლარში", "Price in GEL")} className="rounded-lg border px-3 py-2" />
        <input required type="number" min="5" max="720" value={duration} onChange={(event) => setDuration(event.target.value)} aria-label={t("ხანგრძლივობა წუთებში", "Duration in minutes")} className="rounded-lg border px-3 py-2" />
        <button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white sm:col-span-2">{t("სერვისის დამატება", "Add service")}</button>
      </form>
      <ul className="mt-4 divide-y">{services.map((item) => <li key={item.id} className="flex items-center justify-between py-3"><span>{item.name_ka} / {item.name_en} · {item.price_gel} ₾ · {item.duration_minutes} წთ</span><button onClick={() => void submit(`/api/services?id=${item.id}`, "DELETE", undefined)} className="text-sm text-rose-700">{t("გამორთვა", "Deactivate")}</button></li>)}</ul>
    </section>}
    {section === "schedules" && <section className="mt-6 max-w-xl rounded-2xl border bg-white p-5">
      <label className="block text-sm font-semibold">{t("სპეციალისტი", "Staff member")}</label><select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">{t("დაწყება", "Start")}<input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{t("დასრულება", "End")}<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="text-sm">{t("შესვენების დაწყება", "Break start")}<input type="time" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{t("შესვენების დასრულება", "Break end")}<input type="time" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
      <button disabled={busy || !staffId || !start || !end || Boolean(breakStart) !== Boolean(breakEnd)} onClick={() => void submit("/api/schedules", "PUT", { staff_id: staffId, rows: Array.from({ length: 7 }, (_, weekday) => [{ weekday, start_time: start, end_time: end, is_break: false }, ...(breakStart && breakEnd ? [{ weekday, start_time: breakStart, end_time: breakEnd, is_break: true }] : [])]).flat() })} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">{t("განრიგის შენახვა", "Save schedule")}</button>
      <p className="mt-3 text-xs text-stone-500">{t("საათები და შესვენება ყველა სამუშაო დღეზე გავრცელდება.", "Hours and breaks apply to every weekday.")}</p>
    </section>}
    {section === "time-off" && <section className="mt-6 max-w-xl rounded-2xl border bg-white p-5">
      <label className="block text-sm font-semibold">{t("სპეციალისტი ან მთელი სალონი", "Staff member or whole salon")}</label><select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">{t("მთელი სალონი", "Whole salon")}</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">{t("დაწყება", "Start")}<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{t("დასრულება", "End")}<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
      <button disabled={busy || !start || !end} onClick={() => void submit("/api/time-off", "POST", { staff_id: staffId || null, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">{t("დროის დაბლოკვა", "Block time")}</button>
      <ul className="mt-5 divide-y">{timeOff.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{item.staff_id ? staff.find((person) => person.id === item.staff_id)?.full_name : t("მთელი სალონი", "Whole salon")} · {new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</span><button onClick={() => void submit(`/api/time-off?id=${item.id}`, "DELETE", undefined)} className="shrink-0 text-rose-700">{t("წაშლა", "Remove")}</button></li>)}</ul>
    </section>}
  </main>;
}
