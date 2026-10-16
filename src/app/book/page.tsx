"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  User,
  Mail,
  Phone,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Ban,
  RefreshCw,
  MapPin,
  Settings,
} from "lucide-react";
import {
  CustomBookingService,
  DEFAULT_CUSTOM_SERVICES,
  TreatmentType,
} from "@/lib/types";
import { isEpilationTreatment } from "@/lib/validation";
import {
  generateDynamicTimeSlots,
  evaluateSmartSlotAvailability,
} from "@/lib/scheduling";
import {
  LanguageSwitcher,
  getTreatmentLabel,
  useLanguage,
} from "@/lib/i18n";

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
}

function PublicBookingFormContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const salonSlugParam = searchParams.get("salon") ?? "";
  const prefillName = searchParams.get("name") ?? "";
  const prefillEmail = searchParams.get("email") ?? "";

  const [salonInfo, setSalonInfo] = useState<PublicSalonInfo>({
    found: true,
    salon_name: "MOERGE Epilation & Beauty Studio",
    timezone: "Asia/Tbilisi",
    brand_color: "#e11d48",
    reminder_interval_days: 21,
    booking_title: "დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online",
    booking_subtitle:
      "აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური შეხსენება შემდეგ ვიზიტზე.",
    salon_address: "თბილისი, ჭავჭავაძის გამზ. 34",
    salon_phone: "+995 555 00 11 22",
    working_hours_start: "10:00",
    working_hours_end: "20:00",
    slot_interval_minutes: 60,
    custom_services: DEFAULT_CUSTOM_SERVICES,
  });

  // Default to tomorrow's date in Georgia timezone
  const [treatmentDate, setTreatmentDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [treatmentTime, setTreatmentTime] = useState("11:00");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    DEFAULT_CUSTOM_SERVICES[0].id
  );
  const [fullName, setFullName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [emailConsent, setEmailConsent] = useState(true);

  const [bookedTimesOnDate, setBookedTimesOnDate] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

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
      try {
        const params = new URLSearchParams();
        if (salonSlugParam) params.set("salon", salonSlugParam);
        if (dateStr) params.set("date", dateStr);
        const res = await fetch(`/api/public/book?${params.toString()}`);
        const data: PublicSalonInfo = await res.json();
        if (data?.found) {
          setSalonInfo(data);
          const times = data.availability?.booked_times ?? [];
          setBookedTimesOnDate(times);
        }
      } catch {
        // Keep existing state on network hiccup
      } finally {
        setLoadingAvailability(false);
      }
    },
    [salonSlugParam]
  );

  useEffect(() => {
    fetchAvailability(treatmentDate);
  }, [treatmentDate, fetchAvailability]);

  // Evaluate smart availability in real time for the selected time and all dynamic salon slots
  const smartAvailability = useMemo(
    () =>
      evaluateSmartSlotAvailability(
        treatmentTime,
        bookedTimesOnDate,
        45,
        dynamicCandidateSlots
      ),
    [treatmentTime, bookedTimesOnDate, dynamicCandidateSlots]
  );

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

    setSubmitting(true);

    const serviceName = lang === "ka" ? activeService.name_ka : activeService.name_en;
    const composedNotes = [
      `${serviceName} (${activeService.price_gel} ₾, ${activeService.duration_minutes} min)`,
      notes.trim(),
    ]
      .filter(Boolean)
      .join(" — ");

    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_slug: salonSlugParam || null,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          treatment_date: treatmentDate,
          treatment_time: treatmentTime,
          treatment_type: activeService ? (activeService.id || activeService.type) : "custom",
          service_id: activeService?.id || null,
          notes: composedNotes.slice(0, 1000) || null,
          email_consent: emailConsent,
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
    }
  }

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-rose-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-500/20"
            >
              <Sparkles className="w-5 h-5" />
            </Link>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex flex-wrap items-center gap-1 sm:gap-1.5">
                <span>{t("ონლაინ ჩაწერა", "Online Booking")}</span>
                <span className="text-stone-300">•</span>
                <span className="text-stone-400 font-semibold">MOERGE</span>
                <span className="text-stone-300 hidden sm:inline">•</span>
                <span className="hidden sm:inline">🇬🇪 {salonInfo.timezone || "Asia/Tbilisi"}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-stone-900 truncate max-w-[200px] sm:max-w-xs">
                {salonInfo.salon_name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-stone-200 hover:border-rose-200 bg-white transition"
            >
              <Settings className="w-3.5 h-3.5" />
              {t("გვერდის მორგება", "Customize Page")}
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-stone-700 hover:text-rose-600 px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 hover:border-rose-200 bg-white transition whitespace-nowrap"
            >
              {t("პანელი →", "Portal →")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10">
        {/* Salon Custom Banner */}
        <div className="mb-8 bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900">
              {salonInfo.booking_title ||
                t(
                  "დაჯავშნეთ თქვენი ვიზიტი ონლაინ",
                  "Book Your Visit Online"
                )}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
              {salonInfo.booking_subtitle ||
                t(
                  "აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური შეხსენება შემდეგ ვიზიტზე.",
                  "Pick your preferred treatment, check real-time availability, and receive courtesy follow-up reminders."
                )}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-stone-600 shrink-0 bg-[#fdf8f6] p-4 rounded-2xl border border-rose-100">
            {salonInfo.salon_address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium text-stone-800">
                  {salonInfo.salon_address}
                </span>
              </div>
            )}
            {salonInfo.salon_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium text-stone-800">
                  {salonInfo.salon_phone}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium text-stone-800">
                {t("სამუშაო საათები:", "Hours:")}{" "}
                {salonInfo.working_hours_start || "10:00"} –{" "}
                {salonInfo.working_hours_end || "20:00"}
              </span>
            </div>
          </div>
        </div>

        {bookingConfirmation ? (
          /* Booking Confirmation Card */
          <div className="max-w-xl mx-auto bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-8 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {bookingConfirmation.is_returning_client
                ? t(
                    "კეთილი იყოს თქვენი დაბრუნება! მიება თქვენს პროფილს",
                    "Welcome Back! Linked to Your Client Profile"
                  )
                : t(
                    "შეიქმნა ახალი კლიენტის პროფილი",
                    "New Client Profile Created"
                  )}
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-stone-900">
              {t("თქვენი ვიზიტი დაჯავშნილია!", "Your Appointment is Booked!")}
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              {t(
                `გმადლობთ, ${fullName}. თქვენი ჯავშანი სალონში „${bookingConfirmation.salon_name}“ დადასტურებულია და ასახულია განრიგში.`,
                `Thank you, ${fullName}. Your booking at ${bookingConfirmation.salon_name} has been confirmed and added to our salon schedule.`
              )}
            </p>

            <div className="mt-6 p-5 rounded-2xl bg-[#fdf8f6] border border-rose-100 text-left space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">
                  {t("პროცედურა:", "Treatment:")}
                </span>
                <strong className="text-stone-900">
                  {getTreatmentLabel(
                    bookingConfirmation.treatment_type,
                    lang,
                    salonInfo.custom_services
                  )}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">
                  {t("ღირებულება:", "Price:")}
                </span>
                <strong className="text-rose-700">
                  {activeService.price_gel} ₾ ({activeService.duration_minutes}{" "}
                  {t("წთ", "min")})
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{t("თარიღი:", "Date:")}</span>
                <strong className="text-stone-900">
                  {bookingConfirmation.treatment_date}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">
                  {t("დრო", "Time")} ({salonInfo.timezone}):
                </span>
                <strong className="text-stone-900">
                  {String(bookingConfirmation.treatment_time).slice(0, 5)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">
                  {t("ელ-ფოსტა:", "Client Email:")}
                </span>
                <strong className="text-stone-900">{email}</strong>
              </div>
            </div>

            {(activeService.is_epilation ||
              isEpilationTreatment(bookingConfirmation.treatment_type)) &&
              emailConsent && (
                <div className="mt-5 p-4 rounded-2xl bg-rose-50/70 border border-rose-100 text-xs text-rose-900 leading-relaxed">
                  <strong>
                    {t(
                      "მოვლისა და შეხსენების სერვისი ჩართულია:",
                      "Care & Reminder Service Included:"
                    )}
                  </strong>{" "}
                  {t(
                    "პროცედურის დასრულების შემდეგ ავტომატურად მიიღებთ შეხსენებას ელ-ფოსტაზე მომდევნო ვიზიტის დასაგეგმად.",
                    "Once your session is completed, we will automatically send you a courtesy email reminder when it's time for your next appointment."
                  )}
                </div>
              )}

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setBookingConfirmation(null);
                  setNotes("");
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                {t("ახალი ჯავშნის დამატება", "Book Another Appointment")}
              </button>
              <Link
                href="/appointments"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition"
              >
                {t("სალონის განრიგში ნახვა →", "View in Salon Dashboard →")}
              </Link>
            </div>
          </div>
        ) : (
          /* Booking Form */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Treatment & Date/Time Selection (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                    {t("ნაბიჯი 1 / 2", "Step 1 of 2")}
                  </span>
                  <span className="text-[11px] font-semibold text-stone-400">
                    {t(
                      "ფასები მოცემულია ლარში (₾ GEL)",
                      "Prices in Georgian Lari (₾ GEL)"
                    )}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-stone-900">
                  {t(
                    "აირჩიეთ სასურველი პროცედურა",
                    "Choose Your Treatment & Service"
                  )}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {t(
                    "სერვისების და ფასების შეცვლა სალონს შეუძლია პირდაპირ პარამეტრების გვერდიდან.",
                    "Services and pricing are dynamically managed by the salon in Settings."
                  )}
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {enabledServices.map((srv) => {
                    const selected = activeService.id === srv.id;
                    const title = lang === "ka" ? srv.name_ka : srv.name_en;
                    const desc = lang === "ka" ? srv.desc_ka : srv.desc_en;

                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServiceId(srv.id)}
                        className={`text-left p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                          selected
                            ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20"
                            : "border-stone-200 hover:border-rose-200 bg-white"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-sm text-stone-900 leading-snug">
                              {title}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold shrink-0">
                              {srv.price_gel} ₾
                            </span>
                          </div>
                          {desc && (
                            <p className="mt-1.5 text-xs text-stone-500 leading-snug">
                              {desc}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            {srv.duration_minutes} {t("წთ", "min")}
                          </span>
                          {srv.is_epilation && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              {t("ავტო-შეხსენება", "Auto Reminder")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart Date & Time Availability Selector */}
              <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-600" />
                    {t(
                      `აირჩიეთ სასურველი თარიღი და დრო (${salonInfo.timezone || "Asia/Tbilisi"})`,
                      `Select Preferred Date & Time (${salonInfo.timezone || "Asia/Tbilisi"})`
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    {loadingAvailability ? (
                      <span className="inline-flex items-center gap-1 text-stone-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        {t("მოწმდება განრიგი...", "Checking schedule...")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {t(
                          `${smartAvailability.availableSlots.length} თავისუფალი საათი`,
                          `${smartAvailability.availableSlots.length} slots available`
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                      {t("სასურველი თარიღი *", "Preferred Date *")}
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={treatmentDate}
                      onChange={(e) => {
                        setTreatmentDate(e.target.value);
                        setError(null);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                      {t("დროის არჩევა (24-სთ)", "Custom Time (24h HH:MM)")}
                    </label>
                    <input
                      type="time"
                      required
                      value={treatmentTime}
                      onChange={(e) => {
                        setTreatmentTime(e.target.value);
                        setError(null);
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        smartAvailability.isAvailable
                          ? "border-stone-200 focus:ring-rose-500"
                          : "border-red-400 bg-red-50/40 text-red-900 focus:ring-red-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Smart Conflict Alert when selected/custom time is NOT available */}
                {!smartAvailability.isAvailable && (
                  <div
                    role="alert"
                    data-testid="smart-slot-conflict-banner"
                    className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900">
                          {t(
                            `დრო ${treatmentTime} დაკავებულია!`,
                            `Time ${treatmentTime} is not available!`
                          )}
                        </p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          {t(
                            `ამ დროს (${smartAvailability.conflictingTime}-ზე) უკვე ჩანიშნულია ვიზიტი. გთხოვთ აირჩიოთ ქვემოთ მოცემული თავისუფალი საათებიდან ერთ-ერთი:`,
                            `There is already an appointment scheduled at ${smartAvailability.conflictingTime}. Please select one of the available times below:`
                          )}
                        </p>
                      </div>
                    </div>

                    {smartAvailability.availableSlots.length > 0 ? (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                          {t("თავისუფალი საათები:", "Suggested Free Times:")}
                        </span>
                        {smartAvailability.availableSlots.map((freeSlot) => (
                          <button
                            key={freeSlot}
                            type="button"
                            onClick={() => {
                              setTreatmentTime(freeSlot);
                              setError(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            {freeSlot} ✓
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <span className="text-amber-900 font-semibold">
                          {t(
                            "ამ თარიღზე ყველა სტანდარტული საათი დაკავებულია.",
                            "All standard slots on this date are booked."
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextDay = new Date(
                              new Date(`${treatmentDate}T12:00:00Z`).getTime() +
                                86_400_000
                            )
                              .toISOString()
                              .slice(0, 10);
                            setTreatmentDate(nextDay);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-800 text-white font-semibold text-xs cursor-pointer"
                        >
                          {t("შემდეგი დღის ნახვა →", "Check Next Day →")}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Smart Interactive Time Slot Grid */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-500" />
                      {t(
                        `სალონის საათების განრიგი (${salonInfo.working_hours_start || "10:00"} – ${salonInfo.working_hours_end || "20:00"})`,
                        `Salon Time Slots (${salonInfo.working_hours_start || "10:00"} – ${salonInfo.working_hours_end || "20:00"})`
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {t("თავისუფალია", "Available")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        {t("დაკავებულია", "Booked")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {dynamicCandidateSlots.map((slot) => {
                      const slotStatus = smartAvailability.standardSlots.find(
                        (s) => s.time === slot
                      );
                      const isAvailable = slotStatus
                        ? slotStatus.available
                        : true;
                      const isSelected = treatmentTime === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setTreatmentTime(slot);
                            setError(null);
                          }}
                          className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex items-center justify-between ${
                            !isAvailable
                              ? isSelected
                                ? "bg-red-100 border-red-400 text-red-900 ring-2 ring-red-400/30"
                                : "bg-stone-100/80 border-stone-200 text-stone-400 hover:border-red-200"
                              : isSelected
                              ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                              : "bg-stone-50 text-stone-800 border-stone-200 hover:bg-rose-50 hover:border-rose-200"
                          }`}
                        >
                          <div>
                            <div
                              className={`text-xs font-bold ${
                                !isAvailable && !isSelected
                                  ? "line-through"
                                  : ""
                              }`}
                            >
                              {slot}
                            </div>
                            <div
                              className={`text-[10px] font-medium ${
                                !isAvailable
                                  ? "text-red-600"
                                  : isSelected
                                  ? "text-rose-100"
                                  : "text-emerald-700"
                              }`}
                            >
                              {!isAvailable
                                ? t("დაკავებულია", "Booked")
                                : t("თავისუფალია", "Available")}
                            </div>
                          </div>
                          {!isAvailable ? (
                            <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          ) : (
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? "bg-white" : "bg-emerald-500"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {bookedTimesOnDate.length > 0 && (
                    <p className="mt-2.5 text-[11px] text-stone-500">
                      {t(
                        `ამ თარიღზე უკვე დაჯავშნილი საათებია: ${bookedTimesOnDate.join(", ")}`,
                        `Already booked times on this date: ${bookedTimesOnDate.join(", ")}`
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Client Details & Submit (5 cols) */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-3xl border border-rose-100 shadow-lg shadow-rose-950/5 p-6 sm:p-8 space-y-4 sticky top-24"
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                    {t("ნაბიჯი 2 / 2", "Step 2 of 2")}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-stone-900">
                    {t(
                      "თქვენი საკონტაქტო მონაცემები",
                      "Your Contact Information"
                    )}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {t(
                      "არსებული კლიენტები ავტომატურად იძებნება ელ-ფოსტის მისამართით.",
                      "Returning clients are automatically matched by email address."
                    )}
                  </p>
                </div>

                {/* Selected Summary Pill */}
                <div className="p-3.5 rounded-2xl bg-[#fdf8f6] border border-rose-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-stone-900">
                      {lang === "ka"
                        ? activeService.name_ka
                        : activeService.name_en}
                    </div>
                    <div className="text-stone-500 mt-0.5">
                      {treatmentDate} • {treatmentTime} (
                      {activeService.duration_minutes} {t("წთ", "min")})
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-rose-600">
                    {activeService.price_gel} ₾
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    {suggestedSlotsFromServer.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {suggestedSlotsFromServer.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setTreatmentTime(slot);
                              setError(null);
                              setSuggestedSlotsFromServer([]);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            {t(`აირჩიეთ ${slot}`, `Pick ${slot}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("სრული სახელი და გვარი *", "Full Name *")}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("ნინო ბერიძე", "Nino Beridze")}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t("ელ-ფოსტის მისამართი *", "Email Address *")}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nino.beridze@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t(
                      "ტელეფონის ნომერი (არასავალდებულო)",
                      "Phone Number (Optional)"
                    )}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+995 555 12 34 56"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {t(
                      "შეტყობინებები იგზავნება მხოლოდ ელ-ფოსტით (Resend).",
                      "Notifications are sent exclusively by email (Resend)."
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    {t(
                      "შენიშვნა ან კომენტარი (არასავალდებულო)",
                      "Notes or Special Requests (Optional)"
                    )}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t(
                      "სასურველი ზონები, კანის მგრძნობელობა...",
                      "Areas to treat, skin sensitivity notes..."
                    )}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailConsent}
                    onChange={(e) => setEmailConsent(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs text-stone-700 leading-relaxed">
                    {t(
                      "თანახმა ვარ მივიღო ელ-ფოსტის შეხსენება პროცედურის დასრულების შემდეგ მომდევნო ვიზიტის დასაჯავშნად.",
                      "Send me a courtesy email reminder after my treatment so I know when to book my next session."
                    )}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting || !smartAvailability.isAvailable}
                  className="w-full py-3.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {submitting
                    ? t("ჯავშანი იგზავნება...", "Confirming Booking...")
                    : !smartAvailability.isAvailable
                    ? t(
                        "აირჩიეთ თავისუფალი საათი",
                        "Select an Available Time Slot"
                      )
                    : t("ვიზიტის დაჯავშნა", "Confirm Appointment Booking")}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {t(
                      "MOERGE Smart Booking • მხოლოდ ელ-ფოსტის შეხსენება",
                      "MOERGE Smart Booking • Email-Only Reminders"
                    )}
                  </span>
                </div>
              </form>
            </div>
          </div>
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
