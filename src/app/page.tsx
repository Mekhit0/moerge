"use client";

import React from "react";
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
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

export default function MoergeLandingPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-600/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-stone-900">
                  MOERGE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                  GEORGIA • SaaS
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                {t(
                  "სალონის ჭკვიანი ჯავშნების და 21-დღიანი შეხსენებების პლატფორმა",
                  "Smart Salon Booking & 21-Day Epilation Reminder Ecosystem"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/book"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-bold transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              {t("ონლაინ ჯავშანი (/book)", "Online Booking (/book)")}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {t("სალონის პანელი", "Salon Dashboard")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 lg:py-24 border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100/80 border border-rose-200 text-rose-900 text-xs font-bold">
              <Globe className="w-3.5 h-3.5 text-rose-600" />
              {t(
                "სრულად მორგებული საქართველოზე • Asia/Tbilisi (GMT+4) • ₾ GEL",
                "Tailored for Georgia • Asia/Tbilisi (GMT+4) • ₾ GEL Pricing"
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-stone-900 leading-[1.12]">
              {t("მოარგე სალონი ", "Tailor Your Salon with ")}
              <span className="bg-gradient-to-r from-rose-600 to-rose-800 bg-clip-text text-transparent">
                MOERGE
              </span>
              {t(
                "-ს ჭკვიან ეკოსისტემას",
                " Smart Booking & Care"
              )}
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-2xl leading-relaxed">
              {t(
                "შექმენით თქვენს სალონზე მორგებული ონლაინ ჩაწერის გვერდი სერვისებითა და ფასებით (₾), მართეთ დაკავებული საათები ჭკვიანი დეტექტორით და ავტომატურად გაუგზავნეთ კლიენტებს Resend-ის ელ-ფოსტის შეხსენება ეპილაციიდან ზუსტად 21 დღეში.",
                "Launch a customizable online booking page with GEL pricing, prevent double-bookings with real-time slot conflict detection, and automatically send Resend email reminders 21 days after every completed epilation."
              )}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition"
              >
                <Sparkles className="w-4 h-4" />
                {t(
                  "გახსენით ონლაინ ჯავშნის გვერდი (/book)",
                  "Try Custom Online Booking (/book)"
                )}
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white hover:bg-rose-50 text-stone-900 font-bold text-sm border border-stone-200 shadow-xs transition"
              >
                <LayoutDashboard className="w-4 h-4 text-rose-600" />
                {t(
                  "სალონის მართვის პანელი",
                  "Open Salon Staff Dashboard"
                )}
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-3 gap-4 border-t border-rose-100/80 text-xs">
              <div>
                <div className="font-black text-lg text-stone-900">21 დღე</div>
                <div className="text-stone-500">
                  {t(
                    "ავტომატური ეპილაციის ციკლი",
                    "Automated Epilation Cycle"
                  )}
                </div>
              </div>
              <div>
                <div className="font-black text-lg text-stone-900">
                  100% Custom
                </div>
                <div className="text-stone-500">
                  {t(
                    "სერვისები, ფასები (₾) და საათები",
                    "Services, GEL Prices & Hours"
                  )}
                </div>
              </div>
              <div>
                <div className="font-black text-lg text-stone-900">
                  Resend API
                </div>
                <div className="text-stone-500">
                  {t(
                    "პირდაპირი ელ-ფოსტის მიწოდება",
                    "Direct Email Delivery & Logs"
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Interactive Ecosystem Preview Card (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl shadow-rose-950/10 p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-stone-900">
                      MOERGE Studio • თბილისი
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Asia/Tbilisi (GMT+4) • 10:00 – 20:00
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  ● Production Ready
                </span>
              </div>

              {/* Sample Custom Service Card */}
              <div className="p-4 rounded-2xl bg-[#fdf8f6] border border-rose-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">
                    {t(
                      "დიოდური ეპილაცია — მთლიანი სხეული",
                      "Full Body Diode Laser Epilation"
                    )}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-white text-xs font-extrabold">
                    120 ₾
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>⏱ 60 {t("წთ", "min")}</span>
                  <span className="text-rose-700 font-semibold">
                    ✓ {t("+21 დღიანი შეხსენება", "+21d Auto Reminder")}
                  </span>
                </div>
              </div>

              {/* Sample Smart Slot Conflict Demo */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  {t(
                    "ჭკვიანი საათების კონტროლი (Smart Slots)",
                    "Smart Slot Availability Detector"
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-400 flex items-center justify-between">
                    <span className="line-through font-bold">11:00</span>
                    <span className="text-[10px] text-red-500 font-semibold">
                      {t("დაკავებული", "Booked")}
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

              {/* Sample Automated Resend Email Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    {t(
                      "Resend 21-დღიანი შეხსენება",
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

              <div className="pt-1 flex items-center justify-between text-xs">
                <Link
                  href="/settings"
                  className="font-bold text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  {t(
                    "გვერდის და Resend-ის გამართვა →",
                    "Customize Page & Resend →"
                  )}
                </Link>
                <Link
                  href="/login"
                  className="font-semibold text-stone-500 hover:text-stone-900"
                >
                  {t("პერსონალის შესვლა →", "Staff Login →")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Production Features Section */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            MOERGE PRODUCTION SUITE
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-stone-900">
            {t(
              "ყველაფერი რაც თანამედროვე სალონს სჭირდება ერთ სისტემაში",
              "Everything a Modern Beauty & Epilation Salon Needs"
            )}
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs flex flex-col justify-between">
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
              href="/settings"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
            >
              {t("კონსტრუქტორის ნახვა →", "Open Customizer →")}
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs flex flex-col justify-between">
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
              href="/appointments"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
            >
              {t("ვიზიტების მართვა →", "Manage Appointments →")}
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs flex flex-col justify-between">
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

          <div className="bg-white rounded-3xl border border-rose-100 p-6 shadow-xs flex flex-col justify-between">
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
              href="/email-history"
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
            >
              {t("ელ-ფოსტის ჟურნალი →", "View Email Logs →")}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-rose-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-black text-stone-900">MOERGE</span>
            <span>•</span>
            <span>
              {t(
                "საქართველოს სალონების ჯავშნის და 21-დღიანი შეხსენების სისტემა (Asia/Tbilisi)",
                "Salon Booking & 21-Day Reminder Ecosystem (Asia/Tbilisi)"
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-semibold text-stone-600">
            <Link href="/book" className="hover:text-rose-600">
              {t("ონლაინ ჯავშანი (/book)", "Online Booking (/book)")}
            </Link>
            <Link href="/dashboard" className="hover:text-rose-600">
              {t("მთავარი პანელი", "Dashboard")}
            </Link>
            <Link href="/appointments" className="hover:text-rose-600">
              {t("ვიზიტები", "Appointments")}
            </Link>
            <Link href="/settings" className="hover:text-rose-600">
              {t("პარამეტრები & Resend", "Settings & Resend")}
            </Link>
            <Link href="/login" className="hover:text-rose-600">
              {t("შესვლა", "Sign In")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
