"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Move, Plus, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatLongDate, shortDayLabels } from "@/lib/dates";
import {
  addDays, blockStyle, closedIntervals, minutesToTime, snap, tbilisiIso, tbilisiParts, toMinutes, visibleRange, weekDays, weekdayOf,
  workingIntervals, type Interval, type WorkingHoursRow,
} from "@/lib/calendar-layout";
import { Alert, Button, Chip, ChipRow, Dialog, EmptyState, Skeleton, StatusBadge, Tabs, cn, useToast } from "@/components/ui";
import { VisitSheet } from "@/components/visits/VisitSheet";
import { NewBookingSheet, type BookingClient, type BookingDefaults, type BookingService, type BookingStaff, type TimeOffBlock } from "@/components/visits/NewBookingSheet";
import type { Visit } from "@/components/visits/types";

type View = "day" | "week";
type CalendarVisit = Visit & { staff_id: string; ends_at: string };
type RangeData = { visits: CalendarVisit[]; timeOff: TimeOffBlock[]; hours: WorkingHoursRow[] };
type Column = { key: string; date: string; staffId: string; label: string; sublabel?: string; color?: string | null };
type DragState = { visit: CalendarVisit; startX: number; startY: number; dragging: boolean; target: { date: string; staffId: string; minutes: number } | null };

const MOVABLE: Visit["status"][] = ["scheduled", "arrived"];

/** Picks the Georgian or English half of an API message written as "ქართული / English". */
function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "ka" ? ka : en ?? ka;
}

function useIsWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * The salon calendar. Day view shows one column per master in the salon's real hours; week view shows
 * one master across seven days. Tap a free slot to book or block it, tap a visit to act on it, drag a
 * visit with a mouse or use Move then tap a slot to reschedule. Only the visible days are loaded.
 */
