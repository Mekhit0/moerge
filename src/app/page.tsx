"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  Clock,
  MailCheck,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Zap,
  Globe,
  LayoutDashboard,
  Send,
  Users,
  ChevronDown,
  Check,
  Building2,
  HelpCircle,
  FileText,
  Lock,
  Smartphone,
  TrendingUp,
  HeartHandshake,
  BellRing,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export default function MoargeLandingPage() {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroSlot, setHeroSlot] = useState<"11:00" | "12:00" | "13:00">("12:00");
  const [heroConflictMsg, setHeroConflictMsg] = useState<string | null>(null);

  const faqs = [
    {
      q_ka: "როგორ მუშაობს ავტომატური შეხსენებების სისტემა?",
      q_en: "How does the automated client reminder engine work?",
      a_ka: "სერვისის დასრულების შემდეგ moarge სერვისის recall პერიოდს იყენებს კლიენტისთვის შემდგომი შეხსენების დასაგეგმად. დაგეგმილ ვიზიტამდე შესაძლებელია 24-საათიანი და 2-საათიანი შეხსენებებიც. არხი დამოკიდებულია კლიენტის თანხმობაზე. საცდელ პერიოდში იგზავნება მხოლოდ ელფოსტა.",
      a_en: "After a service is completed, moarge uses that service's recall period to schedule a follow-up. It can also queue 24-hour and 2-hour appointment reminders. Delivery channels follow the client's consent. Trial accounts use email only.",
    },
    {
      q_ka: "შეუძლია თუ არა სალონს საკუთარი სერვისების, ფასების (₾) და საათების მითითება?",
      q_en: "Can our salon configure custom services, GEL pricing, and working hours?",
      a_ka: "პარამეტრებში შეგიძლიათ მიუთითოთ სალონის სახელი, მისამართი, ტელეფონი, სამუშაო საათები და დაამატოთ სერვისები საკუთარი ფასითა და ხანგრძლივობით.",
      a_en: "In settings you can enter your salon name, address, phone, working hours, and services with their prices and durations.",
    },
    {
      q_ka: "როგორ იცავს სისტემა სალონს ორმაგი ჯავშნებისგან (Double Bookings)?",
      q_en: "How does the system prevent double-bookings and time slot conflicts?",
      a_ka: "ხელმისაწვდომი ժամები ითვალისწინებს სპეციალისტის განრიგს, სერვისის ხანგრძლივობას, შესვენებებს, დასვენების დროს და უკვე არსებულ ჯავშნებს. მონაცემთა ბაზა ერთ სპეციალისტზე აქტიურ დროის გადაფარვას კრძალავს.",
      a_en: "Available times account for staff schedules, service duration, breaks, time off, and existing appointments. A database constraint prevents overlapping active appointments for the same staff member.",
    },
    {
      q_ka: "სად იგზავნება ონლაინ ჩაწერის ბმული და როგორ იყენებენ მას კლიენტები?",
      q_en: "Where is our online booking link shared and how do clients use it?",
      a_ka: "თითოეულ სალონს აქვს საკუთარი უნიკალური ონლაინ ჯავშნის ბმული. თქვენ შეგიძლიათ ეს ბმული ჩასვათ თქვენს Instagram Bio-ში, Facebook გვერდზე, TikTok-ზე ან გაუგზავნოთ კლიენტებს მესენჯერით/SMS-ით. კლიენტს არ სჭირდება აპლიკაციის გადმოწერა — გვერდი მომენტალურად იხსნება ნებისმიერ სმარტფონზე.",
      a_en: "Every salon receives a dedicated, auto-generated online booking URL. You can place this link in your Instagram bio, Facebook, Google Maps, or send via SMS. Clients need no app download—it opens instantly and cleanly in any smartphone browser.",
    },
    {
      q_ka: "როგორ არის დაცული სალონისა და კლიენტების მონაცემები?",
      q_en: "How is salon and customer personal data secured?",
      a_ka: "სალონის მონაცემებზე წვდომა წევრობისა და მონაცემთა ბაზის Row Level Security წესებით იზღუდება. შეტყობინებები იგზავნება მხოლოდ შესაბამისი არხის თანხმობისას. შეამოწმეთ თქვენი ორგანიზაციის მონაცემთა დაცვის ვალდებულებები.",
      a_en: "Salon records are restricted by membership and database Row Level Security policies. Notifications are sent only when the client has consented to that channel. Review your organization's data protection obligations.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "moarge",
    operatingSystem: "All (Web Browser, iOS, Android)",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: String(BILLING_CONFIG.plans.business.monthlyGel),
      priceCurrency: "GEL",
      priceValidUntil: "2027-12-31",
    },
    description:
      "სალონის მართვის, ონლაინ ჯავშნების და კლიენტების ავტომატური შეხსენებების თანამედროვე პლატფორმა საქართველოში.",
  };

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col font-sans selection:bg-rose-200 selection:text-rose-950">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <MoargeLogo size="md" variant="icon" />
            <div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 block leading-none">
                moarge
              </span>
              <p className="text-[11px] text-stone-500 hidden sm:block font-medium mt-1">
                {t(
                  "სალონის მართვა & ჭკვიანი შეხსენებები",
                  "Smart Salon Booking & Automated Retention"
                )}
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-stone-600">
            <a href="#features" className="hover:text-rose-600 transition">
              {t("შესაძლებლობები", "Features")}
            </a>
            <a href="#how-it-works" className="hover:text-rose-600 transition">
              {t("როგორ მუშაობს", "How It Works")}
            </a>
            <a href="#benefits" className="hover:text-rose-600 transition">
              {t("უპირატესობები", "Benefits")}
            </a>
            <a href="#pricing" className="hover:text-rose-600 transition">
              {t("ტარიფები", "Pricing")}
            </a>
            <a href="#faq" className="hover:text-rose-600 transition">
              {t("კითხვები", "FAQ")}
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            <Link
              href="/book"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900 text-xs font-bold transition"
            >
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              {t("ონლაინ ჯავშანი", "Online Booking")}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {t("შესვლა", "Sign In")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-24 border-b border-rose-100">
        {/* Soft Background Accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-rose-200/35 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Hero Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* Clean, Sharp Marketing Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100/90 border border-rose-200 text-rose-950 text-xs font-bold shadow-2xs">
              <BellRing className="w-3.5 h-3.5 text-rose-600" />
              {t(
                "ჭკვიანი ონლაინ ჯავშნები და ავტომატური შეხსენებები",
                "Smart Online Booking & Automated Client Retention"
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-stone-900 leading-[1.14]">
              {t("მოარგეთ სალონი ", "Tailor Your Salon with ")}
              <span className="bg-gradient-to-r from-rose-600 via-rose-700 to-rose-900 bg-clip-text text-transparent">
                moarge
              </span>
              {t("-ს ჭკვიან ავტომატიზაციას", "-s Smart Automation")}
            </h1>

            <p className="text-sm sm:text-lg text-stone-600 max-w-2xl leading-relaxed">
              {t(
                "ონლაინ ჯავშნები, სპეციალისტების პარალელური განრიგები, კლიენტების ისტორია და თანხმობაზე დაფუძნებული ელფოსტისა და SMS შეხსენებები.",
                "Online booking, parallel staff schedules, client history, and consent-based email and SMS reminders."
              )}
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/login?mode=signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xl shadow-rose-600/25 hover:shadow-rose-600/35 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t("სალონის რეგისტრაცია (14 დღე უფასოდ)", "Register Salon (14-Day Free Trial)")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/book"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white hover:bg-rose-50/70 text-stone-900 font-bold text-sm border border-stone-200 shadow-xs transition"
              >
                <Calendar className="w-4 h-4 text-rose-600" />
                <span>{t("ონლაინ ჯავშნის ნახვა", "View Online Booking")}</span>
              </Link>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-stone-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("საკრედიტო ბარათი არ არის საჭირო", "No credit card required")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("მონაცემთა სრული იზოლაცია და უსაფრთხოება", "Isolated & Secure Workspace")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("სწრაფი გაშვება 2 წუთში", "Ready in 2 minutes")}
              </span>
            </div>

            {/* 3 Metrics */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-rose-100/80 text-xs">
              <div className="bg-white/60 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-rose-100">
                <div className="font-black text-2xl text-stone-900">24h / 2h</div>
                <div className="font-bold text-stone-800 mt-0.5">
                  {t("შეხსენების დრო", "Reminder timing")}
                </div>
                <div className="text-stone-500 mt-0.5 text-[11px]">
                  {t("ვიზიტამდე", "Before appointments")}
                </div>
              </div>
              <div className="bg-white/60 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-rose-100">
                <div className="font-black text-2xl text-stone-900">{t("მრავალი", "Multiple")}</div>
                <div className="font-bold text-stone-800 mt-0.5">
                  {t("სპეციალისტი", "Staff calendars")}
                </div>
                <div className="text-stone-500 mt-0.5 text-[11px]">
                  {t("პარალელური განრიგები", "Working in parallel")}
                </div>
              </div>
              <div className="bg-white/60 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-rose-100">
                <div className="font-black text-2xl text-stone-900">{BILLING_CONFIG.plans.business.staffIncluded}</div>
                <div className="font-bold text-stone-800 mt-0.5">
                  {t("ბიზნეს გეგმაში", "Included in Business")}
                </div>
                <div className="text-stone-500 mt-0.5 text-[11px]">
                  {t("სერვისები, ფასები და საათები", "Services, GEL prices & hours")}
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Interactive Visual Card (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl shadow-rose-950/10 p-5 sm:p-7 space-y-5">
              {/* Salon Live Header Preview */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    M
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-stone-900">
                      moarge Demo Salon
                    </div>
                    <div className="text-[11px] text-stone-400">
                      თბილისი • 10:00 – 20:00
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  ● Live Booking
                </span>
              </div>

              {/* Sample Custom Service Row */}
              <div className="p-4 rounded-2xl bg-[#fdf8f6] border border-rose-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">
                    {t(
                      "დიოდური ლაზერული ეპილაცია",
                      "Diode Laser Hair Removal"
                    )}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-white text-xs font-extrabold">
                    95 ₾
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>⏱ 45 {t("წუთი", "mins")}</span>
                  <span className="text-rose-700 font-semibold flex items-center gap-1">
                    <BellRing className="w-3 h-3" />
                    {t("ავტომატური შეხსენება", "Automated Care Reminder")}
                  </span>
                </div>
              </div>

              {/* Smart Slot Conflict Simulator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    {t("საათების არჩევა (სატესტო სიმულატორი)", "Interactive Slot Guard")}
                  </span>
                  <span className="text-[11px] text-stone-400">Asia/Tbilisi</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroConflictMsg(
                        t(
                          "⚠️ 11:00 უკვე დაკავებულია — moarge ავტომატურად ბლოკავს გადაფარვას!",
                          "⚠️ 11:00 is already booked — moarge blocks overlapping slots!"
                        )
                      )
                    }
                    className="p-2 sm:p-2.5 rounded-xl bg-stone-100 hover:bg-red-50/70 border border-stone-200 hover:border-red-200 text-stone-400 hover:text-red-600 flex items-center justify-between transition cursor-pointer"
                    title={t("დაკავებული საათი (დააჭირეთ ტესტირებისთვის)", "Booked slot (click to test conflict guard)")}
                  >
                    <span className="line-through font-bold">11:00</span>
                    <span className="text-[10px] text-red-500 font-bold">
                      {t("დაკავებულია", "Booked")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroSlot("12:00");
                      setHeroConflictMsg(null);
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl font-bold flex items-center justify-between transition cursor-pointer ${
                      heroSlot === "12:00"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                    }`}
                  >
                    <span>12:00</span>
                    <span
                      className={`text-[10px] ${
                        heroSlot === "12:00" ? "text-rose-100" : "text-emerald-700"
                      }`}
                    >
                      {heroSlot === "12:00" ? t("არჩეულია", "Selected") : t("თავისუფალი", "Free")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroSlot("13:00");
                      setHeroConflictMsg(null);
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl font-bold flex items-center justify-between transition cursor-pointer ${
                      heroSlot === "13:00"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                    }`}
                  >
                    <span>13:00</span>
                    <span
                      className={`text-[10px] ${
                        heroSlot === "13:00" ? "text-rose-100" : "text-emerald-700"
                      }`}
                    >
                      {heroSlot === "13:00" ? t("არჩეულია", "Selected") : t("თავისუფალი", "Free")}
                    </span>
                  </button>
                </div>
                {heroConflictMsg && (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900 animate-in fade-in">
                    {heroConflictMsg}
                  </div>
                )}
              </div>

              {/* Automated Smart Reminder Simulation */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    {t(
                      "ჭკვიანი შეხსენების ძრავა",
                      "Smart Client Reminder Engine"
                    )}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900">
                    Automated
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  {t(
                    "სერვისის დასრულების შემდეგ moarge გეგმავს სერვისზე მორგებულ შემდგომ შეხსენებას. ვიზიტამდე შესაძლებელია 24-საათიანი და 2-საათიანი შეტყობინებები.",
                    "After a service, moarge schedules its service-specific follow-up. Appointment reminders can be sent 24 hours and 2 hours before a visit."
                  )}
                </p>
              </div>

              {/* Bottom Quick Links */}
              <div className="pt-1 flex items-center justify-between text-xs">
                <Link
                  href="/book"
                  className="font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {t("ჯავშნის ფორმის გახსნა →", "Open Booking Form →")}
                </Link>
                <Link
                  href="/login"
                  className="font-semibold text-stone-500 hover:text-stone-900"
                >
                  {t("სალონის შესვლა →", "Salon Sign In →")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Comparison Section */}
      <section id="benefits" className="py-14 sm:py-20 bg-white border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              {t("რატომ კარგავენ სალონები კლიენტებს?", "Why Salons Lose Clients")}
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t(
                "ძველი ქაოტური მეთოდები vs moarge-ის ჭკვიანი სისტემა",
                "Traditional Chaos vs moarge Smart Automation"
              )}
            </h2>
            <p className="mt-3 text-stone-600 text-xs sm:text-base">
              {t(
                "ნახეთ, როგორ გარდაქმნის moarge თქვენი სალონის ყოველდღიურ რუტინას",
                "See how moarge transforms your salon's daily workflow"
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* The Old Chaotic Way */}
            <div className="p-6 sm:p-8 rounded-3xl bg-stone-50 border border-stone-200 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                ✕ {t("ძველი, არაეფექტური გზა", "The Old Inefficient Way")}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-800">
                {t("ქაოსი რვეულებსა და Instagram Direct-ში", "Notebooks & Direct Message Chaos")}
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-600">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{t("კლიენტებს ავიწყდებათ მოვლისა და შემდეგი ვიზიტის დრო, რის გამოც სალონი კარგავს შემოსავალს.", "Clients forget follow-up care schedules, causing lost revenue.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{t("ორმაგი ჯავშნები და უხერხული სიტუაციები გადაფარებული საათების გამო.", "Accidental double-bookings causing awkward client delays.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{t("ადმინისტრატორი საათობით ზის ტელეფონზე შეხსენებების სათითაოდ დასარეკად.", "Staff spends hours manually calling or texting each client.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{t("არ არსებობს კლიენტების ერთიანი ელექტრონული ისტორია და სტატისტიკა.", "No single source of truth for customer history or retention.")}</span>
                </li>
              </ul>
            </div>

            {/* The moarge Way */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-rose-50/80 to-emerald-50/40 border border-rose-200 space-y-4 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                ✓ {t("moarge-ის ჭკვიანი ეკოსისტემა", "The moarge Ecosystem")}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                {t("ავტომატური ჯავშნები და კლიენტების დაბრუნება", "Automated Bookings & Client Retention")}
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("პროცედურის დასრულების შემდეგ სისტემა ავტომატურად უგზავნის კლიენტს პერსონალურ შეხსენებას.", "System automatically sends courtesy reminders when it's time for their next visit.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("სისტემა ამოწმებს განრიგს და მონაცემთა ბაზა კრძალავს ერთი სპეციალისტის აქტიური ჯავშნების გადაფარვას.", "Availability checks schedules, and the database prevents overlapping active appointments for the same staff member.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("პერსონალური ონლაინ ჯავშნის ბმული თქვენი სალონის სახელით და ფასებით (₾).", "Branded public booking URL with your salon name, services, and GEL prices.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("ელ-ფოსტის სრული ისტორიის გამჭვირვალე ჟურნალი და კლიენტების CRM.", "Full delivery tracking, customer CRM records, and complete transparency.")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section id="how-it-works" className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            {t("სიმარტივე და ეფექტურობა", "Simplicity & Execution")}
          </span>
          <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {t("როგორ მუშაობს moarge 3 მარტივ ნაბიჯში", "How moarge Works in 3 Simple Steps")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative">
          {/* Step 1 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-6xl font-black text-rose-100 absolute top-4 right-6 pointer-events-none">
              01
            </span>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-stone-900">
                {t("1. მოარგეთ თქვენი სალონი", "1. Set Up Your Salon")}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {t(
                  "მიუთითეთ სალონის სახელი, სამუშაო საათები (10:00–20:00), აირჩიეთ მზა თემფლეითი ან შეიყვანეთ თქვენი პროცედურები ფასებით ლარში (₾).",
                  "Set your salon name, operating hours (10:00–20:00), apply preset templates or configure custom services with GEL pricing."
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-rose-600">
              {t("მზა სერვისის შაბლონები", "Ready-made service templates")}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-6xl font-black text-rose-100 absolute top-4 right-6 pointer-events-none">
              02
            </span>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-stone-900">
                {t("2. გააზიარეთ ჯავშნის ბმული", "2. Share Your Booking Link")}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {t(
                  "ჩასვით თქვენი ავტო-გენერირებული ონლაინ ჯავშნის ბმული Instagram Bio-ში ან Facebook-ზე. კლიენტები თავად ირჩევენ დროს და ეწერებიან 24/7.",
                  "Share your booking link on social media. Clients choose from available services, staff, dates, and times on mobile."
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-rose-600">
              {t("მობილურზე მორგებული ჯავშნის გვერდი", "Mobile-friendly booking page")}
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-6xl font-black text-rose-100 absolute top-4 right-6 pointer-events-none">
              03
            </span>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-stone-900">
                {t("3. ავტომატური შეხსენებები", "3. Automated Retention")}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {t(
                  "შეხსენებები იგეგმება სერვისის recall პერიოდით და ვიზიტამდე 24 საათითა და 2 საათით ადრე.",
                  "Reminders use each service's recall period and can also be scheduled 24 hours and 2 hours before appointments."
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-emerald-700">
              {t("არხის თანხმობის მიხედვით", "Based on channel consent")}
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Features Deep Dive */}
      <section id="features" className="py-14 sm:py-20 bg-white border-t border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              moarge SUITE
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t(
                "ყველაფერი რაც თანამედროვე სალონს სჭირდება",
                "Everything a Modern Salon Needs to Grow"
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "1. მორგებული ონლაინ ჯავშნის გვერდი",
                    "1. Branded Online Booking Page"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "სალონის სათაური, მისამართი, სამუშაო საათები (10:00–20:00) და სერვისები ფასებით ლარში (₾) — სრულად თქვენი კონტროლის ქვეშ.",
                    "Your salon branding, address, operating hours, and custom services with GEL pricing — fully under your control."
                  )}
                </p>
              </div>
              <Link
                href="/book"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
              >
                {t("ონლაინ ჯავშნის ნახვა →", "View Online Booking →")}
              </Link>
            </div>

            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "2. სწრაფი ადმინისტრატორის ჩაწერა",
                    "2. 1-Step Fast Appointment Booking"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "ახალი კლიენტის დამატება და ვიზიტზე ჩაწერა ერთ ფანჯარაში, გვერდიდან გაუსვლელად, ფასისა და ხანგრძლივობის ავტო-შევსებით.",
                    "Record appointments inline with instant client registration, auto-filled pricing in GEL, and procedure durations."
                  )}
                </p>
              </div>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
              >
                {t("პანელში შესვლა →", "Sign In to Dashboard →")}
              </Link>
            </div>

            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "3. ჭკვიანი საათების დეტექტორი",
                    "3. Smart Time Conflict Guard"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "სისტემა მომენტალურად ბლოკავს გადაფარვას და კლიენტს სთავაზობს რეალურად თავისუფალ საათებს პროცედურის ხანგრძლივობის გათვალისწინებით.",
                    "Instantly prevents overlapping appointments and suggests open slots based on the exact procedure duration."
                  )}
                </p>
              </div>
              <Link
                href="/book"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
              >
                {t("ჯავშნის ტესტირება →", "Test Booking →")}
              </Link>
            </div>

            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <MailCheck className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "4. ავტომატური შეხსენებების ძრავა",
                    "4. Automated Care Reminder Engine"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "24-საათიანი და 2-საათიანი ვიზიტის შეხსენებები, სერვისის recall და თანხმობაზე დაფუძნებული ელფოსტა ან SMS.",
                    "24-hour and 2-hour appointment reminders, service recall, and consent-based email or SMS."
                  )}
                </p>
              </div>
              <Link
                href="/login?mode=signup"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
              >
                {t("რეგისტრაცია →", "Register Salon →")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            {t("გამჭვირვალე ტარიფები", "Simple & Transparent Pricing")}
          </span>
          <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {t(
              "აირჩიეთ თქვენს სალონზე მორგებული პაკეტი",
              "Choose the Plan Tailored to Your Salon"
            )}
          </h2>
          <p className="mt-3 text-stone-600 text-xs sm:text-base">
            {t(
              "დაიწყეთ 14-დღიანი უფასო საცდელი პერიოდით ან პირდაპირ აირჩიეთ ფასიანი პაკეტი.",
              "Try moarge free for 14 days, or go straight to a paid plan."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Plan 1: Trial */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t("უფასო საცდელი", "Free trial")}
              </span>
              <h3 className="mt-1 text-xl sm:text-2xl font-bold text-stone-900">
                {t("ფუნქციების გაცნობა", "Explore the features")}
              </h3>
              <p className="mt-2 text-xs text-stone-500">
                {t("გაეცანით moarge-ის შესაძლებლობებს უფასო საცდელ პერიოდში", "Explore moarge features during the free trial")}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-stone-900">0 ₾</span>
                <span className="text-xs text-stone-500">/ 14 {t("დღე", "days")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-600 border-t border-stone-100 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("ბარათის გარეშე, 14 დღე", "14 days, no card required")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("ონლაინ ჯავშნის გვერდი", "Public online booking portal")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("ჭკვიანი საათების დეტექტორი", "Smart Slot Conflict Guard")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t(`${BILLING_CONFIG.plans.business.staffIncluded} სპეციალისტამდე და ${BILLING_CONFIG.plans.business.branches} ფილიალი`, `Up to ${BILLING_CONFIG.plans.business.staffIncluded} staff and ${BILLING_CONFIG.plans.business.branches} branch`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("მხოლოდ ელფოსტა, SMS არ იგზავნება", "Email only, SMS is not sent")}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/register"
              className="mt-8 w-full py-3 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900 font-bold text-xs text-center transition"
            >
              {t("საცდელი პერიოდის დაწყება", "Start free trial")}
            </Link>
          </div>

          {/* Plan 2: Business (Featured) */}
          <div className="bg-gradient-to-b from-stone-900 to-stone-950 text-white rounded-3xl border border-stone-800 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-rose-950/20 relative">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md whitespace-nowrap">
              {t("ერთი ფილიალისთვის", "One branch")}
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                {t("ბიზნესი", "Business")}
              </span>
              <h3 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                {t("ბიზნეს გეგმა", "Business plan")}
              </h3>
              <p className="mt-2 text-xs text-stone-400">
                {t("ერთი ფილიალის სალონებისთვის", "For single-branch salons")}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">{BILLING_CONFIG.plans.business.monthlyGel} ₾</span>
                <span className="text-xs text-stone-400">/ {t("თვეში", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-300 border-t border-stone-800 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t(`${BILLING_CONFIG.plans.business.staffIncluded} სპეციალისტი შედის, დამატებითი თითოეული თვეში ₾${BILLING_CONFIG.extraStaffMonthlyGel}`, `${BILLING_CONFIG.plans.business.staffIncluded} staff included, ₾${BILLING_CONFIG.extraStaffMonthlyGel}/month for each extra staff member`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t(`თვეში ${BILLING_CONFIG.plans.business.sms} SMS შედის`, `${BILLING_CONFIG.plans.business.sms} SMS included each month`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("კლიენტების სრული ბაზა და CRM", "Full client management & CRM history")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t(`SMS ზედმეტი ხარჯის ლიმიტი ₾${BILLING_CONFIG.defaultSmsOverageCapGel}`, `SMS overage cap of ₾${BILLING_CONFIG.defaultSmsOverageCapGel}`)}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/login?mode=signup&plan=business"
              className="mt-8 w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs text-center shadow-lg shadow-rose-600/30 transition cursor-pointer"
            >
              {t("Business-ის არჩევა", "Choose Business")}
            </Link>
          </div>

          {/* Plan 3: Multi-branch */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t("მრავალი ფილიალი", "Multi-branch")}
              </span>
              <h3 className="mt-1 text-xl sm:text-2xl font-bold text-stone-900">
                {t("მრავალფილიალიანი გეგმა", "Multi-branch plan")}
              </h3>
              <p className="mt-2 text-xs text-stone-500">
                {t(`მრავალი ფილიალისა და ${BILLING_CONFIG.plans.multi_branch.staffLimit}-მდე სპეციალისტისთვის`, `For multiple branches and up to ${BILLING_CONFIG.plans.multi_branch.staffLimit} staff`)}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-stone-900">{BILLING_CONFIG.plans.multi_branch.monthlyGel} ₾</span>
                <span className="text-xs text-stone-500">/ {t("თვეში", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-600 border-t border-stone-100 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t(`თვეში ${BILLING_CONFIG.plans.multi_branch.sms.toLocaleString("en-US")} SMS შედის`, `${BILLING_CONFIG.plans.multi_branch.sms.toLocaleString("en-US")} SMS included each month`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("მრავალი ფილიალის მართვა", "Multi-branch workspace support")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t(`${BILLING_CONFIG.plans.multi_branch.staffLimit}-მდე სპეციალისტი`, `Up to ${BILLING_CONFIG.plans.multi_branch.staffLimit} staff`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t(`${BILLING_CONFIG.plans.multi_branch.branches} ფილიალი შედის`, `${BILLING_CONFIG.plans.multi_branch.branches} branches included`)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t(`${BILLING_CONFIG.plans.multi_branch.branches + 1}-ე ფილიალიდან ₾${BILLING_CONFIG.extraBranchMonthlyGel}/თვე თითოეულზე`, `₾${BILLING_CONFIG.extraBranchMonthlyGel}/month per branch from branch ${BILLING_CONFIG.plans.multi_branch.branches + 1}`)}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/login?mode=signup&plan=multi_branch"
              className="mt-8 w-full py-3 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900 font-bold text-xs text-center transition"
            >
              {t("Multi-branch-ის არჩევა", "Choose Multi-branch")}
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-relaxed text-stone-500">
          {t(`3, 6 და 12 თვის წინასწარ გადახდისას ძირითადი საფასურის ფასდაკლებაა ${BILLING_CONFIG.prepaidDiscounts[3]}%, ${BILLING_CONFIG.prepaidDiscounts[6]}% და ${BILLING_CONFIG.prepaidDiscounts[12]}%. დამატებითი სპეციალისტები და SMS მოხმარება ყოველთვიურად ირიცხება. ლიმიტს ზემოთ თითო SMS ₾${BILLING_CONFIG.smsOveragePriceGel.toFixed(2)} ღირს. წინასწარი პაკეტის ფასი არის ₾${BILLING_CONFIG.smsPackPriceGel.toFixed(2)} თითო SMS-ზე, მინიმუმ ${BILLING_CONFIG.smsPackMinimum}. ბარათით რეალური გადახდა ჯერ არ არის ჩართული.`, `Prepaid terms of 3, 6, and 12 months discount the base price by ${BILLING_CONFIG.prepaidDiscounts[3]}%, ${BILLING_CONFIG.prepaidDiscounts[6]}%, and ${BILLING_CONFIG.prepaidDiscounts[12]}%. Extra staff and SMS usage are billed monthly. SMS over quota costs ₾${BILLING_CONFIG.smsOveragePriceGel.toFixed(2)} each. Prepaid packs cost ₾${BILLING_CONFIG.smsPackPriceGel.toFixed(2)} per SMS, with a minimum of ${BILLING_CONFIG.smsPackMinimum}. Live card payments are not enabled yet.`)}
        </p>
        <div className="mt-5 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-800 transition hover:border-rose-300 hover:bg-rose-50">
            {t("ფასებისა და პირობების ნახვა", "View full pricing details")}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-14 sm:py-20 bg-white border-t border-rose-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              FAQ
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t("ხშირად დასმული კითხვები", "Frequently Asked Questions")}
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-rose-100 bg-[#fdf8f6] overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-4 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-stone-900 hover:text-rose-700 transition cursor-pointer"
                  >
                    <span>{t(faq.q_ka, faq.q_en)}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-rose-600 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-rose-100/60 pt-4">
                      {t(faq.a_ka, faq.a_en)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ready to Upgrade CTA Banner */}
      <section className="py-14 sm:py-16 bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5 sm:space-y-6 relative z-10">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-rose-200 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-300" />
            {t("დაიწყეთ დღესვე", "Start Today")}
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            {t(
              "მზად ხართ გაზარდოთ თქვენი სალონის ჯავშნები?",
              "Ready to Automate Your Salon & Boost Retention?"
            )}
          </h2>
          <p className="text-rose-100/80 max-w-2xl mx-auto text-xs sm:text-base leading-relaxed">
            {t(
              "დაარეგისტრირეთ თქვენი სალონი 1 წუთში, შექმენით მორგებული ჯავშნის გვერდი და მიეცით საშუალება moarge-ს, ავტომატური შეხსენებებით სტაბილურად დააბრუნოს კლიენტები.",
              "Set up your salon in 60 seconds, publish your custom booking page, and let moarge bring clients back with automated reminders."
            )}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/login?mode=signup"
              className="w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white hover:bg-rose-50 text-rose-950 font-bold text-sm shadow-xl transition"
            >
              {t("სალონის რეგისტრაცია (უფასო სატესტო)", "Register Salon (Free Trial)")}
            </Link>
            <Link
              href="/book"
              className="w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/20 backdrop-blur-xs transition"
            >
              {t("ონლაინ ჯავშნის ნახვა", "View Online Booking")}
            </Link>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer with Legal Documents */}
      <footer className="bg-white border-t border-rose-100 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-xs text-stone-600">
          {/* Brand info (2 cols on large) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <MoargeLogo size="md" variant="full" />
            </Link>
            <p className="text-stone-500 text-xs leading-relaxed max-w-sm">
              {t(
                "moarge აერთიანებს ონლაინ ჯავშნებს, სპეციალისტების განრიგს, კლიენტების ბაზას და თანხმობაზე დაფუძნებულ ელფოსტასა და SMS შეხსენებებს.",
                "moarge brings together online booking, staff schedules, client records, and consent-based email and SMS reminders."
              )}
            </p>
            <div className="text-[11px] text-stone-400">
              © {new Date().getFullYear()} moarge. {t("ყველა უფლება დაცულია.", "All rights reserved.")}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
              {t("პროდუქტი", "Product")}
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/book" className="hover:text-rose-600 transition">
                  {t("ონლაინ ჯავშანი", "Online Booking")}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-rose-600 transition">
                  {t("სალონის შესვლა", "Salon Sign In")}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-rose-600 transition">
                  {t("მართვის პანელი", "Dashboard")}
                </Link>
              </li>
              <li>
                <Link href="/appointments" className="hover:text-rose-600 transition">
                  {t("ვიზიტების განრიგი", "Appointments")}
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-rose-600 transition">
                  {t("პარამეტრები & სერვისები", "Settings & Services")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Documents */}
          <div className="space-y-3">
            <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
              {t("ლეგალური დოკუმენტები", "Legal & Security")}
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="hover:text-rose-600 font-medium transition flex items-center gap-1">
                  <FileText className="w-3 h-3 text-stone-400" />
                  {t("მოხმარების წესები (Terms)", "Terms of Service")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-rose-600 font-medium transition flex items-center gap-1">
                  <Lock className="w-3 h-3 text-stone-400" />
                  {t("კონფიდენციალურობის პოლიტიკა", "Privacy Policy")}
                </Link>
              </li>
              <li className="pt-2 text-[11px] text-stone-400">
                {t(
                  "საქართველოს კანონი „პერსონალურ მონაცემთა დაცვის შესახებ“",
                  "Compliant with Georgian Personal Data Law"
                )}
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-3">
            <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
              {t("კონტაქტი", "Contact & Support")}
            </div>
            <ul className="space-y-2 text-stone-600">
              <li>თბილისი, საქართველო</li>
              <li>
                <a href="mailto:info@moarge.com" className="hover:text-rose-600 transition">
                  info@moarge.com
                </a>
              </li>
              <li>
                <a href="mailto:legal@moarge.com" className="hover:text-rose-600 transition">
                  legal@moarge.com
                </a>
              </li>
              <li className="text-[11px] text-stone-400 pt-1">
                Asia/Tbilisi (GMT+4)
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
