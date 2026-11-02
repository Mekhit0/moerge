"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clock, Copy } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button, Card, Chip, ChipRow, EmptyState, Skeleton, cn, useToast } from "@/components/ui";

type Staff = { id: string; full_name: string; is_active: boolean };
type Row = { weekday: number; start_time: string; end_time: string; is_break: boolean };
type Day = { on: boolean; start: string; end: string; breakOn: boolean; breakStart: string; breakEnd: string };

// Weekdays as the database stores them: 0 is Sunday. Shown Monday first.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES: Record<number, { ka: string; en: string }> = {
  1: { ka: "ორშაბათი", en: "Monday" }, 2: { ka: "სამშაბათი", en: "Tuesday" }, 3: { ka: "ოთხშაბათი", en: "Wednesday" },
  4: { ka: "ხუთშაბათი", en: "Thursday" }, 5: { ka: "პარასკევი", en: "Friday" }, 6: { ka: "შაბათი", en: "Saturday" }, 0: { ka: "კვირა", en: "Sunday" },
};
const DEFAULT_DAY: Day = { on: true, start: "10:00", end: "19:00", breakOn: false, breakStart: "14:00", breakEnd: "15:00" };

function fromRows(rows: Row[]): Record<number, Day> {
  const days: Record<number, Day> = {};
  for (const weekday of ORDER) {
    const work = rows.find((row) => row.weekday === weekday && !row.is_break);
    const rest = rows.find((row) => row.weekday === weekday && row.is_break);
    days[weekday] = work
      ? { on: true, start: work.start_time.slice(0, 5), end: work.end_time.slice(0, 5), breakOn: Boolean(rest), breakStart: rest?.start_time.slice(0, 5) ?? "14:00", breakEnd: rest?.end_time.slice(0, 5) ?? "15:00" }
      : { ...DEFAULT_DAY, on: rows.length === 0 && weekday !== 0 };
  }
  return days;
}

const timeClass = "min-h-11 w-[6.5rem] rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400";

