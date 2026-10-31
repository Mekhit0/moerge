"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Hash, Phone, RefreshCw, Search } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import { formatBookingCode } from "@/lib/booking-code";

type BookingView = {
  salon_name: string;
  salon_phone: string | null;
  timezone: string;
  booking_code: string | null;
  treatment_date: string;
  treatment_time: string;
  starts_at: string;
  status: string;
  service_name: string | null;
  can_manage: boolean;
  deadline_hours: number;
  client?: { full_name?: string } | null;
  staff?: { full_name?: string } | null;
};

function tbilisiDate(daysAhead = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + daysAhead));
  return date.toISOString().slice(0, 10);
}

function FindBookingForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/public/find-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? t("ჯავშანი ვერ მოიძებნა.", "Booking not found.")); return; }
      router.replace(`/manage-booking?token=${encodeURIComponent(result.token)}`);
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally { setBusy(false); }
  }

  const inputClass = "mt-1.5 w-full min-h-12 rounded-xl border border-stone-300 pl-11 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-rose-500";

  return <form onSubmit={find} className="mt-6 space-y-4">
    <p className="text-sm text-stone-600">{t("შეიყვანეთ ჯავშნის კოდი და ტელეფონის ნომერი, რომლითაც დაჯავშნეთ.", "Enter your booking code and the phone number you booked with.")}</p>
    <label className="block text-sm font-semibold text-stone-700">{t("ჯავშნის კოდი", "Booking code")}
      <span className="relative block">
        <Hash className="absolute left-3.5 top-1/2 mt-0.5 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input required inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code}
          onChange={(e) => setCode(e.target.value)} placeholder="123 456" className={`${inputClass} tracking-widest`} />
      </span>
    </label>
    <label className="block text-sm font-semibold text-stone-700">{t("ტელეფონი", "Phone")}
      <span className="relative block">
        <Phone className="absolute left-3.5 top-1/2 mt-0.5 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+995 5XX XX XX XX" className={inputClass} />
      </span>
    </label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" disabled={busy} className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
      <Search className="h-5 w-5" />{busy ? t("იძებნება...", "Searching...") : t("ჯავშნის პოვნა", "Find my booking")}
    </button>
  </form>;
}

