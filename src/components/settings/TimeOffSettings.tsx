"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button, Card, CardHeader, Chip, ChipRow, EmptyState, Field, IconButton, Input, Skeleton, useToast } from "@/components/ui";

type Staff = { id: string; full_name: string; is_active: boolean };
type TimeOff = { id: string; staff_id: string | null; starts_at: string; ends_at: string; reason: string | null };

const TZ = "Asia/Tbilisi";
// Tbilisi has no daylight saving: always UTC+4.
const OFFSET = "+04:00";

function tbilisiDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Days off and holidays, for one specialist or the whole salon. Online booking skips these times. */
export default function TimeOffSettings() {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const today = useMemo(() => tbilisiDate(new Date()), []);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [who, setWho] = useState<string>("");
  const [allDay, setAllDay] = useState(true);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("16:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [staffResponse, offResponse] = await Promise.all([fetch("/api/staff"), fetch("/api/time-off")]);
    const [staffData, offData] = await Promise.all([staffResponse.json(), offResponse.json()]);
    setStaff(((staffData.staff ?? []) as Staff[]).map((member) => ({ id: member.id, full_name: member.full_name, is_active: member.is_active })));
    setItems(offData.time_off ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const name = (id: string | null) => id ? staff.find((member) => member.id === id)?.full_name ?? t("სპეციალისტი", "Specialist") : t("მთელი სალონი", "Whole salon");
  const locale = lang === "ka" ? "ka-GE" : "en-GB";
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: TZ, day: "numeric", month: "long" }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  function when(item: TimeOff): string {
    const startDay = tbilisiDate(new Date(item.starts_at));
    const endDay = tbilisiDate(new Date(item.ends_at));
    const wholeDays = time(item.starts_at) === "00:00" && time(item.ends_at) === "23:59";
    if (wholeDays) return startDay === endDay ? day(item.starts_at) : `${day(item.starts_at)} – ${day(item.ends_at)}`;
    if (startDay === endDay) return `${day(item.starts_at)}, ${time(item.starts_at)} – ${time(item.ends_at)}`;
    return `${day(item.starts_at)} ${time(item.starts_at)} – ${day(item.ends_at)} ${time(item.ends_at)}`;
  }

  async function add() {
    const startsAt = allDay ? `${from}T00:00:00${OFFSET}` : `${from}T${startTime}:00${OFFSET}`;
    const endsAt = allDay ? `${to}T23:59:00${OFFSET}` : `${from}T${endTime}:00${OFFSET}`;
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return toast.error(t("დასრულება დაწყების შემდეგ უნდა იყოს.", "The end must be after the start."));
    setSaving(true);
    try {
      const response = await fetch("/api/time-off", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: who || null, starts_at: new Date(startsAt).toISOString(), ends_at: new Date(endsAt).toISOString(), reason: reason.trim() || null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error.split(" / ")[0] : "");
      toast.success(t("დაემატა. ამ დროს ჯავშანი აღარ მიიღება.", "Added. No bookings are taken at this time."));
      setReason("");
      await load();
    } catch (error) {
      toast.error((error instanceof Error && error.message) || t("შენახვა ვერ მოხერხდა.", "Could not save."));
    } finally { setSaving(false); }
  }

  async function remove(item: TimeOff) {
    const response = await fetch(`/api/time-off?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!response.ok) return toast.error(t("წაშლა ვერ მოხერხდა.", "Could not remove."));
    toast.success(t("წაიშალა.", "Removed."));
    await load();
  }

  const upcoming = (items ?? []).filter((item) => Date.parse(item.ends_at) >= Date.now()).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const activeStaff = staff.filter((member) => member.is_active);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("დასვენების დღეები", "Days off")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("შვებულება, დღესასწაული ან რამდენიმე საათი. ამ დროს ონლაინ ჯავშანი არ მიიღება.", "Holidays, public holidays or a few hours. No online bookings are taken then.")}</p>
      </header>

      <Card>
        <CardHeader title={t("დამატება", "Add")} />
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("ვისთვის", "For whom")}</p>
            <ChipRow className="flex-wrap">
              <Chip selected={who === ""} onClick={() => setWho("")}>{t("მთელი სალონი", "Whole salon")}</Chip>
              {activeStaff.map((member) => <Chip key={member.id} selected={who === member.id} onClick={() => setWho(member.id)}>{member.full_name}</Chip>)}
            </ChipRow>
          </div>
          <ChipRow>
            <Chip selected={allDay} onClick={() => setAllDay(true)}>{t("მთელი დღე", "Whole days")}</Chip>
            <Chip selected={!allDay} onClick={() => setAllDay(false)}>{t("რამდენიმე საათი", "A few hours")}</Chip>
          </ChipRow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {allDay ? (
              <>
                <Field label={t("დან", "From")}>{(props) => <Input {...props} type="date" min={today} value={from} onChange={(event) => { setFrom(event.target.value); if (event.target.value > to) setTo(event.target.value); }} />}</Field>
                <Field label={t("მდე (ჩათვლით)", "Until (including)")}>{(props) => <Input {...props} type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} />}</Field>
              </>
            ) : (
              <>
                <Field label={t("დღე", "Day")} className="sm:col-span-2">{(props) => <Input {...props} type="date" min={today} value={from} onChange={(event) => setFrom(event.target.value)} />}</Field>
                <Field label={t("დან", "From")}>{(props) => <Input {...props} type="time" step={900} value={startTime} onChange={(event) => setStartTime(event.target.value)} />}</Field>
                <Field label={t("მდე", "Until")}>{(props) => <Input {...props} type="time" step={900} value={endTime} onChange={(event) => setEndTime(event.target.value)} />}</Field>
              </>
            )}
            <Field label={t("მიზეზი", "Reason")} optionalLabel={t("(არასავალდებულო)", "(optional)")} className="sm:col-span-2">
              {(props) => <Input {...props} value={reason} maxLength={300} placeholder={t("მაგ. შვებულება", "e.g. Holiday")} onChange={(event) => setReason(event.target.value)} />}
            </Field>
          </div>
          <Button loading={saving} onClick={() => void add()}>{t("დამატება", "Add")}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("მომავალი დასვენებები", "Coming days off")} />
        {items === null ? <Skeleton className="h-24" /> : upcoming.length === 0 ? (
          <EmptyState icon={<CalendarOff />} title={t("დაგეგმილი დასვენება არ არის", "No days off planned")} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {upcoming.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{when(item)}</p>
                  <p className="truncate text-sm text-stone-500">{name(item.staff_id)}{item.reason ? ` · ${item.reason}` : ""}</p>
                </div>
                <IconButton label={t("წაშლა", "Remove")} onClick={() => void remove(item)}><Trash2 className="h-4 w-4" /></IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