/** Working hours per specialist: each day on or off, its hours and an optional break. */
export default function ScheduleSettings() {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [staffId, setStaffId] = useState("");
  const [days, setDays] = useState<Record<number, Day> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/staff").then((response) => response.json()).then((data) => {
      const active = ((data.staff ?? []) as Staff[]).filter((member) => member.is_active);
      setStaff(active);
      if (active[0]) setStaffId(active[0].id);
    });
  }, []);

  const loadDays = useCallback(async (id: string) => {
    setDays(null);
    const response = await fetch(`/api/schedules?staff_id=${encodeURIComponent(id)}`);
    const data = await response.json();
    setDays(fromRows((data.schedules ?? []) as Row[]));
  }, []);
  useEffect(() => { if (staffId) void loadDays(staffId); }, [staffId, loadDays]);

  const setDay = (weekday: number, change: Partial<Day>) => setDays((current) => current && { ...current, [weekday]: { ...current[weekday], ...change } });

  function copyToAll() {
    if (!days) return;
    const first = ORDER.map((weekday) => days[weekday]).find((day) => day.on);
    if (!first) return;
    setDays(Object.fromEntries(ORDER.map((weekday) => [weekday, days[weekday].on ? { ...first, on: true } : days[weekday]])));
    toast.success(t("საათები გადავიდა ყველა სამუშაო დღეზე.", "Hours copied to every working day."));
  }

  function problem(): string | null {
    if (!days) return null;
    for (const weekday of ORDER) {
      const day = days[weekday];
      if (!day.on) continue;
      const name = DAY_NAMES[weekday][lang];
      if (day.end <= day.start) return t(`${name}: დასრულება დაწყების შემდეგ უნდა იყოს.`, `${name}: the end must be after the start.`);
      if (day.breakOn && (day.breakEnd <= day.breakStart || day.breakStart < day.start || day.breakEnd > day.end)) {
        return t(`${name}: შესვენება სამუშაო საათებში უნდა იყოს.`, `${name}: the break must be within working hours.`);
      }
    }
    return null;
  }

  async function save() {
    if (!days || !staffId) return;
    const found = problem();
    if (found) return toast.error(found);
    setSaving(true);
    try {
      const rows = ORDER.flatMap((weekday) => {
        const day = days[weekday];
        if (!day.on) return [];
        const work = { weekday, start_time: day.start, end_time: day.end, is_break: false };
        return day.breakOn ? [work, { weekday, start_time: day.breakStart, end_time: day.breakEnd, is_break: true }] : [work];
      });
      const response = await fetch("/api/schedules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: staffId, rows }) });
      if (!response.ok) throw new Error();
      toast.success(t("სამუშაო საათები შენახულია.", "Working hours saved."));
    } catch {
      toast.error(t("შენახვა ვერ მოხერხდა.", "Could not save."));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("სამუშაო საათები", "Working hours")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("როდის მუშაობს თითოეული სპეციალისტი. ონლაინ ჯავშანი მხოლოდ ამ დროს ჩანს.", "When each specialist works. Online booking shows only these times.")}</p>
      </header>

      {staff === null ? <Skeleton className="h-64" /> : staff.length === 0 ? (
        <Card><EmptyState icon={<Clock />} title={t("ჯერ სპეციალისტი დაამატეთ", "Add a specialist first")} text={t("საათები თითოეულ სპეციალისტს ცალკე აქვს.", "Each specialist has their own hours.")} /></Card>
      ) : (
        <>
          {staff.length > 1 && <ChipRow>{staff.map((member) => <Chip key={member.id} selected={member.id === staffId} onClick={() => setStaffId(member.id)}>{member.full_name}</Chip>)}</ChipRow>}
          <Card>
            {days === null ? <Skeleton className="h-64" /> : (
              <>
                <ul className="divide-y divide-stone-100">
                  {ORDER.map((weekday) => {
                    const day = days[weekday];
                    return (
                      <li key={weekday} className="py-3 first:pt-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex min-h-11 w-36 shrink-0 items-center gap-3">
                            <input type="checkbox" role="switch" className="h-6 w-6 accent-rose-600" checked={day.on} onChange={(event) => setDay(weekday, { on: event.target.checked })} />
                            <span className={cn("font-semibold", day.on ? "text-stone-900" : "text-stone-400")}>{DAY_NAMES[weekday][lang]}</span>
                          </label>
                          {day.on ? (
                            <div className="flex items-center gap-2">
                              <input type="time" step={900} aria-label={t("დაწყება", "Start")} className={timeClass} value={day.start} onChange={(event) => setDay(weekday, { start: event.target.value })} />
                              <span className="text-stone-400">–</span>
                              <input type="time" step={900} aria-label={t("დასრულება", "End")} className={timeClass} value={day.end} onChange={(event) => setDay(weekday, { end: event.target.value })} />
                            </div>
                          ) : <span className="text-sm text-stone-400">{t("დასვენების დღე", "Day off")}</span>}
                        </div>
                        {day.on && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:pl-40">
                            <label className="flex min-h-11 items-center gap-2 text-sm text-stone-600">
                              <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={day.breakOn} onChange={(event) => setDay(weekday, { breakOn: event.target.checked })} />
                              {t("შესვენება", "Break")}
                            </label>
                            {day.breakOn && <div className="flex items-center gap-2">
                              <input type="time" step={900} aria-label={t("შესვენების დაწყება", "Break start")} className={timeClass} value={day.breakStart} onChange={(event) => setDay(weekday, { breakStart: event.target.value })} />
                              <span className="text-stone-400">–</span>
                              <input type="time" step={900} aria-label={t("შესვენების დასრულება", "Break end")} className={timeClass} value={day.breakEnd} onChange={(event) => setDay(weekday, { breakEnd: event.target.value })} />
                            </div>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-between">
                  <Button variant="secondary" icon={<Copy className="h-4 w-4 text-brand" />} onClick={copyToAll}>{t("პირველი დღის საათები ყველა დღეზე", "Use the first day's hours for all")}</Button>
                  <Button loading={saving} onClick={() => void save()}>{t("შენახვა", "Save")}</Button>
                </div>
              </>
            )}
          </Card>
          <p className="text-xs text-stone-500">{t("ერთჯერადი დასვენება ან შვებულება: ჩანართი „დასვენება“.", "One-off days off or holidays: the Days off tab.")}</p>
        </>
      )}
    </div>
  );
}
