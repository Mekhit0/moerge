"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Phone,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  MapPin,
} from "lucide-react";
import {
  CustomBookingService,
  DEFAULT_CUSTOM_SERVICES,
  TreatmentType,
} from "@/lib/types";
import {
  generateDynamicTimeSlots,
  evaluateSmartSlotAvailability,
} from "@/lib/scheduling";
import {
  LanguageSwitcher,
  useLanguage,
} from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";
import { formatBookingCode } from "@/lib/booking-code";

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
    working_hours_start?: string;
    working_hours_end?: string;
    slot_interval_minutes?: number;
    standard_slots: Array<{
      time: string;
      available: boolean;
      conflicting_time: string | null;
    }>;
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

function georgiaDate(daysAhead = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + daysAhead));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function PublicBookingFormContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const salonSlugParam = searchParams.get("salon") ?? "";
  const prefillName = searchParams.get("name") ?? "";
  const prefillEmail = searchParams.get("email") ?? "";
  const isDemo = !salonSlugParam || salonSlugParam === "demo";

  const [salonInfo, setSalonInfo] = useState<PublicSalonInfo>(isDemo ? {
    found: true,
    salon_name: "moarge Demo Salon",
    timezone: "Asia/Tbilisi",
    brand_color: "#e11d48",
    reminder_interval_days: 21,
    booking_title: "დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online",
    booking_subtitle:
      "აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური შეხსენება შემდეგ ვიზიტზე.",
    working_hours_start: "10:00",
    working_hours_end: "20:00",
    slot_interval_minutes: 60,
    custom_services: DEFAULT_CUSTOM_SERVICES,
  } : { found: false, timezone: "Asia/Tbilisi", custom_services: [] });

  // Default to tomorrow's date in Georgia timezone
  const [treatmentDate, setTreatmentDate] = useState(() => georgiaDate(1));
  const [treatmentTime, setTreatmentTime] = useState("10:00");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(isDemo ? DEFAULT_CUSTOM_SERVICES[0].id : "");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [availableStaffSlots, setAvailableStaffSlots] = useState<Array<{ slot_time: string; staff_id: string; staff_name: string }>>([]);
  const [fullName, setFullName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [bookedTimesOnDate, setBookedTimesOnDate] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(!isDemo);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [websiteTrap, setWebsiteTrap] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use; bumping the key renders a fresh check after each attempt.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedSlotsFromServer, setSuggestedSlotsFromServer] = useState<
    string[]
  >([]);
  const [bookingConfirmation, setBookingConfirmation] =
    useState<BookingResult | null>(null);

  const enabledServices = useMemo(() => {
    if (Array.isArray(salonInfo.custom_services) && salonInfo.custom_services.length > 0) {
      const active = salonInfo.custom_services.filter((s) => s.enabled !== false);
      if (active.length > 0) return active;
    }
    return Array.isArray(salonInfo.custom_services) ? salonInfo.custom_services : [];
  }, [salonInfo.custom_services]);

  const activeService = useMemo(() => {
    return (
      enabledServices.find((s) => s.id === selectedServiceId) ||
      enabledServices[0] ||
      null
    );
  }, [enabledServices, selectedServiceId]);

  const dynamicCandidateSlots = useMemo(() => {
    return generateDynamicTimeSlots(
      salonInfo.working_hours_start || "10:00",
      salonInfo.working_hours_end || "20:00",
      salonInfo.slot_interval_minutes || 60
    );
  }, [
    salonInfo.working_hours_start,
    salonInfo.working_hours_end,
    salonInfo.slot_interval_minutes,
  ]);

  const fetchAvailability = useCallback(
    async (dateStr: string) => {
      setLoadingAvailability(true);
      setAvailabilityError(null);
      if (isDemo) {
        setSalonInfo({
          found: true,
          salon_name: "moarge Demo Salon",
          timezone: "Asia/Tbilisi",
          brand_color: "#e11d48",
          reminder_interval_days: 21,
          booking_title: t("საჩვენებელი ონლაინ ჯავშანი", "Interactive Demo Booking"),
          booking_subtitle: t(
            "ეს არის საჩვენებელი სიმულაცია. შეგიძლიათ გამოსცადოთ ჯავშანი და თავისუფალი საათების დეტექტორი — მონაცემები არ ინახება ბაზაში და არ ტოვებს თქვენს ბრაუზერს.",
            "This is an interactive demo. Experience the booking flow and conflict detector — all simulations stay in your browser without writing to any database."
          ),
          working_hours_start: "10:00",
          working_hours_end: "20:00",
          slot_interval_minutes: 60,
          custom_services: DEFAULT_CUSTOM_SERVICES,
        });
        setBookedTimesOnDate(["11:00:00", "15:00:00"]);
        setLoadingAvailability(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (salonSlugParam) params.set("salon", salonSlugParam);
        if (dateStr) params.set("date", dateStr);
        if (selectedServiceId) params.set("service_id", selectedServiceId);
        if (selectedStaffId) params.set("staff_id", selectedStaffId);
        const res = await fetch(`/api/public/book?${params.toString()}`);
        const data: PublicSalonInfo = await res.json();
        if (!res.ok) {
          setAvailableStaffSlots([]);
          setAvailabilityError(t("თავისუფალი დროის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.", "Could not load available times. Please retry."));
          return;
        }
        if (data?.found) {
          setSalonInfo(data);
          const times = data.availability?.booked_times ?? [];
          setBookedTimesOnDate(times);
          setAvailableStaffSlots(data.availability?.slots ?? []);
          const nextAvailable = (data.availability?.slots ?? []).find((slot) => !selectedStaffId || slot.staff_id === selectedStaffId);
          const nextTime = nextAvailable?.slot_time.slice(0, 5);
          if (nextTime) setTreatmentTime(nextTime);
          const services = data.custom_services ?? [];
          if (services.length && !services.some((service) => service.id === selectedServiceId)) {
            setSelectedServiceId(services[0].id);
          }
        } else {
          setSalonInfo({ found: false, timezone: "Asia/Tbilisi", custom_services: [] });
          setAvailableStaffSlots([]);
          setAvailabilityError(t("ეს სალონი ვერ მოიძებნა ან ონლაინ ჩაწერა გამორთულია.", "This salon could not be found or online booking is disabled."));
        }
      } catch {
        setAvailableStaffSlots([]);
        setAvailabilityError(t("კავშირი შეფერხდა. განაახლეთ გვერდი და სცადეთ ხელახლა.", "Connection failed. Refresh the page and try again."));
      } finally {
        setLoadingAvailability(false);
      }
    },
    [salonSlugParam, isDemo, t, selectedServiceId, selectedStaffId]
  );

  useEffect(() => {
    fetchAvailability(treatmentDate);
  }, [treatmentDate, selectedServiceId, selectedStaffId, fetchAvailability]);

  // Evaluate smart availability in real time for the selected time and all dynamic salon slots
  const smartAvailability = useMemo(() => {
    const legacy = evaluateSmartSlotAvailability(
        treatmentTime,
        bookedTimesOnDate,
        activeService?.duration_minutes ?? 45,
        dynamicCandidateSlots
      );
    if (isDemo) return legacy;
    const visibleSlots = availableStaffSlots.filter((slot) => !selectedStaffId || slot.staff_id === selectedStaffId);
    const times = visibleSlots.map((slot) => slot.slot_time.slice(0, 5));
    return { ...legacy, isAvailable: times.includes(treatmentTime), availableSlots: times, standardSlots: times.map((time) => ({ time, available: true, conflicting_time: null })) };
  }, [treatmentTime, bookedTimesOnDate, dynamicCandidateSlots, activeService, isDemo, availableStaffSlots, selectedStaffId]);
  const timeSlots = isDemo ? dynamicCandidateSlots : Array.from(new Set(availableStaffSlots
    .filter((slot) => !selectedStaffId || slot.staff_id === selectedStaffId)
    .map((slot) => slot.slot_time.slice(0, 5))));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuggestedSlotsFromServer([]);

    if (!smartAvailability.isAvailable) {
      setError(
        t(
          `არჩეული დრო (${treatmentTime}) უკვე დაკავებულია (${smartAvailability.conflictingTime}-ზე არსებული ჯავშნის გამო). გთხოვთ აირჩიოთ თავისუფალი საათი ქვემოთ.`,
          `Selected time (${treatmentTime}) is unavailable because it conflicts with an existing ${smartAvailability.conflictingTime} booking. Please pick one of the available slots below.`
        )
      );
      setSuggestedSlotsFromServer(smartAvailability.availableSlots);
      return;
    }
    if (!activeService) {
      setError(t("აირჩიეთ მომსახურება.", "Choose a service."));
      setStep(1);
      return;
    }

    setSubmitting(true);

    // MOCK DEMO MODE: Never leaves the user's browser, never sends emails, never writes to DB
    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      const mockResult: BookingResult = {
        appointment_id: `demo-${Date.now().toString(36)}`,
        client_id: `demo-client-${Date.now().toString(36)}`,
        salon_name: salonInfo.salon_name || "moarge Demo Salon",
        is_returning_client: false,
        treatment_date: treatmentDate,
        treatment_time: treatmentTime,
        treatment_type: activeService ? (activeService.id || activeService.type) : "laser_epilation",
        confirmation_email_sent: false,
      };
      setBookingConfirmation(mockResult);
      setSubmitting(false);
      return;
    }

    const serviceName = activeService.name_ka;
    const composedNotes = [
      `${serviceName} (${activeService.price_gel} ₾, ${activeService.duration_minutes} min)`,
      notes.trim(),
    ]
      .filter(Boolean)
      .join(" · ");

    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_slug: salonSlugParam || null,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase() || null,
          phone: phone.trim(),
          treatment_date: treatmentDate,
          treatment_time: treatmentTime,
          treatment_type: activeService ? (activeService.id || activeService.type) : "custom",
          service_id: activeService?.id || null,
          staff_id: selectedStaffId,
          website: websiteTrap,
          turnstile_token: turnstileToken,
          notes: composedNotes.slice(0, 1000) || null,
          email_consent: emailConsent,
          sms_consent: smsConsent,
          preferred_language: lang,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.booking) {
        const msg =
          lang === "ka" && data.error_ka
            ? data.error_ka
            : data.error ||
              t(
                "ჯავშნის დასრულება ვერ მოხერხდა. გადაამოწმეთ მონაცემები.",
                "Unable to complete booking. Please check your details."
              );
        setError(msg);
        if (Array.isArray(data.available_slots)) {
          setSuggestedSlotsFromServer(data.available_slots);
        }
        fetchAvailability(treatmentDate);
        setSubmitting(false);
        return;
      }

      setBookingConfirmation(data.booking);
      fetchAvailability(treatmentDate);
    } catch {
      setError(
        t(
          "ქსელური შეცდომა ჯავშნის გაგზავნისას. გთხოვთ სცადოთ ხელახლა.",
          "Network error while submitting your booking. Please try again."
        )
      );
    } finally {
      setSubmitting(false);
      setTurnstileToken(null);
      setTurnstileKey((key) => key + 1);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf7f4] text-stone-900">
      <header className="border-b border-stone-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="moarge"><MoargeLogo variant="icon" size="sm" /></Link>
            <div>
              <p className="text-xs font-semibold text-rose-700">{t("ონლაინ ჩაწერა", "Online booking")}</p>
              <h1 className="max-w-[220px] truncate text-sm font-bold sm:max-w-sm">{isDemo ? t("საჩვენებელი ჩაწერა", "Booking demo") : salonInfo.salon_name || t("სალონი იტვირთება", "Loading salon")}</h1>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
        {isDemo && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{t("საჩვენებელი ფორმაა. რეალური ჯავშანი არ შეიქმნება.", "Demo form. No real appointment will be created.")}</p>}

        {!isDemo && !salonInfo.found && !loadingAvailability ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">{availabilityError || t("ჯავშნის გვერდი მიუწვდომელია", "Booking page is unavailable")}</h2>
            <button type="button" onClick={() => fetchAvailability(treatmentDate)} className="mt-5 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white">{t("ხელახლა ცდა", "Try again")}</button>
          </section>
        ) : bookingConfirmation ? (
          <section className="rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-sm sm:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-4 text-2xl font-bold">{t("ჯავშანი დადასტურებულია", "Appointment confirmed")}</h2>
            <p className="mt-2 text-sm text-stone-600">{bookingConfirmation.salon_name}</p>
            <div className="mx-auto mt-6 max-w-md rounded-2xl bg-stone-50 p-4 text-left text-sm">
              <p className="font-semibold">{activeService?.name_ka}</p>
              <p className="mt-1 text-stone-600">{bookingConfirmation.treatment_date} · {bookingConfirmation.treatment_time.slice(0, 5)} · {activeService?.duration_minutes} {t("წუთი", "min")}</p>
              <p className="mt-1 font-semibold text-rose-700">{activeService?.price_gel === 0 ? t("უფასო", "Free") : `${activeService?.price_gel} ₾`}</p>
            </div>
            {bookingConfirmation.booking_code && <div className="mx-auto mt-5 max-w-md rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 p-5">
              <p className="text-sm font-semibold text-stone-700">{t("თქვენი ჯავშნის კოდი", "Your booking code")}</p>
              <p className="mt-1 text-4xl font-black tracking-[0.2em] text-rose-700">{formatBookingCode(bookingConfirmation.booking_code)}</p>
              <p className="mt-2 text-sm text-stone-600">{t("შეინახეთ კოდი ან გადაიღეთ ეკრანი. კოდით და ტელეფონის ნომრით შეგიძლიათ ჯავშნის ნახვა, გადატანა ან გაუქმება.", "Save this code or take a screenshot. With the code and your phone number you can view, move or cancel the booking.")}</p>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(bookingConfirmation.booking_code ?? "").then(() => setCodeCopied(true)).catch(() => setCodeCopied(false)); }} className="mt-3 min-h-11 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700">
                {codeCopied ? t("დაკოპირდა", "Copied") : t("კოდის კოპირება", "Copy code")}
              </button>
            </div>}
            {bookingConfirmation.manage_url && <Link href={bookingConfirmation.manage_url} className="mt-4 inline-block text-sm font-medium text-rose-700 underline">{t("ჯავშნის ნახვა და შეცვლა", "View or change booking")}</Link>}
            <div><button type="button" onClick={() => { setBookingConfirmation(null); setCodeCopied(false); setStep(1); setError(null); }} className="mt-6 rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold">{t("ახალი ჯავშანი", "Book another")}</button></div>
          </section>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold sm:text-3xl">{isDemo ? t("აირჩიეთ ვიზიტის დრო", "Choose an appointment") : salonInfo.salon_name}</h2>
              <p className="mt-2 text-sm text-stone-600">{t("სამი მარტივი ნაბიჯი: მომსახურება, დრო და საკონტაქტო ინფორმაცია.", "Three simple steps: service, time, and contact details.")}</p>
              {(salonInfo.salon_address || salonInfo.salon_phone) && <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">{salonInfo.salon_address && <span><MapPin className="mr-1 inline h-3.5 w-3.5" />{salonInfo.salon_address}</span>}{salonInfo.salon_phone && <a href={`tel:${salonInfo.salon_phone}`}><Phone className="mr-1 inline h-3.5 w-3.5" />{salonInfo.salon_phone}</a>}</p>}
            </div>

            <nav aria-label={t("ჯავშნის ნაბიჯები", "Booking steps")} className="mb-5 grid grid-cols-3 gap-2">
              {[[1, t("მომსახურება", "Service")], [2, t("დრო", "Time")], [3, t("თქვენ", "You")]].map(([index, label]) => <div key={index} className="space-y-2"><div className={`h-1.5 rounded-full ${Number(index) <= step ? "bg-rose-600" : "bg-stone-200"}`} /><p className={`text-center text-xs ${Number(index) === step ? "font-semibold text-rose-700" : "text-stone-500"}`}>{label}</p></div>)}
            </nav>

            {availabilityError && <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{availabilityError}</span><button type="button" onClick={() => fetchAvailability(treatmentDate)} className="shrink-0 font-semibold underline">{t("განახლება", "Retry")}</button></div>}
            {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            {step === 1 && <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-700">1</span><div><h3 className="font-bold">{t("რას გაიკეთებთ?", "What would you like to book?")}</h3><p className="text-xs text-stone-500">{t("აირჩიეთ ერთი მომსახურება", "Choose one service")}</p></div></div>
              {loadingAvailability && enabledServices.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">{t("მომსახურებები იტვირთება...", "Loading services...")}</p> : enabledServices.length === 0 ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{t("ონლაინ დასაჯავშნი მომსახურება ჯერ არ არის დამატებული. დაუკავშირდით სალონს.", "No services are available for online booking yet. Please contact the salon.")}</p> : <div className="space-y-2">{enabledServices.map((service) => {
                const selected = activeService?.id === service.id;
                return <button key={service.id} type="button" onClick={() => { setSelectedServiceId(service.id); setSelectedStaffId(null); setError(null); }} aria-pressed={selected} className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition ${selected ? "border-rose-400 bg-rose-50 ring-1 ring-rose-200" : "border-stone-200 hover:border-rose-200"}`}>
                  <span><span className="block font-semibold">{service.name_ka}</span><span className="mt-1 block text-xs text-stone-500">{service.duration_minutes} {t("წუთი", "min")}</span></span><span className="shrink-0 text-sm font-bold text-stone-800">{service.price_gel === 0 ? t("უფასო", "Free") : `${service.price_gel} ₾`}</span>
                </button>;
              })}</div>}
              <button type="button" disabled={!activeService || loadingAvailability} onClick={() => { setError(null); setStep(2); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{t("თარიღისა და დროის არჩევა", "Choose date and time")}<ArrowRight className="h-4 w-4" /></button>
            </section>}

            {step === 2 && <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-700">2</span><div><h3 className="font-bold">{t("აირჩიეთ დღე და თავისუფალი დრო", "Choose a day and available time")}</h3><p className="text-xs text-stone-500">{activeService?.name_ka}</p></div></div>
              {!isDemo && (salonInfo.staff ?? []).some((member) => member.service_ids.includes(activeService?.id ?? "")) && <label className="mb-4 block text-sm font-medium">{t("სპეციალისტი", "Specialist")}<select value={selectedStaffId ?? ""} onChange={(event) => { setSelectedStaffId(event.target.value || null); setError(null); }} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-3"><option value="">{t("ნებისმიერი ხელმისაწვდომი", "Any available")}</option>{(salonInfo.staff ?? []).filter((member) => member.service_ids.includes(activeService?.id ?? "")).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>}
              <label className="block text-sm font-medium">{t("თარიღი", "Date")}<input type="date" required min={georgiaDate()} value={treatmentDate} onChange={(event) => { setTreatmentDate(event.target.value); setError(null); }} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3" /></label>
              <div className="mt-5"><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">{t("თავისუფალი საათები", "Available times")}</h4>{loadingAvailability && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" />{t("იტვირთება", "Loading")}</span>}</div>
                {!isDemo && (salonInfo.staff ?? []).every((member) => !member.service_ids.includes(activeService?.id ?? "")) ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("ამ მომსახურებაზე სპეციალისტი ჯერ არ არის მიბმული. დაუკავშირდით სალონს.", "No specialist is assigned to this service yet. Please contact the salon.")}</p> : timeSlots.length === 0 && !loadingAvailability ? <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{t("ამ დღეს თავისუფალი დრო არ არის. აირჩიეთ სხვა თარიღი.", "No times are available on this day. Choose another date.")}</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{timeSlots.map((slot) => {
                  const isAvailable = isDemo ? smartAvailability.availableSlots.includes(slot) : true;
                  const selected = treatmentTime === slot;
                  return <button key={slot} type="button" aria-pressed={selected} disabled={!isAvailable || loadingAvailability} onClick={() => { setTreatmentTime(slot); setError(null); }} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${selected ? "border-rose-600 bg-rose-600 text-white" : isAvailable ? "border-stone-200 bg-white hover:border-rose-300 hover:bg-rose-50" : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 line-through"}`}>{slot}</button>;
                })}</div>}
              </div>
              <div className="mt-6 flex gap-3"><button type="button" onClick={() => setStep(1)} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold">{t("უკან", "Back")}</button><button type="button" disabled={!smartAvailability.isAvailable || !activeService || loadingAvailability} onClick={() => { setError(null); setStep(3); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{t("საკონტაქტო მონაცემები", "Contact details")}<ArrowRight className="h-4 w-4" /></button></div>
            </section>}

            {step === 3 && <form onSubmit={handleSubmit} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-sm font-bold text-rose-700">3</span><div><h3 className="font-bold">{t("თქვენი საკონტაქტო ინფორმაცია", "Your contact details")}</h3><p className="text-xs text-stone-500">{t("ჯავშნის დასადასტურებლად საჭიროა სახელი და ტელეფონი.", "Name and phone are needed to confirm your appointment.")}</p></div></div>
              <div className="mb-5 rounded-2xl bg-stone-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{activeService?.name_ka}</p><p className="mt-1 text-xs text-stone-600">{treatmentDate} · {treatmentTime} · {activeService?.duration_minutes} {t("წუთი", "min")}</p><p className="mt-1 text-xs text-stone-500">{selectedStaffId ? salonInfo.staff?.find((member) => member.id === selectedStaffId)?.full_name : t("ნებისმიერი ხელმისაწვდომი სპეციალისტი", "Any available specialist")}</p></div><p className="shrink-0 font-bold text-rose-700">{activeService?.price_gel === 0 ? t("უფასო", "Free") : `${activeService?.price_gel} ₾`}</p></div><button type="button" onClick={() => setStep(2)} className="mt-2 text-xs font-semibold text-rose-700 underline">{t("შეცვლა", "Change")}</button></div>
              <label className="mb-4 block text-sm font-medium">{t("სახელი და გვარი", "Full name")}<span className="text-rose-600"> *</span><input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3" placeholder={t("მაგ. ნინო ბერიძე", "e.g. Nino Beridze")} /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">{t("ტელეფონი", "Phone")}<span className="text-rose-600"> *</span><input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3" placeholder="+995 5XX XX XX XX" /></label><label className="block text-sm font-medium">{t("ელ-ფოსტა (არასავალდებულო)", "Email (optional)")}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-3" placeholder="name@example.com" /></label></div>
              <details className="mt-4 rounded-xl border border-stone-200 p-4"><summary className="cursor-pointer text-sm font-medium">{t("დამატებითი შენიშვნა (არასავალდებულო)", "Add a note (optional)")}</summary><textarea rows={3} maxLength={700} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-3 w-full rounded-xl border border-stone-300 p-3 text-sm" placeholder={t("დამატებითი ინფორმაცია სალონისთვის", "Anything the salon should know")} /></details>
              <input type="text" name="website" value={websiteTrap} onChange={(event) => setWebsiteTrap(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden" />
              <div className="mt-4 space-y-3"><label className="flex items-start gap-3 text-xs leading-relaxed text-stone-600"><input type="checkbox" checked={emailConsent} onChange={(event) => setEmailConsent(event.target.checked)} className="mt-0.5 accent-rose-600" /><span>{t("მსურს ელფოსტით მივიღო ვიზიტის შემდეგი შეხსენება.", "I agree to receive a follow-up reminder by email.")}</span></label><label className="flex items-start gap-3 text-xs leading-relaxed text-stone-600"><input type="checkbox" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} className="mt-0.5 accent-rose-600" /><span>{t("მსურს SMS შეტყობინებები ჯავშნისა და შეხსენებების შესახებ.", "I agree to receive booking and reminder SMS messages.")}</span></label></div>
              {!isDemo && <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} language={lang} />}
              <div className="mt-6 flex gap-3"><button type="button" onClick={() => setStep(2)} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-semibold">{t("უკან", "Back")}</button><button type="submit" disabled={submitting || !smartAvailability.isAvailable || !activeService || (!isDemo && Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? t("იგზავნება...", "Submitting...") : t("ჯავშნის დადასტურება", "Confirm booking")}<ArrowRight className="h-4 w-4" /></button></div>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />{t("თქვენი მონაცემები დაცულია და ჯავშნისთვის გამოიყენება.", "Your details are used only to manage this booking.")}</p>
            </form>}
          </>
        )}
      </main>
    </div>
  );
}

export default function PublicBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fdf8f6] flex items-center justify-center text-sm text-stone-500">
          იტვირთება ჯავშნის ფორმა... / Loading booking form...
        </div>
      }
    >
      <PublicBookingFormContent />
    </Suspense>
  );
}
