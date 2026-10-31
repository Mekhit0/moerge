"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CustomBookingService, DEFAULT_CUSTOM_SERVICES, TreatmentType } from "@/lib/types";
import { generateDynamicTimeSlots, evaluateSmartSlotAvailability } from "@/lib/scheduling";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";
import { formatBookingCode } from "@/lib/booking-code";
import { formatLongDate, tbilisiDate as georgiaDate, tbilisiNowMinutes as georgiaNowMinutes, timeToMinutes as toMinutes } from "@/lib/dates";
import { DayChips, TimeChips } from "@/components/ui";

interface PublicSalonInfo {
  found: boolean;
  salon_id?: string;
  slug?: string;
  salon_name?: string;
  timezone?: string;
  brand_color?: string;
  reminder_interval_days?: number;
  booking_title?: string;
  booking_subtitle?: string;
  salon_address?: string;
  salon_phone?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  slot_interval_minutes?: number;
  custom_services?: CustomBookingService[];
  staff?: Array<{ id: string; full_name: string; color: string; service_ids: string[] }>;
  availability?: {
    date: string;
    booked_times: string[];
    slots?: Array<{ slot_time: string; staff_id: string; staff_name: string; starts_at: string; ends_at: string }>;
  };
}

interface BookingResult {
  appointment_id: string;
  client_id: string;
  salon_name: string;
  is_returning_client: boolean;
  treatment_date: string;
  treatment_time: string;
  treatment_type: TreatmentType;
  confirmation_email_sent?: boolean;
  manage_url?: string | null;
  booking_code?: string | null;
}

type Step = 1 | 2 | 3;

const DEMO_SALON: PublicSalonInfo = {
  found: true,
  salon_name: "moarge Demo Salon",
  timezone: "Asia/Tbilisi",
  salon_address: "თბილისი, ჭავჭავაძის გამზ. 34",
  working_hours_start: "10:00",
  working_hours_end: "20:00",
  slot_interval_minutes: 60,
  custom_services: DEFAULT_CUSTOM_SERVICES,
};
const DEMO_BOOKED_TIMES = ["11:00:00", "15:00:00"];

