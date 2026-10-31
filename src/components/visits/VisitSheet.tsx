"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Phone, RotateCcw, UserCheck, UserX, Wallet, XCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatLongDate } from "@/lib/dates";
import { formatGel, type PaymentBreakdown } from "@/lib/visit-flow";
import { formatBookingCode } from "@/lib/booking-code";
import { Alert, Button, ButtonLink, Field, Input, Sheet, StatusBadge, useToast } from "@/components/ui";
import { PaymentForm } from "./PaymentForm";
import type { Visit, VisitPayment } from "./types";

type View = "details" | "pay" | "cancel" | "void";

export function timeOfVisit(visit: Visit, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(visit.starts_at));
}

/** Calls the visit API and returns the error message, or null when it worked. */
async function send(url: string, method: "POST" | "DELETE", body: unknown): Promise<{ error: string | null; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return { error: response.ok ? null : (data.error as string) ?? "Error", data };
  } catch {
    return { error: "ქსელური შეცდომა. სცადეთ თავიდან. / Network error. Please try again.", data: {} };
  }
}

/** Picks the Georgian or English half of an API message written as "ქართული / English". */
function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "ka" ? ka : en ?? ka;
}

/**
 * One visit: who, what, when, and the next step for its status.
 * booked: Arrived (main), Done and pay, No-show, Cancel
 * arrived: Done and pay (main), back to booked, No-show
 * done, unpaid: Take payment (main), back to arrived
 * done, paid: payment summary, undo payment (owner and admin)
 * no-show or canceled: restore
 */