function ManageBooking({ token }: { token: string }) {
  const { t } = useLanguage();
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBooking = useCallback(async () => {
    const response = await fetch(`/api/public/manage-booking?token=${encodeURIComponent(token)}`);
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? t("ჯავშანი ვერ მოიძებნა.", "Booking not found.")); return; }
    setBooking(result.appointment);
  }, [token, t]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  async function chooseDate(value: string) {
    setDate(value); setTime(""); setSlots(null); setError("");
    if (!value) return;
    setLoadingSlots(true);
    try {
      const response = await fetch(`/api/public/manage-booking?token=${encodeURIComponent(token)}&date=${value}`);
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? t("თავისუფალი დრო ვერ ჩაიტვირთა.", "Could not load free times.")); return; }
      setSlots(result.slots ?? []);
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally { setLoadingSlots(false); }
  }

  async function submit(action: "cancel" | "reschedule") {
    setError(""); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/public/manage-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, date: action === "reschedule" ? date : undefined, time: action === "reschedule" ? time : undefined }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? t("ცვლილება ვერ შესრულდა.", "Could not update the booking."));
        if (action === "reschedule" && date) void chooseDate(date);
        return;
      }
      setMessage(action === "cancel" ? t("ჯავშანი გაუქმდა.", "Your booking is canceled.") : t("ჯავშანი გადაიტანეს ახალ დროზე.", "Your booking was moved to the new time."));
      setDate(""); setSlots(null); setTime(""); setConfirmCancel(false);
      await loadBooking();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally { setBusy(false); }
  }

  const statusLabel = booking?.status === "canceled" ? t("გაუქმებულია", "Canceled") : booking?.status === "scheduled" ? t("დადასტურებულია", "Confirmed") : booking?.status;

  return <>
    {booking && <div className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-stone-900">{booking.salon_name}</p>
          <p className="mt-0.5 text-stone-600">{booking.service_name}{booking.staff?.full_name ? ` · ${booking.staff.full_name}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${booking.status === "scheduled" ? "bg-emerald-50 text-emerald-700" : "bg-stone-200 text-stone-600"}`}>{statusLabel}</span>
      </div>
      <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <CalendarDays className="h-5 w-5 text-rose-500" />{booking.treatment_date} · {String(booking.treatment_time).slice(0, 5)}
      </p>
      {booking.booking_code && <p className="text-stone-600">{t("ჯავშნის კოდი", "Booking code")}: <strong className="tracking-widest text-stone-900">{formatBookingCode(booking.booking_code)}</strong></p>}
      {booking.status === "scheduled" && !booking.can_manage && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
        {t(`ცვლილება შესაძლებელია ვიზიტამდე ${booking.deadline_hours} საათით ადრე. ახლა დაუკავშირდით სალონს.`, `Changes are possible up to ${booking.deadline_hours} hours before the visit. Please contact the salon now.`)}
      </p>}
      {booking.salon_phone && <a href={`tel:${booking.salon_phone}`} className="inline-flex items-center gap-2 font-semibold text-rose-700"><Phone className="h-4 w-4" />{booking.salon_phone}</a>}
    </div>}

    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{message}</p>}

    {booking?.can_manage && <div className="mt-6 space-y-5">
      <div>
        <h2 className="font-bold text-stone-900">{t("დროის შეცვლა", "Change the time")}</h2>
        <label className="mt-2 block text-sm font-medium text-stone-700">{t("ახალი თარიღი", "New date")}
          <input type="date" min={tbilisiDate()} max={tbilisiDate(90)} value={date} onChange={(e) => void chooseDate(e.target.value)}
            className="mt-1.5 w-full min-h-12 rounded-xl border border-stone-300 px-3 text-base" />
        </label>
        {loadingSlots && <p className="mt-3 inline-flex items-center gap-2 text-sm text-stone-500"><RefreshCw className="h-4 w-4 animate-spin" />{t("იტვირთება", "Loading")}</p>}
        {slots && !loadingSlots && (slots.length === 0
          ? <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{t("ამ დღეს თავისუფალი დრო არ არის. აირჩიეთ სხვა დღე.", "No free times on this day. Choose another day.")}</p>
          : <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) =>
              <button key={slot} type="button" aria-pressed={time === slot} onClick={() => setTime(slot)}
                className={`min-h-12 rounded-xl border text-sm font-semibold ${time === slot ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200 bg-white hover:border-rose-300 hover:bg-rose-50"}`}>{slot}</button>)}
            </div>)}
        <button type="button" disabled={busy || !date || !time} onClick={() => void submit("reschedule")}
          className="mt-4 w-full min-h-12 rounded-xl bg-rose-600 px-4 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {time ? t(`გადატანა ${time}-ზე`, `Move to ${time}`) : t("აირჩიეთ ახალი დრო", "Choose a new time")}
        </button>
      </div>

      <div className="border-t border-stone-100 pt-5">
        {confirmCancel ? <div className="space-y-2">
          <p className="text-sm font-semibold text-stone-800">{t("ნამდვილად გსურთ ჯავშნის გაუქმება?", "Do you really want to cancel?")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void submit("cancel")} className="min-h-12 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-50">{t("დიახ, გაუქმება", "Yes, cancel")}</button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="min-h-12 rounded-xl border border-stone-200 font-semibold text-stone-700">{t("არა", "No")}</button>
          </div>
        </div> : <button type="button" onClick={() => setConfirmCancel(true)} className="w-full min-h-12 rounded-xl border border-stone-200 px-4 font-semibold text-stone-700 hover:bg-stone-50">
          {t("ჯავშნის გაუქმება", "Cancel booking")}
        </button>}
      </div>
    </div>}
  </>;
}

function ManageBookingContent() {
  const { t } = useLanguage();
  const token = useSearchParams().get("token") ?? "";

  return <div className="min-h-screen bg-ivory text-stone-900">
    <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
      <Link href="/" aria-label="moarge"><MoargeLogo variant="full" size="sm" /></Link>
      <LanguageSwitcher />
    </header>
    <main className="mx-auto max-w-lg px-4 pb-12">
      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">{t("ჩემი ჯავშანი", "My booking")}</h1>
        {token ? <ManageBooking token={token} /> : <FindBookingForm />}
      </section>
    </main>
  </div>;
}

export default function ManageBookingPage() {
  return <Suspense fallback={<div className="p-10 text-center">იტვირთება... / Loading...</div>}><ManageBookingContent /></Suspense>;
}