/** Calendar file for the booking. Georgia has no daylight saving time, so Tbilisi is always UTC+4. */
function calendarFileUrl(title: string, date: string, time: string, durationMinutes: number, location?: string) {
  const start = new Date(`${date}T${time.slice(0, 5)}:00+04:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//moarge//booking//EN", "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@moarge.com`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(title)}`, ...(location ? [`LOCATION:${escape(location)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function PublicBookingFormContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const salonSlugParam = searchParams.get("salon") ?? "";
  const isDemo = !salonSlugParam || salonSlugParam === "demo";

  const [salonInfo, setSalonInfo] = useState<PublicSalonInfo>(isDemo ? DEMO_SALON : { found: false, custom_services: [] });
  const [step, setStep] = useState<Step>(1);
  const [treatmentDate, setTreatmentDate] = useState(() => georgiaDate(isDemo ? 1 : 0));
  const [treatmentTime, setTreatmentTime] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState(isDemo ? DEFAULT_CUSTOM_SERVICES[0].id : "");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffSlots, setStaffSlots] = useState<NonNullable<NonNullable<PublicSalonInfo["availability"]>["slots"]>>([]);
  const [fullName, setFullName] = useState(searchParams.get("name") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [websiteTrap, setWebsiteTrap] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use; bumping the key renders a fresh check after each attempt.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingResult | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const services = useMemo(
    () => (salonInfo.custom_services ?? []).filter((service) => service.enabled !== false),
    [salonInfo.custom_services]
  );
  const activeService = services.find((service) => service.id === selectedServiceId) ?? null;
  const serviceName = (service: CustomBookingService) => (lang === "ka" ? service.name_ka : service.name_en || service.name_ka);
  const priceLabel = (price: number) => (price === 0 ? t("უფასო", "Free") : `${price} ₾`);

  const staffForService = (salonInfo.staff ?? []).filter((member) => activeService && member.service_ids.includes(activeService.id));
  const selectedStaff = staffForService.find((member) => member.id === selectedStaffId) ?? null;

  const loadAvailability = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ salon: salonSlugParam, date: treatmentDate });
      if (selectedServiceId) params.set("service_id", selectedServiceId);
      if (selectedStaffId) params.set("staff_id", selectedStaffId);
      const response = await fetch(`/api/public/book?${params.toString()}`);
      const data: PublicSalonInfo = await response.json();
      if (!response.ok || !data?.found) {
        setStaffSlots([]);
        if (!data?.found) setSalonInfo({ found: false, custom_services: [] });
        setLoadError(response.ok
          ? t("ეს სალონი ვერ მოიძებნა ან ონლაინ ჩაწერა გამორთულია.", "This salon was not found or online booking is turned off.")
          : t("თავისუფალი დრო ვერ ჩაიტვირთა. სცადეთ ხელახლა.", "Could not load free times. Please try again."));
        return;
      }
      setSalonInfo(data);
      setStaffSlots(data.availability?.slots ?? []);
    } catch {
      setStaffSlots([]);
      setLoadError(t("კავშირი შეფერხდა. სცადეთ ხელახლა.", "Connection problem. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [isDemo, salonSlugParam, treatmentDate, selectedServiceId, selectedStaffId, t]);

  useEffect(() => { void loadAvailability(); }, [loadAvailability]);

  const demoSlots = useMemo(() => {
    const candidates = generateDynamicTimeSlots(DEMO_SALON.working_hours_start!, DEMO_SALON.working_hours_end!, DEMO_SALON.slot_interval_minutes!);
    const free = evaluateSmartSlotAvailability("00:00", DEMO_BOOKED_TIMES, activeService?.duration_minutes ?? 45, candidates).availableSlots;
    if (treatmentDate !== georgiaDate()) return free;
    const now = georgiaNowMinutes();
    return free.filter((slot) => toMinutes(slot) > now + 30);
  }, [activeService?.duration_minutes, treatmentDate]);

  const timeSlots = useMemo(() => isDemo
    ? demoSlots
    : Array.from(new Set(staffSlots
      .filter((slot) => !selectedStaffId || slot.staff_id === selectedStaffId)
      .map((slot) => slot.slot_time.slice(0, 5)))).sort(),
  [isDemo, demoSlots, staffSlots, selectedStaffId]);

  const DAY_CHIP_COUNT = 14;
  const dateInChipRange = treatmentDate >= georgiaDate() && treatmentDate < georgiaDate(DAY_CHIP_COUNT);

  const longDate = (value: string) => formatLongDate(value, lang);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseService(id: string) {
    setSelectedServiceId(id);
    setSelectedStaffId(null);
    setTreatmentTime("");
    goTo(2);
  }

  function chooseDate(value: string) {
    setTreatmentDate(value);
    setTreatmentTime("");
    setError(null);
  }

  function chooseTime(value: string) {
    setTreatmentTime(value);
    goTo(3);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!activeService) { goTo(1); return; }
    if (!treatmentTime || !timeSlots.includes(treatmentTime)) {
      setError(t("ეს დრო აღარ არის თავისუფალი. აირჩიეთ სხვა.", "That time is no longer free. Please choose another."));
      goTo(2);
      return;
    }

    setSubmitting(true);
    if (isDemo) {
      // Demo bookings never leave the browser.
      await new Promise((resolve) => setTimeout(resolve, 500));
      setConfirmation({
        appointment_id: "demo", client_id: "demo", salon_name: t("საჩვენებელი სალონი", "Demo salon"), is_returning_client: false,
        treatment_date: treatmentDate, treatment_time: treatmentTime, treatment_type: activeService.type,
        booking_code: "482913",
      });
      setSubmitting(false);
      return;
    }

    const composedNotes = [`${activeService.name_ka} (${activeService.price_gel} ₾, ${activeService.duration_minutes} min)`, notes.trim()]
      .filter(Boolean).join(" · ");
    try {
      const response = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_slug: salonSlugParam,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim(),
          treatment_date: treatmentDate,
          treatment_time: treatmentTime,
          treatment_type: activeService.id || activeService.type,
          service_id: activeService.id,
          staff_id: selectedStaffId,
          website: websiteTrap,
          turnstile_token: turnstileToken,
          notes: composedNotes.slice(0, 1000) || null,
          email_consent: emailConsent,
          sms_consent: smsConsent,
          preferred_language: lang,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.booking) {
        setError(data.error || t("ჯავშანი ვერ შეიქმნა. გადაამოწმეთ მონაცემები.", "The booking could not be made. Please check your details."));
        if (response.status === 409) { setTreatmentTime(""); void loadAvailability(); goTo(2); }
        return;
      }
      setConfirmation(data.booking);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally {
      setSubmitting(false);
      setTurnstileToken(null);
      setTurnstileKey((key) => key + 1);
    }
  }

  function startOver() {
    setConfirmation(null);
    setCodeCopied(false);
    setTreatmentTime("");
    setStep(1);
    void loadAvailability();
  }

  const salonName = isDemo ? t("საჩვენებელი სალონი", "Demo salon") : salonInfo.salon_name;
  const salonNotFound = !isDemo && !loading && !salonInfo.found;
  const steps = [t("სერვისი", "Service"), t("დრო", "Time"), t("თქვენ", "You")];
  const inputClass = "mt-1.5 w-full min-h-12 rounded-xl border border-stone-200 bg-white px-4 text-base text-stone-900 placeholder:text-stone-400 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30";

  return (
    <div className="min-h-screen bg-ivory text-stone-900">
      <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="moarge" className="shrink-0"><MoargeLogo variant="icon" size="sm" /></Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-700">{salonName || t("იტვირთება...", "Loading...")}</p>
          <LanguageSwitcher />
        </div>
      </header>

      <div ref={topRef} className="scroll-mt-20" />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        {isDemo && !confirmation && step === 1 && (
          <p className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
            {t("ეს საჩვენებელი ფორმაა. სცადეთ თავისუფლად, ნამდვილი ჯავშანი არ შეიქმნება.", "This is a demo. Try it freely, no real booking is made.")}
          </p>
        )}

        {salonNotFound ? (
          <section className="step-in rounded-3xl border border-stone-200 bg-white p-8 text-center">
            <h1 className="text-xl font-bold">{loadError || t("ჯავშნის გვერდი მიუწვდომელია", "Booking page is unavailable")}</h1>
            <button type="button" onClick={() => void loadAvailability()} className="mt-5 min-h-12 rounded-xl bg-rose-600 px-6 font-semibold text-white hover:bg-rose-700">{t("ხელახლა ცდა", "Try again")}</button>
          </section>
        ) : confirmation ? (
          <section className="step-in rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-9 w-9 text-emerald-600" /></span>
            <h1 className="mt-4 text-2xl font-bold">{t("ჯავშანი დადასტურდა", "You're booked")}</h1>
            <p className="mt-1 text-stone-600">{confirmation.salon_name}</p>

            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-stone-50 p-4 text-left">
              <p className="font-semibold">{activeService ? serviceName(activeService) : ""}</p>
              <p className="mt-1 text-sm capitalize text-stone-600">{longDate(confirmation.treatment_date)} · {confirmation.treatment_time.slice(0, 5)}</p>
              {selectedStaff && <p className="mt-1 text-sm text-stone-500">{selectedStaff.full_name}</p>}
            </div>

            {confirmation.booking_code && (
              <div className="mx-auto mt-4 max-w-sm rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-5">
                <p className="text-sm font-semibold text-stone-700">{t("ჯავშნის კოდი", "Booking code")}</p>
                <p className="mt-1 text-4xl font-black tracking-[0.2em] text-rose-700">{formatBookingCode(confirmation.booking_code)}</p>
                <p className="mt-2 text-sm text-stone-600">{t("კოდით და ტელეფონით შეგიძლიათ ჯავშნის შეცვლა ან გაუქმება. შეინახეთ ან გადაიღეთ ეკრანი.", "Use the code and your phone number to change or cancel. Save it or take a screenshot.")}</p>
              </div>
            )}

            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
              {confirmation.booking_code && (
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(confirmation.booking_code ?? "").then(() => setCodeCopied(true)).catch(() => setCodeCopied(false)); }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50">
                  {codeCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-rose-500" />}
                  {codeCopied ? t("დაკოპირდა", "Copied") : t("კოდის კოპირება", "Copy code")}
                </button>
              )}
              {activeService && (
                <a href={calendarFileUrl(`${serviceName(activeService)} · ${confirmation.salon_name}`, confirmation.treatment_date, confirmation.treatment_time, activeService.duration_minutes, salonInfo.salon_address)}
                  download="moarge-booking.ics"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50">
                  <CalendarPlus className="h-4 w-4 text-rose-500" />{t("კალენდარში", "Add to calendar")}
                </a>
              )}
            </div>

            {confirmation.manage_url && <Link href={confirmation.manage_url} className="mt-5 inline-block text-sm font-semibold text-rose-700 underline-offset-4 hover:underline">{t("ჯავშნის ნახვა და შეცვლა", "View or change booking")}</Link>}
            <div><button type="button" onClick={startOver} className="mt-6 min-h-12 rounded-xl px-6 text-sm font-semibold text-stone-600 hover:bg-stone-100">{t("ახალი ჯავშანი", "Book another")}</button></div>
          </section>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold sm:text-3xl">{salonName}</h1>
              {step === 1 && (salonInfo.salon_address || salonInfo.salon_phone) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                  {salonInfo.salon_address && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-rose-400" />{salonInfo.salon_address}</span>}
                  {salonInfo.salon_phone && <a href={`tel:${salonInfo.salon_phone}`} className="inline-flex items-center gap-1.5 hover:text-rose-700"><Phone className="h-4 w-4 text-rose-400" />{salonInfo.salon_phone}</a>}
                </div>
              )}
            </div>

            <ol className="mb-6 grid grid-cols-3 gap-2" aria-label={t("ჯავშნის ნაბიჯები", "Booking steps")}>
              {steps.map((label, index) => {
                const number = (index + 1) as Step;
                const done = number < step;
                return (
                  <li key={label}>
                    <button type="button" disabled={number > step} onClick={() => goTo(number)} aria-current={number === step ? "step" : undefined} className="w-full text-left disabled:cursor-default">
                      <span className={`block h-1.5 rounded-full transition-colors duration-300 ${number <= step ? "bg-rose-600" : "bg-stone-200"}`} />
                      <span className={`mt-2 flex items-center gap-1 text-xs font-semibold ${number === step ? "text-rose-700" : done ? "text-stone-700" : "text-stone-400"}`}>
                        {done && <Check className="h-3.5 w-3.5 text-emerald-600" />}{label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

            {step === 1 && (
              <section key="step1" className="step-in space-y-3">
                <h2 className="text-lg font-bold">{t("რა გსურთ?", "What would you like?")}</h2>
                {loading && services.length === 0 ? (
                  Array.from({ length: 3 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-white" />)
                ) : services.length === 0 ? (
                  <p className="rounded-2xl bg-white p-5 text-stone-600">{t("ონლაინ დასაჯავშნი სერვისები ჯერ არ არის. დაუკავშირდით სალონს.", "No services can be booked online yet. Please contact the salon.")}</p>
                ) : services.map((service) => (
                  <button key={service.id} type="button" onClick={() => chooseService(service.id)} aria-pressed={selectedServiceId === service.id}
                    className={`group flex w-full items-center justify-between gap-4 rounded-2xl border bg-white p-4 text-left transition hover:border-rose-300 hover:shadow-sm active:scale-[0.99] ${selectedServiceId === service.id ? "border-rose-400 ring-2 ring-rose-100" : "border-stone-200"}`}>
                    <span className="min-w-0">
                      <span className="block font-semibold text-stone-900">{serviceName(service)}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-sm text-stone-500"><Clock className="h-3.5 w-3.5" />{service.duration_minutes} {t("წთ", "min")}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-stone-900">{priceLabel(service.price_gel)}</span>
                      <ArrowRight className="h-5 w-5 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-rose-500" />
                    </span>
                  </button>
                ))}
              </section>
            )}

            {step === 2 && activeService && (
              <section key="step2" className="step-in space-y-6">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm">
                  <span className="min-w-0 truncate font-semibold">{serviceName(activeService)}</span>
                  <button type="button" onClick={() => goTo(1)} className="shrink-0 font-semibold text-rose-700">{t("შეცვლა", "Change")}</button>
                </div>

                {staffForService.length > 1 && (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-stone-700">{t("სპეციალისტი", "Specialist")}</h2>
                    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {[{ id: "", full_name: t("ნებისმიერი", "Anyone"), color: "" }, ...staffForService].map((member) => {
                        const selected = (selectedStaffId ?? "") === member.id;
                        return (
                          <button key={member.id || "any"} type="button" onClick={() => { setSelectedStaffId(member.id || null); setTreatmentTime(""); }} aria-pressed={selected}
                            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${selected ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-rose-300"}`}>
                            {member.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />}
                            {member.full_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-stone-700">{t("დღე", "Day")}</h2>
                    <label className="text-sm font-semibold text-rose-700">
                      <span className="cursor-pointer">{t("სხვა თარიღი", "Other date")}</span>
                      <input type="date" min={georgiaDate()} max={georgiaDate(90)} value={treatmentDate} onChange={(event) => event.target.value && chooseDate(event.target.value)} className="sr-only" />
                    </label>
                  </div>
                  <DayChips value={treatmentDate} onChange={chooseDate} days={DAY_CHIP_COUNT} />
                  {!dateInChipRange && <p className="mt-2 text-sm font-semibold text-stone-700">{longDate(treatmentDate)}</p>}
                </div>

                <div className="min-h-40">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
                    {t("თავისუფალი დრო", "Free times")}
                    {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-stone-400" />}
                  </h2>
                  {loadError ? (
                    <div className="rounded-2xl bg-white p-4 text-sm text-red-700">
                      {loadError} <button type="button" onClick={() => void loadAvailability()} className="ml-1 font-semibold underline">{t("ხელახლა", "Retry")}</button>
                    </div>
                  ) : loading ? (
                    <div className="grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white" />)}</div>
                  ) : !isDemo && staffForService.length === 0 ? (
                    <p className="rounded-2xl bg-white p-4 text-sm text-stone-600">{t("ამ სერვისზე სპეციალისტი ჯერ არ არის მიბმული. დაუკავშირდით სალონს.", "No specialist offers this service yet. Please contact the salon.")}</p>
                  ) : timeSlots.length === 0 ? (
                    <p className="rounded-2xl bg-white p-4 text-sm text-stone-600">{t("ამ დღეს თავისუფალი დრო აღარ არის. აირჩიეთ სხვა დღე.", "No free times on this day. Please choose another day.")}</p>
                  ) : (
                    <TimeChips times={timeSlots} value={treatmentTime} onChange={chooseTime} />
                  )}
                </div>
              </section>
            )}

            {step === 3 && activeService && (
              <form key="step3" onSubmit={handleSubmit} className="step-in space-y-5">
                <div className="rounded-2xl border border-rose-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{serviceName(activeService)}</p>
                      <p className="mt-1 text-sm capitalize text-stone-600">{longDate(treatmentDate)} · {treatmentTime}</p>
                      <p className="mt-0.5 text-sm text-stone-500">{selectedStaff?.full_name ?? (isDemo ? "" : t("ნებისმიერი სპეციალისტი", "Any specialist"))}</p>
                    </div>
                    <p className="shrink-0 font-bold text-rose-700">{priceLabel(activeService.price_gel)}</p>
                  </div>
                  <button type="button" onClick={() => goTo(2)} className="mt-2 text-sm font-semibold text-rose-700">{t("დროის შეცვლა", "Change time")}</button>
                </div>

                <div className="space-y-4 rounded-2xl bg-white p-4 sm:p-5">
                  <label className="block text-sm font-semibold text-stone-700">{t("სახელი და გვარი", "Full name")}
                    <input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} placeholder={t("მაგ. ნინო ბერიძე", "e.g. Nino Beridze")} />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">{t("ტელეფონი", "Phone")}
                    <input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="5XX XX XX XX" />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">{t("ელფოსტა", "Email")} <span className="font-normal text-stone-400">{t("(არასავალდებულო)", "(optional)")}</span>
                    <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@gmail.com" />
                  </label>
                  <details className="group">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-rose-700">{t("+ შენიშვნის დამატება", "+ Add a note")}</summary>
                    <textarea rows={3} maxLength={700} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} min-h-24 py-3`} placeholder={t("რამე, რაც სალონმა უნდა იცოდეს", "Anything the salon should know")} />
                  </details>
                  <input type="text" name="website" value={websiteTrap} onChange={(event) => setWebsiteTrap(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden" />
                  <div className="space-y-3 border-t border-stone-100 pt-4">
                    <label className="flex items-start gap-3 text-sm text-stone-600">
                      <input type="checkbox" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600" />
                      {t("მსურს SMS შეხსენება ვიზიტამდე", "Send me an SMS reminder before the visit")}
                    </label>
                    <label className="flex items-start gap-3 text-sm text-stone-600">
                      <input type="checkbox" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600" />
                      {t("მსურს შეხსენება ელფოსტით", "Send me reminders by email")}
                    </label>
                  </div>
                </div>

                {!isDemo && <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} language={lang} />}

                <button type="submit" disabled={submitting || (!isDemo && Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                  className="flex w-full min-h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 text-base font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50">
                  {submitting ? <><RefreshCw className="h-5 w-5 animate-spin" />{t("იგზავნება...", "Booking...")}</> : <>{t("ჯავშნის დადასტურება", "Confirm booking")}<ArrowRight className="h-5 w-5" /></>}
                </button>
                <button type="button" onClick={() => goTo(2)} className="mx-auto flex min-h-11 items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-stone-800">
                  <ArrowLeft className="h-4 w-4" />{t("უკან", "Back")}
                </button>
                <p className="flex items-center justify-center gap-2 text-xs text-stone-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />{t("მონაცემები მხოლოდ ამ ჯავშნისთვის გამოიყენება.", "Your details are used only for this booking.")}
                </p>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function PublicBookingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ivory text-sm text-stone-500">იტვირთება... / Loading...</div>}>
      <PublicBookingFormContent />
    </Suspense>
  );
}