export function VisitSheet({ visit, timezone, canVoid, office = true, startWith = "details", onClose, onUpdate, onMove }: {
  visit: Visit | null;
  timezone: string;
  canVoid: boolean;
  /** Owner or admin. Masters (false) mark arrived, done and no-show only; payment, cancel and move stay with the office. */
  office?: boolean;
  startWith?: View;
  onClose: () => void;
  onUpdate: (visit: Visit) => void;
  /** When given (on the calendar), "Move" picks a new time right there instead of opening the calendar. */
  onMove?: (visit: Visit) => void;
}) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [view, setView] = useState<View>(startWith);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    setView(startWith);
    setError(null);
    setVoidReason("");
  }, [visit?.id, startWith]);

  if (!visit) return <Sheet open={false} onClose={onClose} title=""><span /></Sheet>;
  const current = visit;
  const price = Number(current.price_gel ?? 0);
  const payment = current.payment && !current.payment.voided_at ? current.payment : null;

  const statusDone: Record<string, string> = {
    arrived: t("მონიშნულია: მოვიდა.", "Marked as arrived."),
    completed: t("ვიზიტი დასრულდა.", "Visit marked as done."),
    no_show: t("მონიშნულია: არ მოვიდა.", "Marked as no-show."),
    canceled: t("ვიზიტი გაუქმდა.", "Visit canceled."),
    scheduled: t("ვიზიტი აღდგა.", "Visit restored."),
  };

  async function changeStatus(next: Visit["status"], options: { undoTo?: Visit["status"] } = {}) {
    const previous = current;
    onUpdate({ ...current, status: next });
    setBusy(next);
    setError(null);
    const { error: apiError } = await send(`/api/appointments/${current.id}/status`, "POST", { status: next });
    setBusy(null);
    if (apiError) {
      onUpdate(previous);
      toast.error(localMessage(apiError, lang));
      return;
    }
    const undoTo = options.undoTo;
    toast.show(statusDone[next] ?? t("შენახულია.", "Saved."), {
      tone: "success",
      action: undoTo ? { label: t("დაბრუნება", "Undo"), onClick: () => void undo(previous, undoTo) } : undefined,
    });
    router.refresh();
  }

  async function undo(previous: Visit, status: Visit["status"]) {
    const { error: apiError } = await send(`/api/appointments/${previous.id}/status`, "POST", { status });
    if (apiError) { toast.error(localMessage(apiError, lang)); return; }
    onUpdate(previous);
    router.refresh();
  }

  async function takePayment(breakdown: PaymentBreakdown) {
    setBusy("pay");
    setError(null);
    const { error: apiError, data } = await send(`/api/appointments/${current.id}/payment`, "POST", {
      price_gel: breakdown.price,
      discount_gel: breakdown.discount,
      tip_gel: breakdown.tip,
      cash_gel: breakdown.cash,
      card_gel: breakdown.card,
    });
    setBusy(null);
    if (apiError) {
      // The visit may already be marked done even if the payment failed.
      if (data.visit && typeof data.visit === "object") onUpdate({ ...current, status: (data.visit as { status: Visit["status"] }).status });
      setError(localMessage(apiError, lang));
      return;
    }
    onUpdate({ ...current, status: "completed", payment: data.payment as VisitPayment });
    toast.success(t(`გადახდა მიღებულია · ${formatGel(breakdown.collect, lang)}`, `Payment received · ${formatGel(breakdown.collect, lang)}`));
    setView("details");
    router.refresh();
  }

  async function voidPayment() {
    if (!payment) return;
    setBusy("void");
    const { error: apiError } = await send(`/api/appointments/${current.id}/payment`, "DELETE", { payment_id: payment.id, reason: voidReason });
    setBusy(null);
    if (apiError) { setError(localMessage(apiError, lang)); return; }
    onUpdate({ ...current, payment: null });
    toast.success(t("გადახდა გაუქმდა.", "Payment undone."));
    setView("details");
    router.refresh();
  }

  const titles: Record<View, string> = {
    details: current.client?.full_name ?? t("ვიზიტი", "Visit"),
    pay: t("გადახდა", "Payment"),
    cancel: t("ვიზიტის გაუქმება", "Cancel visit"),
    void: t("გადახდის გაუქმება", "Undo payment"),
  };
  const description = `${current.service_name || current.treatment_type} · ${timeOfVisit(current, timezone)}`;

  let footer: React.ReactNode = null;
  if (view === "details") {
    if (!office) {
      if (current.status === "scheduled" || current.status === "arrived") {
        footer = <div className={current.status === "scheduled" ? "grid grid-cols-2 gap-2" : ""}>
          {current.status === "scheduled" && <Button variant="secondary" size="lg" loading={busy === "arrived"} icon={<UserCheck className="h-5 w-5" />} onClick={() => void changeStatus("arrived", { undoTo: "scheduled" })}>{t("მოვიდა", "Arrived")}</Button>}
          <Button size="lg" block={current.status === "arrived"} loading={busy === "completed"} icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => void changeStatus("completed", { undoTo: current.status })}>{t("დასრულება", "Done")}</Button>
        </div>;
      } else if (current.status === "no_show") {
        footer = <Button variant="secondary" size="lg" block loading={busy === "scheduled"} icon={<RotateCcw className="h-5 w-5" />} onClick={() => void changeStatus("scheduled")}>{t("აღდგენა", "Restore visit")}</Button>;
      }
    } else if (current.status === "scheduled") {
      footer = <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" icon={<Wallet className="h-5 w-5" />} onClick={() => setView("pay")}>{t("დასრულება", "Done")}</Button>
        <Button size="lg" loading={busy === "arrived"} icon={<UserCheck className="h-5 w-5" />} onClick={() => void changeStatus("arrived", { undoTo: "scheduled" })}>{t("მოვიდა", "Arrived")}</Button>
      </div>;
    } else if (current.status === "arrived" || (current.status === "completed" && !payment)) {
      footer = <Button size="lg" block icon={<Wallet className="h-5 w-5" />} onClick={() => setView("pay")}>{t("გადახდის მიღება", "Take payment")}</Button>;
    } else if (current.status === "no_show" || current.status === "canceled" || current.status === "missed") {
      footer = <Button variant="secondary" size="lg" block loading={busy === "scheduled"} icon={<RotateCcw className="h-5 w-5" />} onClick={() => void changeStatus("scheduled")}>{t("აღდგენა", "Restore visit")}</Button>;
    }
  }

  return (
    <Sheet open={Boolean(visit)} onClose={onClose} title={titles[view]} description={view === "details" ? description : current.client?.full_name ?? undefined} footer={footer}>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {view === "details" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={current.status} />
            {payment && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">{t("გადახდილია", "Paid")}</span>}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-stone-500">{t("დრო", "Time")}</dt><dd className="mt-0.5 font-semibold">{formatLongDate(current.treatment_date, lang)} · {timeOfVisit(current, timezone)}</dd></div>
            <div><dt className="text-stone-500">{t("სპეციალისტი", "Specialist")}</dt><dd className="mt-0.5 font-semibold">{current.staff?.full_name ?? "·"}</dd></div>
            <div><dt className="text-stone-500">{t("ფასი", "Price")}</dt><dd className="mt-0.5 font-semibold">{formatGel(price, lang)}</dd></div>
            {current.booking_code && <div><dt className="text-stone-500">{t("ჯავშნის კოდი", "Booking code")}</dt><dd className="mt-0.5 font-semibold tracking-widest">{formatBookingCode(current.booking_code)}</dd></div>}
          </dl>

          {!office && current.status === "completed" && !payment && (
            <Alert tone="info">{t("გადახდას იღებს ადმინისტრატორი.", "The front desk takes the payment.")}</Alert>
          )}

          {current.client?.phone && (
            <ButtonLink href={`tel:${current.client.phone}`} variant="secondary" block icon={<Phone className="h-4 w-4 text-brand" />}>{current.client.phone}</ButtonLink>
          )}

          {payment && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm">
              <p className="font-semibold text-emerald-900">{t("გადახდა", "Payment")}</p>
              <div className="mt-2 space-y-1 text-stone-700">
                <div className="flex justify-between"><span>{t("ფასი", "Price")}</span><span>{formatGel(Number(payment.price_gel), lang)}</span></div>
                {Number(payment.discount_gel) > 0 && <div className="flex justify-between"><span>{t("ფასდაკლება", "Discount")}</span><span>−{formatGel(Number(payment.discount_gel), lang)}</span></div>}
                {Number(payment.tip_gel) > 0 && <div className="flex justify-between"><span>{t("თიფი", "Tip")}</span><span>+{formatGel(Number(payment.tip_gel), lang)}</span></div>}
                {Number(payment.cash_gel) > 0 && <div className="flex justify-between"><span>{t("ნაღდი", "Cash")}</span><span>{formatGel(Number(payment.cash_gel), lang)}</span></div>}
                {Number(payment.card_gel) > 0 && <div className="flex justify-between"><span>{t("ბარათი", "Card")}</span><span>{formatGel(Number(payment.card_gel), lang)}</span></div>}
              </div>
              {canVoid && <button type="button" onClick={() => setView("void")} className="mt-3 min-h-11 text-sm font-semibold text-red-700 hover:underline">{t("გადახდის გაუქმება", "Undo payment")}</button>}
            </div>
          )}

          <div className="space-y-1 border-t border-stone-100 pt-3">
            {current.status === "scheduled" && <>
              <MenuButton icon={<UserX className="h-5 w-5" />} label={t("არ მოვიდა", "No-show")} busy={busy === "no_show"} onClick={() => void changeStatus("no_show", { undoTo: "scheduled" })} />
              {office && <MenuButton icon={<XCircle className="h-5 w-5" />} label={t("ვიზიტის გაუქმება", "Cancel visit")} danger onClick={() => setView("cancel")} />}
            </>}
            {current.status === "arrived" && <>
              <MenuButton icon={<RotateCcw className="h-5 w-5" />} label={t("ჯერ არ მოსულა", "Not here yet")} busy={busy === "scheduled"} onClick={() => void changeStatus("scheduled")} />
              <MenuButton icon={<UserX className="h-5 w-5" />} label={t("არ მოვიდა", "No-show")} busy={busy === "no_show"} onClick={() => void changeStatus("no_show", { undoTo: "arrived" })} />
            </>}
            {current.status === "completed" && !payment && (
              <MenuButton icon={<RotateCcw className="h-5 w-5" />} label={t("დასრულების გაუქმება", "Not done yet")} busy={busy === "arrived"} onClick={() => void changeStatus("arrived")} />
            )}
            {office && (current.status === "scheduled" || current.status === "arrived") && (onMove
              ? <MenuButton icon={<CalendarClock className="h-5 w-5" />} label={t("სხვა დროზე გადატანა", "Move to another time")} onClick={() => onMove(current)} />
              : <MenuButton icon={<CalendarClock className="h-5 w-5" />} label={t("გადატანა კალენდარში", "Move in calendar")} href={`/appointments?date=${current.treatment_date}`} />)}
          </div>
        </div>
      )}

      {view === "pay" && (
        <PaymentForm defaultPrice={price} busy={busy === "pay"} onCancel={() => { setView("details"); setError(null); }} onSubmit={(breakdown) => void takePayment(breakdown)} />
      )}

      {view === "cancel" && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">{t("ვიზიტი გაუქმდება და დრო გათავისუფლდება ახალი ჯავშნისთვის.", "The visit will be canceled and the time freed for new bookings.")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={() => setView("details")}>{t("არა", "No")}</Button>
            <Button variant="danger" size="lg" loading={busy === "canceled"} onClick={() => { void changeStatus("canceled", { undoTo: "scheduled" }).then(() => setView("details")); }}>{t("დიახ, გაუქმება", "Yes, cancel")}</Button>
          </div>
        </div>
      )}

      {view === "void" && payment && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">{t(`გაუქმდება გადახდა ${formatGel(Number(payment.total_gel) + Number(payment.tip_gel), lang)}. ჩანაწერი შენახული დარჩება მიზეზით.`, `The payment of ${formatGel(Number(payment.total_gel) + Number(payment.tip_gel), lang)} will be undone. The record is kept with the reason.`)}</p>
          <Field label={t("მიზეზი", "Reason")}>
            {(props) => <Input {...props} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder={t("მაგ: თანხა შეცდომით ჩაიწერა", "e.g. wrong amount")} />}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={() => setView("details")}>{t("უკან", "Back")}</Button>
            <Button variant="danger" size="lg" loading={busy === "void"} disabled={voidReason.trim().length < 2} onClick={() => void voidPayment()}>{t("გაუქმება", "Undo payment")}</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function MenuButton({ icon, label, onClick, href, busy, danger }: {
  icon: React.ReactNode; label: string; onClick?: () => void; href?: string; busy?: boolean; danger?: boolean;
}) {
  const className = `flex w-full min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition hover:bg-stone-50 disabled:opacity-50 ${danger ? "text-red-700" : "text-stone-700"}`;
  if (href) return <a href={href} className={className}><span className="text-stone-400">{icon}</span>{label}</a>;
  return (
    <button type="button" disabled={busy} onClick={onClick} className={className}>
      <span className={danger ? "text-red-500" : "text-stone-400"}>{icon}</span>{label}
    </button>
  );
}
