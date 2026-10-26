"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";

type BookingView = {
  salon_name: string;
  timezone: string;
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

function ManageBookingForm() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadBooking = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`/api/public/manage-booking?token=${encodeURIComponent(token)}`);
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? t("ბმული ვერ მოიძებნა.", "Booking link not found.")); return; }
    setBooking(result.appointment);
  }, [token, t]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  async function submit(action: "cancel" | "reschedule") {
    setError(""); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/public/manage-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, date: action === "reschedule" ? date : undefined, time: action === "reschedule" ? time : undefined }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? t("ცვლილება ვერ შესრულდა.", "Could not update booking.")); return; }
      setMessage(action === "cancel" ? t("ჯავშანი გაუქმებულია.", "Booking canceled.") : t("ჯავშანი გადატანილია.", "Booking rescheduled."));
      await loadBooking();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#fdf8f6] px-4 py-10 text-stone-900">
    <div className="mx-auto max-w-lg">
      <Link href="/" className="mb-8 block"><MoargeLogo variant="icon" size="sm" /></Link>
      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">{t("ჯავშნის მართვა", "Manage your booking")}</h1>
        {booking && <div className="mt-5 space-y-2 rounded-2xl bg-stone-50 p-4 text-sm">
          <p><strong>{booking.salon_name}</strong></p>
          <p>{booking.service_name} · {booking.treatment_date} · {String(booking.treatment_time).slice(0,5)} ({booking.timezone})</p>
          {booking.staff?.full_name && <p>{booking.staff.full_name}</p>}
          <p>{booking.client?.full_name}</p>
          {!booking.can_manage && <p className="text-amber-800">{t("გაუქმებისა და გადატანის ვადა ამოიწურა.", "The cancellation and rescheduling deadline has passed.")}</p>}
        </div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {booking?.can_manage && <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">{t("ახალი თარიღი", "New date")}
              <input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-semibold">{t("ახალი დრო", "New time")}
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" />
            </label>
          </div>
          <button type="button" disabled={busy || !date || !time} onClick={() => void submit("reschedule")} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {t("ჯავშნის გადატანა", "Reschedule booking")}
          </button>
          <button type="button" disabled={busy} onClick={() => void submit("cancel")} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 disabled:opacity-50">
            {t("ჯავშნის გაუქმება", "Cancel booking")}
          </button>
        </div>}
      </section>
    </div>
  </main>;
}

export default function ManageBookingPage() {
  return <Suspense fallback={<div className="p-10 text-center">იტვირთება... / Loading...</div>}><ManageBookingForm /></Suspense>;
}
