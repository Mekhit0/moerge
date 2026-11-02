"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type StaffItem = { id: string; full_name: string; is_active: boolean; service_ids: string[] };
type ServiceItem = { id: string; name_ka: string; name_en: string; price_gel: number; duration_minutes: number; is_active: boolean; staff_ids: string[] };
type TimeOffItem = { id: string; staff_id: string | null; starts_at: string; ends_at: string; reason: string | null };
type ScheduleItem = { weekday: number; start_time: string; end_time: string; is_break: boolean };
const weekdays = [["ორშაბათი", "Monday"], ["სამშაბათი", "Tuesday"], ["ოთხშაბათი", "Wednesday"], ["ხუთშაბათი", "Thursday"], ["პარასკევი", "Friday"], ["შაბათი", "Saturday"], ["კვირა", "Sunday"]] as const;

export default function BookingSettingsManager({ section }: { section: "staff" | "services" | "schedules" | "time-off" }) {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [nameKa, setNameKa] = useState("");
  const [price, setPrice] = useState("0");
  const [duration, setDuration] = useState("45");
  const [staffId, setStaffId] = useState("");
  const [staffServiceIds, setStaffServiceIds] = useState<string[]>([]);
  const [serviceStaffIds, setServiceStaffIds] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(async () => {
    const requests: Promise<Response>[] = [fetch("/api/staff")];
    if (section === "staff" || section === "services") requests.push(fetch("/api/services"));
    if (section === "schedules") requests.push(fetch(`/api/schedules${staffId ? `?staff_id=${staffId}` : ""}`));
    if (section === "time-off") requests.push(fetch("/api/time-off"));
    const responses = await Promise.all(requests);
    const staffData = await responses[0].json();
    const serviceData = section === "staff" || section === "services" ? await responses[1].json() : null;
    const scheduleData = section === "schedules" ? await responses[1].json() : null;
    const timeOffData = section === "time-off" ? await responses[1].json() : null;
    setStaff((staffData.staff ?? []).map((item: { id: string; full_name: string; is_active: boolean; staff_services?: Array<{ service_id: string }> }) => ({
      id: item.id, full_name: item.full_name, is_active: item.is_active,
      service_ids: (item.staff_services ?? []).map((assignment) => assignment.service_id),
    })));
    if (serviceData) setServices(serviceData.services ?? []);
    if (timeOffData) setTimeOff(timeOffData.time_off ?? []);
    if (scheduleData) {
      const rows = (scheduleData.schedules ?? []) as ScheduleItem[];
      setSchedule(rows);
      setWorkingDays([...new Set(rows.filter((row) => !row.is_break).map((row) => row.weekday))]);
      const first = rows.find((row) => !row.is_break);
      if (first) { setStart(first.start_time.slice(0, 5)); setEnd(first.end_time.slice(0, 5)); }
    }
    if (!staffId && staffData.staff?.[0]) setStaffId(staffData.staff[0].id);
  }, [section, staffId]);
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

  return <div className="space-y-5">
    <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
    {message && <p role="status" className="my-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}
    {section === "staff" && <section className="mt-6 rounded-2xl border bg-white p-5">
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit("/api/staff", "POST", { full_name: name, service_ids: staffServiceIds }); setName(""); setStaffServiceIds([]); }}>
        <div className="flex gap-2">
          <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("სახელი და გვარი", "Full name")} className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
          <button disabled={busy || (services.some((service) => service.is_active) && staffServiceIds.length === 0)} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{t("დამატება", "Add")}</button>
        </div>
        <fieldset><legend className="mb-2 text-xs font-semibold text-stone-600">{services.some((service) => service.is_active) ? t("რომელ სერვისებს ასრულებს?", "Services they perform") : t("სერვისების დამატების შემდეგ სპეციალისტსაც დაუკავშირებთ.", "You can assign services after adding them.")}</legend><div className="flex flex-wrap gap-2">
          {services.filter((service) => service.is_active).map((service) => <label key={service.id} className="rounded-lg border px-2.5 py-2 text-xs"><input type="checkbox" className="mr-1.5 accent-rose-600" checked={staffServiceIds.includes(service.id)} onChange={() => setStaffServiceIds((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])} />{service.name_ka}</label>)}
        </div></fieldset>
      </form>
      <ul className="mt-4 divide-y">{staff.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><span><span className="block">{item.full_name}</span><span className="text-xs text-stone-500">{services.filter((service) => item.service_ids.includes(service.id)).map((service) => service.name_ka).join(", ") || t("სერვისი არ არის მინიჭებული", "No services assigned")}</span></span><button onClick={() => void submit(`/api/staff?id=${item.id}`, "DELETE", undefined)} className="shrink-0 text-sm text-rose-700">{item.is_active ? t("გამორთვა", "Deactivate") : t("გამორთულია", "Inactive")}</button></li>)}</ul>
    </section>}
    {section === "services" && <section className="mt-6 rounded-2xl border bg-white p-5">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit("/api/services", "POST", { name_ka: nameKa, price_gel: Number(price), duration_minutes: Number(duration), staff_ids: serviceStaffIds }); setNameKa(""); setServiceStaffIds([]); }}>
        <input required value={nameKa} onChange={(event) => setNameKa(event.target.value)} placeholder="სახელი ქართულად" className="rounded-lg border px-3 py-2" />
        <input required type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} aria-label={t("ფასი ლარში", "Price in GEL")} className="rounded-lg border px-3 py-2" />
        <input required type="number" min="5" max="720" value={duration} onChange={(event) => setDuration(event.target.value)} aria-label={t("ხანგრძლივობა წუთებში", "Duration in minutes")} className="rounded-lg border px-3 py-2" />
        <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs font-semibold text-stone-600">{staff.some((member) => member.is_active) ? t("ვინ ასრულებს ამ სერვისს?", "Who performs this service?") : t("სპეციალისტის დამატების შემდეგ დააკავშირებთ.", "You can assign a specialist after adding one.")}</legend><div className="flex flex-wrap gap-2">
          {staff.filter((member) => member.is_active).map((member) => <label key={member.id} className="rounded-lg border px-2.5 py-2 text-xs"><input type="checkbox" className="mr-1.5 accent-rose-600" checked={serviceStaffIds.includes(member.id)} onChange={() => setServiceStaffIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} />{member.full_name}</label>)}
        </div></fieldset>
        <button disabled={busy || (staff.some((member) => member.is_active) && serviceStaffIds.length === 0)} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white sm:col-span-2 disabled:opacity-50">{t("სერვისის დამატება", "Add service")}</button>
      </form>
      <ul className="mt-4 divide-y">{services.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><span><span className="block">{item.name_ka} · {item.price_gel} ₾ · {item.duration_minutes} {t("წთ", "min")}</span><span className="text-xs text-stone-500">{staff.filter((member) => item.staff_ids?.includes(member.id)).map((member) => member.full_name).join(", ") || t("სპეციალისტი ჯერ არ არის მიბმული", "No specialist assigned yet")}</span></span><button onClick={() => void submit(`/api/services?id=${item.id}`, "DELETE", undefined)} className="shrink-0 text-sm text-rose-700">{t("გამორთვა", "Deactivate")}</button></li>)}</ul>
    </section>}
    {section === "schedules" && <section className="mt-6 max-w-xl rounded-2xl border bg-white p-5">
      <p className="mb-4 text-sm text-stone-500">{t("აირჩიეთ სპეციალისტი, მონიშნეთ სამუშაო დღეები და მიუთითეთ საათები. დროის სარტყელი: საქართველო.", "Choose a specialist, working days and hours. Time zone: Georgia.")}</p>
      <label className="block text-sm font-semibold">{t("სპეციალისტი", "Staff member")}</label><select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">{staff.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
      {schedule.length > 0 && <p className="mt-2 text-xs text-stone-500">{t("მონიშნული დღეები არსებული განრიგიდან ჩაიტვირთა.", "Selected days were loaded from the current schedule.")}</p>}
      <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">{t("სამუშაო დღეები", "Working days")}</legend><div className="flex flex-wrap gap-2">{weekdays.map(([ka, en], index) => {
        const day = (index + 1) % 7;
        const checked = workingDays.includes(day);
        return <label key={en} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs ${checked ? "border-rose-300 bg-rose-50 text-rose-800" : "border-stone-200"}`}><input type="checkbox" className="mr-1.5 accent-rose-600" checked={checked} onChange={() => setWorkingDays((current) => checked ? current.filter((item) => item !== day) : [...current, day])} />{t(ka, en)}</label>;
      })}</div></fieldset>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">{t("გახსნა", "Opens")}<input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{t("დახურვა", "Closes")}<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
      <button disabled={busy || !staffId || !start || !end || end <= start} onClick={() => void submit("/api/schedules", "PUT", { staff_id: staffId, rows: workingDays.map((weekday) => ({ weekday, start_time: start, end_time: end })) })} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{t("განრიგის შენახვა", "Save schedule")}</button>
      <p className="mt-3 text-xs text-stone-500">{t("ყველა დღე არჩეული არ არის? დატოვეთ მხოლოდ სამუშაო დღეები. ცვლილება ამ სპეციალისტის განრიგს აახლებს.", "Leave closed days unselected. Saving replaces this specialist's current schedule.")}</p>
    </section>}
    {section === "time-off" && <section className="mt-6 max-w-xl rounded-2xl border bg-white p-5">
      <label className="block text-sm font-semibold">{t("სპეციალისტი ან მთელი სალონი", "Staff member or whole salon")}</label><select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">{t("მთელი სალონი", "Whole salon")}</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">{t("დაწყება", "Start")}<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="text-sm">{t("დასრულება", "End")}<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
      <button disabled={busy || !start || !end} onClick={() => void submit("/api/time-off", "POST", { staff_id: staffId || null, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">{t("დროის დაბლოკვა", "Block time")}</button>
      <ul className="mt-5 divide-y">{timeOff.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{item.staff_id ? staff.find((person) => person.id === item.staff_id)?.full_name : t("მთელი სალონი", "Whole salon")} · {new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</span><button onClick={() => void submit(`/api/time-off?id=${item.id}`, "DELETE", undefined)} className="shrink-0 text-rose-700">{t("წაშლა", "Remove")}</button></li>)}</ul>
    </section>}
  </div>;
}
