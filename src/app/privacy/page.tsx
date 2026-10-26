"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Database,
  Mail,
  UserCheck,
  FileCheck2,
  HelpCircle,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";

export default function PrivacyPolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <MoargeLogo size="md" variant="icon" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-stone-900 leading-none">
                  moarge
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  SECURITY & PRIVACY
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t("კონფიდენციალურობის პოლიტიკა", "Privacy Policy")}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("მთავარზე დაბრუნება", "Back to Home")}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* Document Header Card */}
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-8 sm:p-12 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                GDPR & GEORGIAN LAW COMPLIANT
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                {t("კონფიდენციალურობის პოლიტიკა", "Privacy Policy")}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 border-t border-b border-rose-50 py-3 mt-6">
            <span>
              <strong>{t("საფუძველი:", "Legal Basis:")}</strong> საქართველოს კანონი „პერსონალურ მონაცემთა დაცვის შესახებ“
            </span>
            <span>•</span>
            <span>
              <strong>{t("განახლებულია:", "Last Updated:")}</strong> 2026 წლის 16 ოქტომბერი
            </span>
          </div>

          <p className="mt-6 text-sm sm:text-base text-stone-600 leading-relaxed">
            {t(
              "moarge-ში ჩვენ განსაკუთრებულ პატივს ვცემთ თქვენი და თქვენი კლიენტების პერსონალური ინფორმაციის უსაფრთხოებას. წინამდებარე პოლიტიკა განმარტავს, თუ რა მონაცემებს ვაგროვებთ, როგორ ვამუშავებთ და როგორ ვიცავთ მათ საქართველოს მოქმედი კანონმდებლობისა და საერთაშორისო სტანდარტების შესაბამისად.",
              "At moarge, we prioritize the confidentiality and integrity of your data and that of your salon customers. This Privacy Policy details the types of personal data we collect, our processing grounds, and the technical safeguards employed under the Law of Georgia on Personal Data Protection."
            )}
          </p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8 text-stone-700 text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("1. რა მონაცემებს ვაგროვებთ", "1. Personal Data We Collect")}
              </h2>
            </div>
            <p>
              {t(
                "moarge ამუშავებს მხოლოდ იმ მონაცემებს, რომლებიც აუცილებელია სალონის ფუნქციონირებისა და ჯავშნის სერვისის განსახორციელებლად:",
                "moarge only collects and processes information strictly necessary for appointment booking and salon management:"
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#fdf8f6] border border-rose-100">
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-rose-600" />
                  {t("სალონის ანგარიშის მონაცემები", "Salon Account Data")}
                </h4>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4">
                  <li>{t("სალონის დასახელება და მისამართი", "Salon name and physical address")}</li>
                  <li>{t("ადმინისტრატორის სახელი და ელ-ფოსტა", "Staff / owner name and email address")}</li>
                  <li>{t("სამუშაო საათები და მომსახურების კატალოგი (₾)", "Working hours and service catalog (GEL)")}</li>
                  <li>{t("Resend API Key (თუ სალონი ინდივიდუალურად აკონფიგურირებს)", "Resend API Key (if provided by salon)")}</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  {t("კლიენტების ჯავშნის მონაცემები", "Client Booking Data")}
                </h4>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4">
                  <li>{t("კლიენტის სახელი და გვარი", "Client full name")}</li>
                  <li>{t("ტელეფონის ნომერი (SMS დადასტურებისთვის)", "Mobile phone number")}</li>
                  <li>{t("ელ-ფოსტის მისამართი (ავტომატური შეხსენებებისთვის)", "Email address (for automated care reminders)")}</li>
                  <li>{t("ვიზიტის თარიღი, დრო და არჩეული პროცედურა", "Appointment date, slot time & service type")}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("2. მონაცემთა დამუშავების კანონიერი მიზნები", "2. Lawful Purposes of Data Processing")}
              </h2>
            </div>
            <p>
              {t(
                "შეგროვებული პერსონალური მონაცემები გამოიყენება შემდეგი მიზნებისთვის:",
                "Collected personal data is utilized for the following explicit purposes:"
              )}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-600 text-xs sm:text-sm">
              <li>
                <strong>{t("ჯავშნების ორგანიზება:", "Booking Management:")}</strong>{" "}
                {t(
                  "სალონის განრიგში ვიზიტის ასახვა, დაკავებული საათების დეტექცია და ორმაგი ჯავშნების გამორიცხვა.",
                  "Allocating appointment slots, verifying real-time availability, and eliminating double bookings."
                )}
              </li>
              <li>
                <strong>{t("ავტომატური შეხსენების მიწოდება:", "Automated Reminder Delivery:")}</strong>{" "}
                {t(
                  "პროცედურის დასრულების შემდეგ კლიენტისთვის მოწვევის ავტომატური გაგზავნა მოვლის ციკლის შესაბამისად.",
                  "Automating optimal follow-up invitations post-procedure via Resend email."
                )}
              </li>
              <li>
                <strong>{t("სალონის მართვა:", "Salon Operations:")}</strong>{" "}
                {t(
                  "კლიენტების ვიზიტების ისტორიისა და სტატუსების აღრიცხვა სალონის ადმინისტრაციის მიერ.",
                  "Maintaining comprehensive appointment history and attendance status records."
                )}
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("3. მონაცემთა უსაფრთხოება და ტექნიკური გარანტიები", "3. Security Architecture & RLS Isolation")}
              </h2>
            </div>
            <p>
              {t(
                "moarge იყენებს თანამედროვე უსაფრთხოების მრავალდონიან სისტემას:",
                "moarge implements multi-tiered enterprise-grade security protocols:"
              )}
            </p>
            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
                <Database className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-stone-900">{t("Row Level Security (RLS):", "Row Level Security (RLS):")}</strong>{" "}
                  {t(
                    "მონაცემთა ბაზის დონეზე თითოეული სალონის მონაცემები სრულად იზოლირებულია. ერთი სალონის პერსონალი ვერასოდეს ნახავს სხვა სალონის კლიენტებს ან ჩანაწერებს.",
                    "Database-level multi-tenant policies ensure complete workspace isolation. No salon can ever view or access data of another salon."
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60">
                <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-stone-900">{t("დაშიფვრა ტრანზიტში და მოსვენებისას:", "End-to-End Encryption:")}</strong>{" "}
                  {t(
                    "ყველა კომუნიკაცია დაცულია თანამედროვე TLS/SSL დაშიფვრით და Supabase Auth-ის დაცული სესიებით.",
                    "All network data is transmitted over TLS/SSL encryption with hardened Supabase authentication tokens."
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("4. მონაცემთა გადაცემა მესამე პირებზე", "4. Third-Party Service Providers")}
              </h2>
            </div>
            <p>
              {t(
                "moarge არასოდეს ყიდის ან გადასცემს პერსონალურ მონაცემებს სარეკლამო ან მარკეტინგულ სააგენტოებს. მონაცემთა დამუშავებაში მონაწილეობენ მხოლოდ სანდო ინფრასტრუქტურული პროვაიდერები:",
                "moarge never sells personal data to advertisers or data brokers. Data is processed exclusively by audited infrastructure partners:"
              )}
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-stone-600 text-xs sm:text-sm">
              <li>
                <strong>Supabase:</strong>{" "}
                {t("მონაცემთა ბაზა, ავთენტიფიკაცია და დაშიფრული შენახვა (PostgreSQL).", "Database infrastructure, authentication & storage (PostgreSQL).")}
              </li>
              <li>
                <strong>Resend:</strong>{" "}
                {t("ოფიციალური SMTP და API პროვაიდერი ტრანზაქციული მეილების გასაგზავნად.", "Dedicated transactional email delivery engine.")}
              </li>
              <li>
                <strong>Vercel:</strong>{" "}
                {t("გლობალური Edge ჰოსტინგი და აპლიკაციის ინფრასტრუქტურა.", "Global application hosting and serverless functions.")}
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                5
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("5. მომხმარებლისა და კლიენტის კანონიერი უფლებები", "5. Data Subject Rights")}
              </h2>
            </div>
            <p>
              {t(
                "საქართველოს კანონმდებლობის შესაბამისად, თქვენ გაქვთ უფლება:",
                "Under the Georgian Law on Personal Data Protection, data subjects have the right to:"
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                ✓ <strong>{t("მონაცემთა გაცნობა:", "Right to Access:")}</strong>{" "}
                {t("მიიღოთ ინფორმაცია თქვენ შესახებ დამუშავებულ მონაცემებზე.", "Obtain confirmation and copy of personal data processed.")}
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                ✓ <strong>{t("მონაცემთა გასწორება:", "Right to Rectification:")}</strong>{" "}
                {t("მოითხოვოთ არასწორი ან არაზუსტი მონაცემების განახლება.", "Request update or correction of incomplete data.")}
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                ✓ <strong>{t("მონაცემთა წაშლა:", "Right to Erasure:")}</strong>{" "}
                {t("მოითხოვოთ თქვენი მონაცემების სრული წაშლა ბაზიდან.", "Request permanent deletion of records ('Right to be Forgotten').")}
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                ✓ <strong>{t("შეტყობინებებზე უარი:", "Opt-out from Reminders:")}</strong>{" "}
                {t("ნებისმიერ დროს შეწყვიტოთ შეხსენებების მიღება.", "Unsubscribe or stop receiving follow-up notifications.")}
              </div>
            </div>
          </section>
        </div>

        {/* Support & Contact Card */}
        <div className="mt-12 bg-emerald-50/60 rounded-3xl border border-emerald-200/70 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-emerald-700 flex items-center justify-center shadow-xs shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {t("მონაცემთა დაცვის ოფიცერი (DPO)", "Data Protection Inquiries")}
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                {t(
                  "კითხვების ან მოთხოვნების შემთხვევაში დაგვიკავშირდით: privacy@moarge.ge",
                  "For privacy inquiries, contact our data protection team: privacy@moarge.ge"
                )}
              </p>
            </div>
          </div>
          <Link
            href="/terms"
            className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shrink-0"
          >
            {t("მოხმარების წესები →", "Terms of Service →")}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-rose-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-black text-stone-900">moarge</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} moarge Ecosystem. {t("ყველა უფლება დაცულია.", "All rights reserved.")}</span>
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/" className="hover:text-rose-600">
              {t("მთავარი", "Home")}
            </Link>
            <Link href="/terms" className="hover:text-rose-600">
              {t("მოხმარების წესები", "Terms")}
            </Link>
            <Link href="/privacy" className="text-emerald-700">
              {t("კონფიდენციალურობა", "Privacy")}
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
