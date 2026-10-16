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
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

export default function MoergeLandingPage() {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q_ka: "როგორ მუშაობს 21-დღიანი ეპილაციის შეხსენების სისტემა?",
      q_en: "How does the automated 21-day epilation reminder engine work?",
      a_ka: "მას შემდეგ, რაც სალონის ადმინისტრატორი ვიზიტს მონიშნავს როგორც 'დასრულებული', MOERGE საქართველოს დროის სარტყელში (Asia/Tbilisi GMT+4) ავტომატურად ითვლის ზუსტად 21 კალენდარულ დღეს და ამზადებს პერსონალურ შეხსენებას. შეხსენება იგზავნება კლიენტის ელ-ფოსტაზე Resend-ის მეშვეობით, სადაც მოცემულია სალონის სახელი და პირდაპირი ჯავშნის ბმული შემდეგი ვიზიტისთვის.",
      a_en: "Once staff marks an epilation appointment as 'Completed', MOERGE calculates exactly 21 calendar days using Georgia Standard Time (Asia/Tbilisi GMT+4). The platform schedules a personalized email reminder dispatched via Resend containing the salon branding and a 1-click booking link for their next optimal cycle.",
    },
    {
      q_ka: "შეუძლია თუ არა სალონს საკუთარი სერვისების, ფასების (₾) და საათების მითითება?",
      q_en: "Can our salon configure custom services, GEL pricing, and working hours?",
      a_ka: "დიახ, 100%-ით! სალონის პარამეტრებიდან (/settings) შეგიძლიათ მიუთითოთ სალონის სახელი, მისამართი, ტელეფონი, სამუშაო საათები (მაგ: 10:00–20:00) და დაამატოთ ან შეცვალოთ ნებისმიერი პროცედურა საკუთარი ფასით ლარში (₾) და ხანგრძლივობით.",
      a_en: "Yes, 100%! From your Salon Settings panel (/settings), you can define your salon brand name, address, contact phone, operating hours (e.g., 10:00–20:00), and build a custom treatment catalog with custom GEL (₾) pricing and durations.",
    },
    {
      q_ka: "როგორ იცავს სისტემა სალონს ორმაგი ჯავშნებისგან (Double Bookings)?",
      q_en: "How does the system prevent double-bookings and time slot conflicts?",
      a_ka: "MOERGE აღჭურვილია ჭკვიანი დეტექტორით (Smart Slot Guard). როდესაც კლიენტი ირჩევს თარიღს, სისტემა რეალურ დროში ამოწმებს უკვე ჩაწერილ ვიზიტებს და ავტომატურად ბლოკავს დაკავებულ საათებს. შედეგად, ორი კლიენტი ერთსა და იმავე დროს ვერასოდეს ჩაეწერება.",
      a_en: "MOERGE features a real-time Smart Slot Guard. When a customer selects a date on your booking page, the database instantly queries existing reservations and greys out booked slots. This completely eliminates conflicting reservations.",
    },
    {
      q_ka: "სად იგზავნება ონლაინ ჩაწერის ბმული და როგორ იყენებენ მას კლიენტები?",
      q_en: "Where is our online booking link shared and how do clients use it?",
      a_ka: "თითოეულ სალონს აქვს საკუთარი უნიკალური ონლაინ ჯავშნის ბმული (მაგ: moerge.vercel.app/book). თქვენ შეგიძლიათ ეს ბმული ჩასვათ თქვენს Instagram Bio-ში, Facebook გვერდზე, TikTok-ზე ან გაუგზავნოთ კლიენტებს SMS-ით. კლიენტს არ სჭირდება აპლიკაციის გადმოწერა — გვერდი მომენტალურად იხსნება ნებისმიერ სმარტფონზე.",
      a_en: "Every salon receives a dedicated online booking link (e.g. moerge.vercel.app/book). You can paste this link in your Instagram Bio, Facebook page, Google Maps profile, or send it via SMS. Clients need no app installation—it opens seamlessly on any mobile phone browser.",
    },
    {
      q_ka: "როგორ არის დაცული სალონისა და კლიენტების მონაცემები?",
      q_en: "How is salon and customer personal data secured?",
      a_ka: "პლატფორმა იყენებს Supabase-ის Row Level Security (RLS) არქიტექტურას. თითოეული სალონის მონაცემთა ბაზა სრულად იზოლირებულია, რაც გამორიცხავს სხვა მომხმარებლების მიერ თქვენი მონაცემების ნახვას. სისტემა სრულად შეესაბამება საქართველოს კანონს „პერსონალურ მონაცემთა დაცვის შესახებ“.",
      a_en: "The platform is built on PostgreSQL Row Level Security (RLS). Each salon's customer records, schedules, and settings are fully isolated at the database level. Our infrastructure complies strictly with the Georgian Law on Personal Data Protection.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 text-white flex items-center justify-center shadow-lg shadow-rose-600/25 group-hover:scale-105 transition">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-stone-900">
                  MOERGE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                  GEORGIA • SAAS
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                {t(
                  "სალონის ჭკვიანი ჯავშნების და 21-დღიანი შეხსენებების პლატფორმა",
                  "Smart Salon Booking & 21-Day Epilation Reminder Ecosystem"
                )}
              </p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-stone-600">
            <a href="#features" className="hover:text-rose-600 transition">
              {t("ფუნქციები", "Features")}
            </a>
            <a href="#how-it-works" className="hover:text-rose-600 transition">
              {t("როგორ მუშაობს", "How It Works")}
            </a>
            <a href="#pricing" className="hover:text-rose-600 transition">
              {t("ტარიფები", "Pricing")}
            </a>
            <a href="#faq" className="hover:text-rose-600 transition">
              {t("კითხვები (FAQ)", "FAQ")}
            </a>
            <Link href="/terms" className="hover:text-rose-600 transition">
              {t("მოხმარების წესები", "Terms")}
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/book"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900 text-xs font-bold transition"
            >
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              {t("ონლაინ ჯავშანი (/book)", "Booking Page (/book)")}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {t("სალონის შესვლა", "Salon Sign In")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 lg:py-28 border-b border-rose-100">
        {/* Soft Background Accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-rose-200/30 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Hero Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100/90 border border-rose-200 text-rose-950 text-xs font-bold shadow-2xs">
              <Globe className="w-3.5 h-3.5 text-rose-600" />
              {t(
                "შექმნილია საქართველოს სალონებისთვის • Asia/Tbilisi (GMT+4) • ₾ GEL",
                "Built for Salons in Georgia • Asia/Tbilisi (GMT+4) • ₾ GEL"
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-stone-900 leading-[1.12]">
              {t("მოარგე სალონი ", "Tailor Your Salon with ")}
              <span className="bg-gradient-to-r from-rose-600 via-rose-700 to-rose-900 bg-clip-text text-transparent">
                MOERGE
              </span>
              {t(
                "-ს ჭკვიან ეკოსისტემას",
                " Smart Booking Ecosystem"
              )}
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-2xl leading-relaxed">
              {t(
                "შექმენით თქვენი სალონის პერსონალური ონლაინ ჯავშნის გვერდი ლარის ფასებით (₾), დაიცავით გრაფიკი გადაფარვისგან ჭკვიანი დეტექტორით და ავტომატურად დააბრუნეთ კლიენტები ეპილაციიდან ზუსტად 21 დღეში Resend-ის ელ-ფოსტით.",
                "Launch a branded online booking page with custom GEL pricing, eliminate scheduling double-bookings with smart slot detection, and automatically bring clients back 21 days after every epilation via Resend email."
              )}
            </p>

            {/* Hero CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-xl shadow-rose-600/25 hover:shadow-rose-600/35 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {t(
                  "სალონის რეგისტრაცია (14 დღე უფასოდ)",
                  "Register Salon (14-Day Free Trial)"
                )}
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white hover:bg-rose-50/70 text-stone-900 font-bold text-sm border border-stone-200 shadow-xs transition"
              >
                <Calendar className="w-4 h-4 text-rose-600" />
                {t(
                  "ონლაინ ჩაწერის დემო (/book)",
                  "Public Booking Demo (/book)"
                )}
              </Link>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-stone-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("საკრედიტო ბარათი არ არის საჭირო", "No credit card required")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("სრული მონაცემთა იზოლაცია (RLS)", "Isolated Salon Workspace")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {t("მორგებული თბილისის დროზე", "Exact Asia/Tbilisi Time")}
              </span>
            </div>

            {/* 3 Metrics */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-rose-100/80 text-xs">
              <div>
                <div className="font-black text-2xl text-stone-900">21 {t("დღე", "Days")}</div>
                <div className="text-stone-500 font-medium mt-0.5">
                  {t("ავტომატური ეპილაციის ციკლი", "Automated Epilation Cycle")}
                </div>
              </div>
              <div>
                <div className="font-black text-2xl text-stone-900">100% {t("მორგება", "Custom")}</div>
                <div className="text-stone-500 font-medium mt-0.5">
                  {t("სერვისები, ფასები (₾) და საათები", "Services, GEL Prices & Hours")}
                </div>
              </div>
              <div>
                <div className="font-black text-2xl text-stone-900">0% {t("კონფლიქტი", "Conflicts")}</div>
                <div className="text-stone-500 font-medium mt-0.5">
                  {t("ჭკვიანი საათების დეტექტორი", "Smart Slot Guard Protection")}
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Interactive Visual Card (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl shadow-rose-950/10 p-6 sm:p-7 space-y-5">
              {/* Salon Live Header Preview */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    M
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-stone-900">
                      Lumière Studio • თბილისი
                    </div>
                    <div className="text-[11px] text-stone-400">
                      ი. ჭავჭავაძის გამზ. 34 • 10:00 – 20:00
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
                      "დიოდური ეპილაცია — მთლიანი სხეული",
                      "Full Body Diode Laser Epilation"
                    )}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-white text-xs font-extrabold">
                    95 ₾
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>⏱ 45 {t("წთ", "min")}</span>
                  <span className="text-rose-700 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {t("+21 დღიანი ავტო-შეხსენება", "+21d Auto Reminder")}
                  </span>
                </div>
              </div>

              {/* Smart Slot Conflict Simulator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    {t("საათების არჩევა (Smart Slots)", "Real-Time Slot Guard")}
                  </span>
                  <span className="text-[11px] text-stone-400">Asia/Tbilisi</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-between">
                    <span className="line-through font-bold">11:00</span>
                    <span className="text-[10px] text-red-500 font-bold">
                      {t("დაკავებულია", "Booked")}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-between shadow-xs">
                    <span>12:00</span>
                    <span className="text-[10px] text-rose-100">
                      {t("არჩეულია", "Selected")}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center justify-between">
                    <span>13:00</span>
                    <span className="text-[10px] text-emerald-700">
                      {t("თავისუფალი", "Free")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automated Resend 21-Day Engine Simulation */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    {t(
                      "Resend 21-დღიანი შეხსენების ძრავა",
                      "Resend 21-Day Email Engine"
                    )}
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900">
                    Idempotent
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  {t(
                    "პროცედურის დასრულებისთანავე სისტემა ითვლის +21 დღეს თბილისის დროით და ავტომატურად აგზავნის მოწვევას მომდევნო ვიზიტზე.",
                    "Upon completion, MOERGE calculates +21 days in Tbilisi time and automatically dispatches a personalized booking invitation."
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
      <section className="py-16 sm:py-24 bg-white border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              {t("რატომ კარგავენ სალონები კლიენტებს?", "Why Salons Lose Clients")}
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t(
                "ძველი ქაოტური მეთოდები vs MOERGE-ის ჭკვიანი სისტემა",
                "Traditional Chaos vs MOERGE Smart Automation"
              )}
            </h2>
            <p className="mt-3 text-stone-600 text-sm sm:text-base">
              {t(
                "ნახეთ, როგორ გარდაქმნის MOERGE თქვენი სალონის ყოველდღიურ რუტინას",
                "See how MOERGE transforms your salon's daily workflow"
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Chaotic Way */}
            <div className="p-8 rounded-3xl bg-stone-50 border border-stone-200 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                ✕ {t("ძველი, არაეფექტური გზა", "The Old Inefficient Way")}
              </div>
              <h3 className="text-xl font-bold text-stone-800">
                {t("ქაოსი რვეულებსა და Instagram Direct-ში", "Notebooks & Direct Message Chaos")}
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-600">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{t("კლიენტებს ავიწყდებათ ეპილაციის 21-დღიანი ციკლი და იკარგება შედეგი.", "Clients forget their 21-day cycle, degrading treatment results.")}</span>
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

            {/* The MOERGE Way */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-rose-50/80 to-emerald-50/40 border border-rose-200 space-y-4 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                ✓ {t("MOERGE-ის ჭკვიანი ეკოსისტემა", "The MOERGE Ecosystem")}
              </div>
              <h3 className="text-xl font-bold text-stone-900">
                {t("ავტომატური ჯავშნები და 21-დღიანი ციკლი", "Automated Bookings & 21-Day Cycle")}
              </h3>
              <ul className="space-y-3 text-xs sm:text-sm text-stone-700">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("პროცედურის დასრულებიდან 21 დღეში სისტემა ავტომატურად იწვევს კლიენტს ხელმეორედ.", "System automatically emails the client at day 21 to book their next appointment.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("Smart Slot Guard რეალურ დროში ბლოკავს დაკავებულ დროს — 0% გადაფარვა.", "Smart Slot Guard locks booked hours in real-time — 0% scheduling conflicts.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("პერსონალური ონლაინ ჯავშნის ბმული თქვენი სალონის სახელით და ფასებით (₾).", "Branded public booking URL with your salon name, services, and GEL prices.")}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span>{t("Resend API ინტეგრაცია და ელ-ფოსტის სრული ისტორიის გამჭვირვალე ჟურნალი.", "Direct Resend integration with full delivery tracking and audit history.")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section id="how-it-works" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            {t("სიმარტივე და ეფექტურობა", "Simplicity & Execution")}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {t("როგორ მუშაობს MOERGE 3 მარტივ ნაბიჯში", "How MOERGE Works in 3 Simple Steps")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
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
                  "დაარეგისტრირეთ სალონის სახელი, მიუთითეთ მისამართი, სამუშაო საათები (10:00–20:00) და შეიყვანეთ თქვენი პროცედურები ფასებით ლარში (₾).",
                  "Register your salon, set operating hours (10:00–20:00), and configure your custom treatment menu with GEL pricing."
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-rose-600">
              {t("დაყენების დრო: 2 წუთი", "Setup time: 2 minutes")}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
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
                  "Add your booking link to your Instagram bio, Facebook, or SMS. Clients effortlessly choose free slots from their phone."
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-rose-600">
              {t("მობილურზე 100% ადაპტირებული", "100% Mobile Optimized")}
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-3xl border border-rose-100 p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-6xl font-black text-rose-100 absolute top-4 right-6 pointer-events-none">
              03
            </span>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-stone-900">
                {t("3. ავტომატური 21-დღიანი ციკლი", "3. 21-Day Auto Retention")}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {t(
                  "ეპილაციის დასრულებიდან 21 დღეში სისტემა ავტომატურად უგზავნის კლიენტს მოწვევას შემდეგ ვიზიტზე. კლიენტი ბრუნდება თქვენი ჩარევის გარეშე!",
                  "21 days after treatment, MOERGE automatically emails the client an invitation. Retain high-value clients effortlessly!"
                )}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-rose-50 text-xs font-semibold text-emerald-700">
              {t("+40% განმეორებითი ვიზიტები", "+40% Repeat Bookings")}
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Features Deep Dive */}
      <section id="features" className="py-16 sm:py-24 bg-white border-t border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              MOERGE PRODUCTION SUITE
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t(
                "ყველაფერი რაც თანამედროვე სალონს სჭირდება",
                "Everything a Modern Salon Ecosystem Demands"
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
                    "1. მართვადი ონლაინ ჯავშნის გვერდი",
                    "1. Customizable Booking Page"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "პარამეტრებიდან შეცვალეთ ჯავშნის გვერდის სათაური, მისამართი, სამუშაო საათები (10:00–20:00) და დაამატეთ ან შეცვალეთ სერვისები ფასებით ლარში (₾).",
                    "Edit your booking headline, salon address, working hours, and custom treatment catalog with GEL pricing directly from Settings."
                  )}
                </p>
              </div>
              <Link
                href="/book"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
              >
                {t("ჯავშნის ფორმა (/book) →", "Public Booking (/book) →")}
              </Link>
            </div>

            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "2. გამარტივებული სალონის ჩაწერა",
                    "2. 1-Step Staff Quick Booking"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "სალონის ადმინისტრატორს შეუძლია ახალი კლიენტის შექმნა და ვიზიტზე ჩაწერა ერთ ფანჯარაში, გვერდიდან გაუსვლელად, წამებში.",
                    "Salon staff can create a new walk-in client inline and record their appointment in a single modal without switching pages."
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
                    "თუ არჩეული დრო დაკავებულია, სისტემა მომენტალურად ბლოკავს ზედდებას და კლიენტს სთავაზობს იმ დღის თავისუფალ საათებს.",
                    "Automatically detects overlapping appointments and suggests free time slots on the selected date in Georgia time."
                  )}
                </p>
              </div>
              <Link
                href="/book"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
              >
                {t("სცადეთ /book გვერდზე →", "Test on /book →")}
              </Link>
            </div>

            <div className="bg-[#fdf8f6] rounded-3xl border border-rose-100 p-6 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <MailCheck className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  {t(
                    "4. Resend ელ-ფოსტის ავტომატიზაცია",
                    "4. Direct Resend Email Engine"
                  )}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {t(
                    "მიაბით თქვენი Resend API Key პირდაპირ პარამეტრებიდან, გააგზავნეთ ცოცხალი ტესტ-წერილი 1 კლიკით და აკონტროლეთ მიწოდების ისტორია.",
                    "Connect your Resend API Key directly in Settings, send a 1-click live test email, and track every delivery & retry."
                  )}
                </p>
              </div>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
              >
                {t("რეგისტრაცია →", "Register Salon →")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            {t("გამჭვირვალე ტარიფები", "Simple & Transparent Pricing")}
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            {t(
              "აირჩიეთ თქვენს სალონზე მორგებული პაკეტი",
              "Choose the Plan Tailored to Your Salon"
            )}
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base">
            {t(
              "ყველა პაკეტი მოიცავს 14-დღიან უფასო სატესტო პერიოდს. გადაიხადეთ მხოლოდ მაშინ, როცა შედეგს დაინახავთ.",
              "All plans include a 14-day free trial. No upfront credit card required."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Plan 1: Starter */}
          <div className="bg-white rounded-3xl border border-stone-200 p-8 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t("სატესტო", "Starter")}
              </span>
              <h3 className="mt-1 text-2xl font-bold text-stone-900">
                {t("დამწყები", "Starter Plan")}
              </h3>
              <p className="mt-2 text-xs text-stone-500">
                {t("ახალი და პატარა კაბინეტებისთვის", "For independent specialists")}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-stone-900">0 ₾</span>
                <span className="text-xs text-stone-500">/ 14 {t("დღე", "days")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-600 border-t border-stone-100 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("14-დღიანი სრული სატესტო წვდომა", "14-day full platform trial")}</span>
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
                  <span>{t("1 სალონის სამუშაო სივრცე", "1 dedicated salon workspace")}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/login"
              className="mt-8 w-full py-3 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900 font-bold text-xs text-center transition"
            >
              {t("უფასოდ დაწყება", "Start Free Trial")}
            </Link>
          </div>

          {/* Plan 2: Professional (Featured) */}
          <div className="bg-gradient-to-b from-stone-900 to-stone-950 text-white rounded-3xl border border-stone-800 p-8 flex flex-col justify-between shadow-2xl shadow-rose-950/20 relative">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md">
              {t("ყველაზე პოპულარული", "Most Popular")}
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                {t("პროფესიონალი", "Professional")}
              </span>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {t("Pro სალონი", "Pro Salon Plan")}
              </h3>
              <p className="mt-2 text-xs text-stone-400">
                {t("მოქმედი სილამაზის და ეპილაციის ცენტრებისთვის", "For active salons & epilation clinics")}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">49 ₾</span>
                <span className="text-xs text-stone-400">/ {t("თვეში", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-300 border-t border-stone-800 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("შეუზღუდავი ონლაინ ჯავშნები", "Unlimited online bookings")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("ავტომატური 21-დღიანი Resend შეხსენებები", "Automated 21-day Resend email cycle")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("სალონის სრული ბრენდინგი & ფასები (₾)", "Custom salon branding & GEL pricing")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("კლიენტების სრული ბაზა და CRM", "Full client management & CRM history")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{t("24/7 პრიორიტეტული მხარდაჭერა", "24/7 priority customer support")}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/login"
              className="mt-8 w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs text-center shadow-lg shadow-rose-600/30 transition cursor-pointer"
            >
              {t("დაიწყეთ 14-დღიანი ტესტი", "Start 14-Day Free Trial")}
            </Link>
          </div>

          {/* Plan 3: Studio / Network */}
          <div className="bg-white rounded-3xl border border-stone-200 p-8 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t("ქსელი", "Chain / Enterprise")}
              </span>
              <h3 className="mt-1 text-2xl font-bold text-stone-900">
                {t("სტუდიო & ქსელი", "Studio & Chain Plan")}
              </h3>
              <p className="mt-2 text-xs text-stone-500">
                {t("მრავალფილიალიანი სალონებისთვის", "For multi-location salon brands")}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black text-stone-900">99 ₾</span>
                <span className="text-xs text-stone-500">/ {t("თვეში", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3 text-xs text-stone-600 border-t border-stone-100 pt-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("ყველაფერი Pro პაკეტიდან", "Everything in Pro plan")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("მრავალი ფილიალის მართვა", "Multi-branch workspace support")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("შეუზღუდავი თანამშრომლები", "Unlimited staff logins & roles")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t("ინდივიდუალური დომენის მიბმა", "Custom domain onboarding support")}</span>
                </li>
              </ul>
            </div>

            <Link
              href="/login"
              className="mt-8 w-full py-3 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900 font-bold text-xs text-center transition"
            >
              {t("დაკავშირება & გააქტიურება", "Contact & Activate")}
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-t border-rose-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
              FAQ
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              {t("ხშირად დასმული კითხვები", "Frequently Asked Questions")}
            </h2>
          </div>

          <div className="space-y-4">
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
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-stone-900 hover:text-rose-700 transition cursor-pointer"
                  >
                    <span>{t(faq.q_ka, faq.q_en)}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-rose-600 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-rose-100/60 pt-4">
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
      <section className="py-16 bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center space-y-6 relative z-10">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-rose-200 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-300" />
            {t("დაიწყეთ დღესვე", "Start Today")}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            {t(
              "მზად ხართ გაზარდოთ თქვენი სალონის ჯავშნები?",
              "Ready to Automate Your Salon & Boost Retention?"
            )}
          </h2>
          <p className="text-rose-100/80 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            {t(
              "დაარეგისტრირეთ თქვენი სალონი 1 წუთში, შექმენით მორგებული ჯავშნის გვერდი და მიეცით საშუალება MOERGE-ს, იზრუნოს თქვენს კლიენტებზე.",
              "Set up your salon in 60 seconds, publish your custom booking link, and let MOERGE bring your clients back every 21 days."
            )}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-rose-50 text-rose-950 font-bold text-sm shadow-xl transition"
            >
              {t("სალონის რეგისტრაცია (უფასო სატესტო)", "Register Salon (Free Trial)")}
            </Link>
            <Link
              href="/book"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/20 backdrop-blur-xs transition"
            >
              {t("ონლაინ ჩაწერის დემო (/book)", "View Booking Demo (/book)")}
            </Link>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer with Legal Documents */}
      <footer className="bg-white border-t border-rose-100 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-xs text-stone-600">
          {/* Brand info (2 cols on large) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center font-black">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-stone-900 tracking-tight">
                  MOERGE
                </span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                  SaaS
                </span>
              </div>
            </div>
            <p className="text-stone-500 text-xs leading-relaxed max-w-sm">
              {t(
                "MOERGE არის სილამაზის და ეპილაციის სალონების მართვის თანამედროვე პლატფორმა საქართველოში. ჭკვიანი ონლაინ ჯავშნები, ზუსტი 21-დღიანი ციკლი და საიმედო Resend ელ-ფოსტა.",
                "MOERGE is Georgia's premier salon booking and automated 21-day care retention SaaS ecosystem. Precision timing in Asia/Tbilisi (GMT+4)."
              )}
            </p>
            <div className="text-[11px] text-stone-400">
              © {new Date().getFullYear()} MOERGE Ecosystem. {t("ყველა უფლება დაცულია.", "All rights reserved.")}
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
                  {t("ონლაინ ჯავშანი (/book)", "Public Booking (/book)")}
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
                <a href="mailto:info@moerge.ge" className="hover:text-rose-600 transition">
                  info@moerge.ge
                </a>
              </li>
              <li>
                <a href="mailto:legal@moerge.ge" className="hover:text-rose-600 transition">
                  legal@moerge.ge
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