export default function CalendarView({ today, timezone, staff, services, salonHours, canManage, initialDate, initialView = "day", initialBooking }: {
  today: string;
  timezone: string;
  staff: BookingStaff[];
  services: BookingService[];
  salonHours: Interval;
  canManage: boolean;
  initialDate: string;
  initialView?: View;
  initialBooking: (BookingDefaults & { clientId?: string }) | null;
}) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const wide = useIsWide();
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState(initialDate);
  const [focusStaff, setFocusStaff] = useState<string>("");
  const [data, setData] = useState<RangeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDefaults | null>(null);
  const [moving, setMoving] = useState<CalendarVisit | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [blockToRemove, setBlockToRemove] = useState<TimeOffBlock | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const cache = useRef(new Map<string, RangeData>());
  const suppressClick = useRef(false);

  const days = useMemo(() => (view === "day" ? [date] : weekDays(date)), [view, date]);
  const rangeKey = `${days[0]}|${days[days.length - 1]}`;

  // Masters shown: on phones always one; in week view always one; otherwise all or the chosen one.
  const singleStaffId = focusStaff || staff[0]?.id || "";
  const needsSingle = !wide || view === "week";
  const visibleStaff = needsSingle ? staff.filter((member) => member.id === singleStaffId) : focusStaff ? staff.filter((member) => member.id === focusStaff) : staff;

  const load = useCallback(async (from: string, to: string, options: { quiet?: boolean } = {}) => {
    const key = `${from}|${to}`;
    try {
      const response = await fetch(`/api/calendar?from=${from}&to=${to}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Error");
      const next = { visits: result.visits, timeOff: result.timeOff, hours: result.hours } as RangeData;
      cache.current.set(key, next);
      if (!options.quiet) { setData(next); setError(null); }
      return next;
    } catch (caught) {
      if (!options.quiet) setError(localMessage(caught instanceof Error ? caught.message : "Error", lang));
      return null;
    }
  }, [lang]);

  // Show cached data instantly, then refresh; prefetch the neighbours in day view.
  useEffect(() => {
    const [from, to] = rangeKey.split("|");
    const cached = cache.current.get(rangeKey);
    setData(cached ?? null);
    void load(from, to);
    if (view === "day") {
      for (const neighbour of [addDays(from, 1), addDays(from, -1)]) {
        if (!cache.current.has(`${neighbour}|${neighbour}`)) void load(neighbour, neighbour, { quiet: true });
      }
    }
  }, [rangeKey, view, load]);

  // Keep the chosen day and view in the address bar, so a reload or a shared link opens the same place.
  useEffect(() => {
    window.history.replaceState(null, "", `/appointments?date=${date}${view === "week" ? "&view=week" : ""}`);
  }, [date, view]);

  useEffect(() => {
    const tick = () => {
      const parts = tbilisiParts(new Date().toISOString());
      setNowMinutes(parts.date === today ? parts.minutes : null);
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [today]);

  // Booking requested from another screen (?new=1).
  useEffect(() => {
    if (!initialBooking) return;
    const { clientId, ...defaults } = initialBooking;
    if (!clientId) { setBooking(defaults); return; }
    fetch(`/api/clients/${clientId}`).then((response) => response.json()).then((result) => {
      const client = result.client as BookingClient | undefined;
      setBooking({ ...defaults, client: client ? { id: client.id, full_name: client.full_name, phone: client.phone } : null });
    }).catch(() => setBooking(defaults));
  }, [initialBooking]);

  const visits = data?.visits ?? [];
  const hours = data?.hours ?? [];

  const columns: Column[] = view === "day"
    ? visibleStaff.map((member) => ({ key: member.id, date, staffId: member.id, label: member.full_name, color: member.color }))
    : days.map((day) => {
        const labels = shortDayLabels(day, lang);
        return { key: day, date: day, staffId: singleStaffId, label: day === today ? t("დღეს", "Today") : labels.weekday, sublabel: `${labels.day} ${labels.month}` };
      });

  const visitInterval = (visit: CalendarVisit) => {
    const start = tbilisiParts(visit.starts_at).minutes;
    return { start, end: Math.max(start + 15, tbilisiParts(visit.ends_at).minutes || start + 15) };
  };

  const range = visibleRange({
    rows: hours,
    staffIds: columns.map((column) => column.staffId),
    weekdays: Array.from(new Set(columns.map((column) => weekdayOf(column.date)))),
    visits: visits.filter((visit) => columns.some((column) => column.staffId === visit.staff_id && column.date === visit.treatment_date)).map(visitInterval),
    fallback: salonHours,
  });
  const pxPerMinute = wide ? 1.6 : 1.4;
  const gridHeight = (range.end - range.start) * pxPerMinute;
  const hourMarks = Array.from({ length: (range.end - range.start) / 60 + 1 }, (_, index) => range.start + index * 60);

  const replaceVisit = (updated: CalendarVisit) => {
    setData((current) => current && { ...current, visits: current.visits.map((visit) => (visit.id === updated.id ? updated : visit)) });
    cache.current.clear();
  };

  async function moveTo(visit: CalendarVisit, target: { date: string; staffId: string; minutes: number }, options: { isUndo?: boolean } = {}) {
    const duration = Math.max(15, Math.round((new Date(visit.ends_at).getTime() - new Date(visit.starts_at).getTime()) / 60000));
    const time = minutesToTime(target.minutes);
    if (visit.treatment_date === target.date && visit.staff_id === target.staffId && visit.starts_at === tbilisiIso(target.date, target.minutes)) return;
    const member = staff.find((item) => item.id === target.staffId);
    const optimistic: CalendarVisit = {
      ...visit,
      treatment_date: target.date,
      treatment_time: `${time}:00`,
      starts_at: tbilisiIso(target.date, target.minutes),
      ends_at: tbilisiIso(target.date, target.minutes + duration),
      staff_id: target.staffId,
      staff: member ? { id: member.id, full_name: member.full_name, color: member.color } : visit.staff,
    };
    replaceVisit(optimistic);
    try {
      const response = await fetch(`/api/appointments/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatment_date: target.date, treatment_time: time, staff_id: target.staffId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        replaceVisit(visit);
        toast.error(response.status === 409
          ? t("ეს დრო დაკავებულია ან არასამუშაო დროა.", "That time is taken or outside working hours.")
          : localMessage(String(result.error ?? t("გადატანა ვერ მოხერხდა.", "Could not move the visit.")), lang));
        return;
      }
      if (options.isUndo) return;
      const label = `${member?.full_name ?? ""} · ${time}`;
      toast.show(t(`გადატანილია · ${label}`, `Moved · ${label}`), {
        tone: "success",
        action: { label: t("დაბრუნება", "Undo"), onClick: () => void moveTo(optimistic, { date: visit.treatment_date, staffId: visit.staff_id, minutes: tbilisiParts(visit.starts_at).minutes }, { isUndo: true }) },
      });
    } catch {
      replaceVisit(visit);
      toast.error(t("ქსელური შეცდომა. სცადეთ თავიდან.", "Network error. Please try again."));
    }
  }

  function minutesFromPointer(element: HTMLElement, clientY: number) {
    const rect = element.getBoundingClientRect();
    return Math.min(range.end - 15, Math.max(range.start, range.start + (clientY - rect.top) / pxPerMinute));
  }

  function onColumnClick(column: Column, event: React.MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const minutes = Math.floor(minutesFromPointer(event.currentTarget, event.clientY) / 15) * 15;
    if (moving) {
      const target = { date: column.date, staffId: column.staffId, minutes };
      setMoving(null);
      void moveTo(moving, target);
      return;
    }
    setBooking({ date: column.date, time: minutesToTime(minutes), staffId: column.staffId });
  }

  // Mouse drag to move (touch uses Move then tap, so scrolling stays smooth on tablets).
  function onVisitPointerDown(visit: CalendarVisit, event: React.PointerEvent) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !MOVABLE.includes(visit.status)) return;
    setDrag({ visit, startX: event.clientX, startY: event.clientY, dragging: false, target: null });
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const moved = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5;
      if (!moved && !drag.dragging) return;
      const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-col]");
      if (!element) { setDrag((current) => current && { ...current, dragging: true, target: null }); return; }
      const grab = tbilisiParts(drag.visit.starts_at).minutes;
      const offset = (drag.startY - (element.getBoundingClientRect().top + (grab - range.start) * pxPerMinute)) / pxPerMinute;
      const minutes = snap(minutesFromPointer(element, event.clientY) - Math.max(0, offset));
      setDrag((current) => current && { ...current, dragging: true, target: { date: element.dataset.date!, staffId: element.dataset.staff!, minutes } });
    };
    const onUp = () => {
      setDrag((current) => {
        if (current?.dragging) {
          suppressClick.current = true;
          window.setTimeout(() => { suppressClick.current = false; }, 0);
          if (current.target) void moveTo(current.visit, current.target);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // moveTo and range are stable enough for one drag gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.visit.id, drag?.startX, drag?.startY]);

  async function removeBlock(block: TimeOffBlock) {
    setBlockToRemove(null);
    setData((current) => current && { ...current, timeOff: current.timeOff.filter((item) => item.id !== block.id) });
    const response = await fetch(`/api/time-off?id=${block.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setData((current) => current && { ...current, timeOff: [...current.timeOff, block] });
      toast.error(t("დაბლოკვის მოხსნა ვერ მოხერხდა.", "Could not remove the block."));
      return;
    }
    cache.current.clear();
    toast.success(t("დაბლოკვა მოიხსნა.", "Block removed."));
  }

  const step = view === "day" ? 1 : 7;
  const heading = view === "day"
    ? formatLongDate(date, lang)
    : (() => { const first = shortDayLabels(days[0], lang); const last = shortDayLabels(days[6], lang); return `${first.day} ${first.month} · ${last.day} ${last.month}`; })();
  const openVisit = visits.find((visit) => visit.id === openVisitId) ?? null;

  if (staff.length === 0) {
    return <EmptyState icon={<Plus />} title={t("ჯერ დაამატეთ სპეციალისტები.", "Add your specialists first.")}
      text={t("კალენდარი სპეციალისტების მიხედვით ჩანს.", "The calendar shows one column per specialist.")}
      action={<Button onClick={() => window.location.assign("/settings/staff")}>{t("სპეციალისტის დამატება", "Add a specialist")}</Button>} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="w-11 px-0" aria-label={t("წინა", "Previous")} onClick={() => setDate(addDays(date, -step))}><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="secondary" onClick={() => setDate(today)} disabled={days.includes(today)}>{t("დღეს", "Today")}</Button>
          <Button variant="secondary" className="w-11 px-0" aria-label={t("შემდეგი", "Next")} onClick={() => setDate(addDays(date, step))}><ChevronRight className="h-5 w-5" /></Button>
          <h1 className="ml-1 text-lg font-bold text-stone-900 sm:text-xl">{heading}</h1>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <Tabs label={t("ხედი", "View")} value={view} onChange={setView} items={[{ value: "day", label: t("დღე", "Day") }, { value: "week", label: t("კვირა", "Week") }]} />
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => setBooking({ date, staffId: needsSingle ? singleStaffId : focusStaff || undefined })}>{t("ჯავშანი", "Book")}</Button>
        </div>
      </div>

      <ChipRow>
        {!needsSingle && <Chip selected={!focusStaff} onClick={() => setFocusStaff("")}>{t("ყველა", "Everyone")}</Chip>}
        {staff.map((member) => (
          <Chip key={member.id} dotColor={member.color ?? undefined} selected={needsSingle ? member.id === singleStaffId : focusStaff === member.id}
            onClick={() => setFocusStaff(member.id)}>{member.full_name}</Chip>
        ))}
      </ChipRow>

      {moving && (
        <div role="status" className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:top-2">
          <span className="flex items-center gap-2"><Move className="h-4 w-4 shrink-0" />{t(`აირჩიეთ ახალი დრო: ${moving.client?.full_name ?? ""}`, `Tap the new time for ${moving.client?.full_name ?? ""}`)}</span>
          <button type="button" onClick={() => setMoving(null)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 font-semibold hover:bg-amber-100"><X className="h-4 w-4" />{t("გაუქმება", "Cancel")}</button>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {!wide && view === "week" ? (
        <WeekAgenda days={days} visits={visits.filter((visit) => visit.staff_id === singleStaffId)} timezone={timezone} today={today} loading={!data}
          onOpen={(visit) => setOpenVisitId(visit.id)} />
      ) : (
        <div className="overflow-auto rounded-2xl border border-stone-200 bg-white" style={{ maxHeight: "calc(100dvh - 15rem)" }}>
          {/* Column headers */}
          <div className="sticky top-0 z-20 flex border-b border-stone-200 bg-white">
            <div className="sticky left-0 z-10 w-14 shrink-0 bg-white" />
            {columns.map((column) => (
              <div key={column.key} className={cn("flex min-w-[150px] flex-1 items-center justify-center gap-2 border-l border-stone-100 px-2 py-3 text-sm font-semibold", column.date === today && view === "week" ? "text-brand" : "text-stone-800")}>
                {column.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />}
                <span className="truncate">{column.label}</span>
                {column.sublabel && <span className="font-normal text-stone-500">{column.sublabel}</span>}
              </div>
            ))}
          </div>

          <div className="relative flex" style={{ height: gridHeight }}>
            {/* Hour labels */}
            <div className="sticky left-0 z-10 w-14 shrink-0 bg-white">
              {hourMarks.slice(0, -1).map((minute) => (
                <span key={minute} className="absolute right-2 -translate-y-2 text-xs font-medium text-stone-400" style={{ top: (minute - range.start) * pxPerMinute }}>
                  {minute === range.start ? "" : minutesToTime(minute)}
                </span>
              ))}
            </div>

            {columns.map((column) => {
              const open = workingIntervals(hours, column.staffId, weekdayOf(column.date));
              const closed = closedIntervals(range, open);
              const blocks = (data?.timeOff ?? []).filter((block) => !block.staff_id || block.staff_id === column.staffId).map((block) => {
                const start = tbilisiParts(block.starts_at);
                const end = tbilisiParts(block.ends_at);
                if (start.date > column.date || end.date < column.date) return null;
                return { block, interval: { start: start.date < column.date ? range.start : start.minutes, end: end.date > column.date ? range.end : end.minutes } };
              }).filter(Boolean) as Array<{ block: TimeOffBlock; interval: Interval }>;
              const columnVisits = visits.filter((visit) => visit.staff_id === column.staffId && visit.treatment_date === column.date);
              const ghost = drag?.dragging && drag.target && drag.target.date === column.date && drag.target.staffId === column.staffId ? drag.target : null;
              const ghostDuration = drag ? visitInterval(drag.visit).end - visitInterval(drag.visit).start : 0;

              return (
                <div key={column.key} data-col data-date={column.date} data-staff={column.staffId}
                  onClick={(event) => onColumnClick(column, event)}
                  className={cn("relative min-w-[150px] flex-1 cursor-pointer border-l border-stone-100", moving && "bg-amber-50/40")}>
                  {hourMarks.slice(1, -1).map((minute) => (
                    <div key={minute} className="pointer-events-none absolute inset-x-0 border-t border-stone-100" style={{ top: (minute - range.start) * pxPerMinute }} />
                  ))}
                  {closed.map((interval) => (
                    <div key={`closed-${interval.start}`} className="pointer-events-none absolute inset-x-0 bg-stone-100/80" style={blockStyle(interval, range, pxPerMinute, 0)} />
                  ))}
                  {blocks.map(({ block, interval }) => (
                    <button key={block.id} type="button" disabled={!canManage}
                      onClick={(event) => { event.stopPropagation(); if (canManage) setBlockToRemove(block); }}
                      className="absolute inset-x-1 z-[1] flex items-start gap-1 overflow-hidden rounded-lg border border-stone-300 px-2 py-1 text-left text-xs text-stone-600 [background:repeating-linear-gradient(135deg,#f5f5f4,#f5f5f4_6px,#e7e5e4_6px,#e7e5e4_12px)]"
                      style={blockStyle(interval, range, pxPerMinute)}>
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" /><span className="truncate">{block.reason || t("დაბლოკილი", "Blocked")}</span>
                    </button>
                  ))}
                  {column.date === today && nowMinutes !== null && nowMinutes >= range.start && nowMinutes <= range.end && (
                    <div className="pointer-events-none absolute inset-x-0 z-[3] border-t-2 border-brand" style={{ top: (nowMinutes - range.start) * pxPerMinute }}>
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-brand" />
                    </div>
                  )}
                  {columnVisits.map((visit) => {
                    const interval = visitInterval(visit);
                    const style = blockStyle(interval, range, pxPerMinute);
                    const color = visit.staff?.color || "#e11d48";
                    const paid = Boolean(visit.payment && !visit.payment.voided_at);
                    const isDragged = drag?.dragging && drag.visit.id === visit.id;
                    return (
                      <button key={visit.id} type="button"
                        onPointerDown={(event) => onVisitPointerDown(visit, event)}
                        onClick={(event) => { event.stopPropagation(); if (suppressClick.current) return; if (moving) { setMoving(null); return; } setOpenVisitId(visit.id); }}
                        className={cn(
                          "absolute inset-x-1 z-[2] overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-xs shadow-xs transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                          visit.status === "no_show" && "opacity-50 line-through",
                          isDragged && "opacity-40",
                          moving?.id === visit.id && "ring-2 ring-amber-400",
                          MOVABLE.includes(visit.status) && "md:cursor-grab"
                        )}
                        style={{ ...style, borderLeftColor: color, backgroundColor: `${color}1f` }}>
                        <span className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-stone-900">{minutesToTime(interval.start)}</span>
                          {paid ? <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">₾</span>
                            : visit.status !== "scheduled" && <StatusBadge status={visit.status} className="px-1.5 py-0 text-[10px]" />}
                        </span>
                        <span className="block truncate font-semibold text-stone-800">{visit.client?.full_name ?? t("კლიენტი", "Client")}</span>
                        {style.height > 52 && <span className="block truncate text-stone-600">{visit.service_name || visit.treatment_type}</span>}
                      </button>
                    );
                  })}
                  {ghost && (
                    <div className="pointer-events-none absolute inset-x-1 z-[4] rounded-lg border-2 border-dashed border-brand bg-brand-soft/70 px-2 py-1 text-xs font-semibold text-brand-strong"
                      style={blockStyle({ start: ghost.minutes, end: ghost.minutes + ghostDuration }, range, pxPerMinute)}>
                      {minutesToTime(ghost.minutes)}
                    </div>
                  )}
                </div>
              );
            })}
            {!data && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col gap-3 bg-white/60 p-6 pl-20">
                <Skeleton className="h-16 w-1/3" /><Skeleton className="h-24 w-1/2" /><Skeleton className="h-16 w-1/4" />
              </div>
            )}
          </div>
        </div>
      )}

      <VisitSheet visit={openVisit} timezone={timezone} canVoid={canManage} onClose={() => setOpenVisitId(null)}
        onUpdate={(updated) => replaceVisit({ ...(openVisit as CalendarVisit), ...updated })}
        onMove={(visit) => { setOpenVisitId(null); setMoving(visit as CalendarVisit); toast.show(t("შეეხეთ ახალ დროს კალენდარში.", "Tap the new time in the calendar."), { tone: "info" }); }} />

      <NewBookingSheet open={Boolean(booking)} defaults={booking ?? { date }} services={services} staff={staff} canBlock={canManage}
        onClose={() => setBooking(null)}
        onCreated={(visit) => {
          cache.current.clear();
          const created = visit as CalendarVisit;
          if (days.includes(created.treatment_date)) setData((current) => current && { ...current, visits: [...current.visits, created] });
          else setDate(created.treatment_date);
        }}
        onBlocked={(block) => { cache.current.clear(); setData((current) => current && { ...current, timeOff: [...current.timeOff, block] }); }} />

      <Dialog open={Boolean(blockToRemove)} onClose={() => setBlockToRemove(null)} title={t("დაბლოკვის მოხსნა?", "Remove this block?")}
        footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setBlockToRemove(null)}>{t("არა", "No")}</Button><Button variant="danger" onClick={() => blockToRemove && void removeBlock(blockToRemove)}>{t("მოხსნა", "Remove")}</Button></div>}>
        <p className="text-sm text-stone-600">{t("ეს დრო ისევ ხელმისაწვდომი გახდება ჯავშნებისთვის.", "This time will be open for bookings again.")}</p>
      </Dialog>
    </div>
  );
}

/** Phone week view: one master's visits listed by day. */
function WeekAgenda({ days, visits, timezone, today, loading, onOpen }: {
  days: string[]; visits: CalendarVisit[]; timezone: string; today: string; loading: boolean; onOpen: (visit: CalendarVisit) => void;
}) {
  const { lang, t } = useLanguage();
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16" />)}</div>;
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayVisits = visits.filter((visit) => visit.treatment_date === day);
        return (
          <section key={day}>
            <h2 className={cn("mb-2 text-sm font-semibold", day === today ? "text-brand" : "text-stone-600")}>{formatLongDate(day, lang)}</h2>
            {dayVisits.length === 0 ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-stone-400">{t("ვიზიტები არ არის", "No visits")}</p> : (
              <ul className="space-y-2">
                {dayVisits.map((visit) => (
                  <li key={visit.id}>
                    <button type="button" onClick={() => onOpen(visit)} className="flex w-full min-h-14 items-center gap-3 rounded-xl border border-stone-100 bg-white px-3 py-2 text-left"
                      style={{ borderLeftWidth: 4, borderLeftColor: visit.staff?.color || "#e11d48" }}>
                      <span className="w-12 shrink-0 font-bold text-stone-900">{time(visit.starts_at)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{visit.client?.full_name}</span>
                        <span className="block truncate text-xs text-stone-500">{visit.service_name || visit.treatment_type}</span>
                      </span>
                      <StatusBadge status={visit.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
