"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  FileText,
  Calendar,
  Lock,
  Scale,
  Building2,
  Mail,
  HelpCircle,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoergeLogo from "@/components/MoergeLogo";

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#fdf8f6] text-stone-900 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <MoergeLogo size="md" variant="icon" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-stone-900 leading-none">
                  MOERGE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                  LEGAL
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {t("მოხმარების წესები და პირობები", "Terms of Service")}
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
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                MOERGE • {t("სამართლებრივი პირობები", "Legal Terms")}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                {t("მომსახურების წესები და პირობები", "Terms of Service")}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 border-t border-b border-rose-50 py-3 mt-6">
            <span>
              <strong>{t("ვერსია:", "Version:")}</strong> 2.0 (Production)
            </span>
            <span>•</span>
            <span>
              <strong>{t("ძალაში შესვლის თარიღი:", "Effective Date:")}</strong> 2026 წლის 16 ოქტომბერი
            </span>
            <span>•</span>
            <span>
              <strong>{t("რეგიონი:", "Jurisdiction:")}</strong> საქართველო (Georgia)
            </span>
          </div>

          <p className="mt-6 text-sm sm:text-base text-stone-600 leading-relaxed">
            {t(
              "წინამდებარე ხელშეკრულება წარმოადგენს იურიდიულად სავალდებულო შეთანხმებას MOERGE-ის პლატფორმის მომხმარებელსა (სალონის მფლობელი, ადმინისტრატორი, პერსონალი ან კლიენტი) და MOERGE-ის ადმინისტრაციას შორის. სისტემით სარგებლობით თქვენ ადასტურებთ, რომ სრულად ეთანხმებით ქვემოთ მოცემულ წესებს.",
              "These Terms of Service constitute a legally binding agreement between the user of the MOERGE platform (salon owner, staff, or customer) and MOERGE. By accessing or using the platform, you acknowledge and agree to comply with all terms set forth herein."
            )}
          </p>
        </div>

        {/* Legal Sections */}
        <div className="space-y-8 text-stone-700 text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("1. ტერმინთა განმარტება და პლატფორმის არსი", "1. Definitions & Scope of Platform")}
              </h2>
            </div>
            <p>
              {t(
                "MOERGE არის ღრუბლოვანი პროგრამული უზრუნველყოფა (SaaS), რომელიც განკუთვნილია სილამაზის, თავის მოვლისა და ესთეტიკური სალონებისთვის. პლატფორმა მოიცავს ონლაინ ჯავშნების მართვას, სალონის განრიგის ორგანიზებას, ჭკვიან დროის კონტროლს (Smart Slot Guard) და პროცედურების შემდგომ ავტომატურ საინფორმაციო შეხსენებებს ელ-ფოსტის (Resend) მეშვეობით.",
                "MOERGE is a cloud-based software platform tailored for beauty, wellness, and aesthetic salons. The service provides an online booking page, appointment scheduling, smart slot conflict prevention, and automated follow-up care reminders dispatched via Resend email infrastructure."
              )}
            </p>
            <ul className="list-disc pl-6 space-y-2 text-stone-600 text-xs sm:text-sm">
              <li>
                <strong>{t("სალონის პროფილი:", "Salon Profile:")}</strong>{" "}
                {t(
                  "სალონის მფლობელის მიერ შექმნილი ინდივიდუალური სივრცე, საკუთარი დასახელებით, მისამართით, სამუშაო საათებით (10:00–20:00) და ფასებით ლარში (₾).",
                  "An isolated workspace configured by the salon owner displaying custom name, address, hours, and GEL pricing."
                )}
              </li>
              <li>
                <strong>{t("კლიენტი:", "Customer/Client:")}</strong>{" "}
                {t(
                  "ფიზიკური პირი, რომელიც ონლაინ ჯავშნის ფორმით ეწერება სალონის მომსახურებაზე.",
                  "An individual booking appointments online through the public booking portal."
                )}
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("2. ანგარიშის რეგისტრაცია და უსაფრთხოება", "2. Account Registration & Security")}
              </h2>
            </div>
            <p>
              {t(
                "სალონის რეგისტრაციისას მომხმარებელი ვალდებულია მიუთითოს რეალური და უტყუარი მონაცემები (სალონის სახელი, ელ-ფოსტა, საკონტაქტო პირი). მომხმარებელი პირადად არის პასუხისმგებელი ავტორიზაციის მონაცემების (პაროლი, API კლავიშები) კონფიდენციალურობაზე.",
                "When creating an account, users must provide accurate and verifiable business details. Users are strictly responsible for maintaining the confidentiality of their credentials and API tokens."
              )}
            </p>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                {t(
                  "აკრძალულია ანგარიშის გადაცემა მესამე პირებისთვის MOERGE-ის წერილობითი თანხმობის გარეშე. საეჭვო აქტივობის შემჩნევის შემთხვევაში დაუყოვნებლივ დაუკავშირდით მხარდაჭერის გუნდს.",
                  "Sharing login credentials with unauthorized third parties is prohibited. Please notify support immediately of any suspected unauthorized access."
                )}
              </span>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("3. ონლაინ ჯავშნები და საათების განრიგი", "3. Online Bookings & Schedule Integrity")}
              </h2>
            </div>
            <p>
              {t(
                "MOERGE უზრუნველყოფს საათების რეალურ დროში დაჯავშნის მექანიზმს საქართველოს დროის სარტყელში (Asia/Tbilisi, GMT+4). სისტემა ავტომატურად ბლოკავს უკვე დაკავებულ საათებს და იცავს სალონს ორმაგი ჯავშნებისგან (Double Bookings).",
                "MOERGE operates strictly within the Georgia Standard Time zone (Asia/Tbilisi, GMT+4). The smart conflict detector prevents overlapping reservations in real-time."
              )}
            </p>
            <p>
              {t(
                "სალონი თავად არის პასუხისმგებელი კლიენტის დროულ მიღებაზე, პროცედურის ხარისხსა და სალონის შიდა წესების დაცვაზე. MOERGE არ არის პასუხისმგებელი სალონსა და კლიენტს შორის მომსახურების უშუალო გაწევისას წარმოშობილ პრეტენზიებზე.",
                "The individual salon remains solely liable for the provision, timeliness, and quality of in-person salon services. MOERGE operates as an enabling technology provider."
              )}
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                4
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("4. ავტომატური შეხსენებების ძრავა (Resend)", "4. Automated Reminder Engine & Resend Integration")}
              </h2>
            </div>
            <p>
              {t(
                "პროცედურის დასრულების შემდეგ, MOERGE ავტომატურად ამზადებს პერსონალურ შეხსენებას შესაბამისი მოვლის ციკლის გათვალისწინებით (მაგ: ეპილაციის შემდგომი ან სხვა პერიოდული ვიზიტებისთვის) და უგზავნის კლიენტს მოსაწვევს შემდეგი ვიზიტის დასაგეგმად. სალონს შეუძლია გამოიყენოს საკუთარი Resend API Key ან სისტემური არხი.",
                "Following the completion of a treatment, MOERGE schedules an automated care reminder tailored to the procedure cycle and sends the client an invitation for their next visit via Resend email integration."
              )}
            </p>
            <p className="text-xs text-stone-500">
              {t(
                "ყველა გაგზავნილი წერილი აღირიცხება სისტემურ ჟურნალში (Email Logs) იდემპოტენტურობისა და ორმაგი გაგზავნის თავიდან ასაცილებლად.",
                "All dispatched emails are recorded in the transparent audit log to guarantee idempotency and avoid spamming."
              )}
            </p>
          </section>

          {/* Section 5 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                5
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("5. ტარიფები, გადახდები და გაუქმების პოლიტიკა", "5. Pricing, Billing & Cancellation")}
              </h2>
            </div>
            <p>
              {t(
                "MOERGE-ის სააბონენტო ტარიფები მითითებულია ეროვნულ ვალუტაში (₾ ლარი). ახალ დარეგისტრირებულ სალონებს ეძლევათ 14-დღიანი უფასო სატესტო პერიოდი. სატესტო პერიოდის გასვლის შემდეგ სერვისით სარგებლობა გრძელდება არჩეული სატარიფო გეგმის შესაბამისად.",
                "MOERGE subscription plans are denominated in Georgian Lari (GEL ₾). New salons enjoy a 14-day free trial. Following trial completion, continuous access requires an active plan subscription."
              )}
            </p>
            <p>
              {t(
                "სალონს უფლება აქვს ნებისმიერ დროს გააუქმოს სააბონენტო პაკეტი. გაუქმებისას უკვე დარიცხული თვის საფასურის დაბრუნება არ ხდება, თუმცა წვდომა შენარჩუნდება მიმდინარე გადახდილი პერიოდის ამოწურვამდე.",
                "Salons may cancel their subscription at any time. Prepaid periods are non-refundable, but full platform access remains active until the end of the paid cycle."
              )}
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-xs">
                6
              </div>
              <h2 className="text-lg font-bold text-stone-900">
                {t("6. მოქმედი კანონმდებლობა და დავების გადაწყვეტა", "6. Governing Law & Dispute Resolution")}
              </h2>
            </div>
            <p>
              {t(
                "წინამდებარე პირობები რეგულირდება და განიმარტება საქართველოს მოქმედი კანონმდებლობის შესაბამისად. ნებისმიერი დავა ან უთანხმოება, რომელიც შეიძლება წარმოიშვას ამ ხელშეკრულებიდან, მხარეთა მიერ გადაწყდება მოლაპარაკების გზით, ხოლო შეთანხმების მიუღწევლობის შემთხვევაში — საქართველოს სასამართლოების მიერ (ქალაქი თბილისი).",
                "These Terms shall be governed by and construed in accordance with the laws of Georgia. Any dispute arising out of or in connection with these Terms shall be resolved through good-faith negotiation, or submitted to the jurisdiction of the courts of Tbilisi, Georgia."
              )}
            </p>
          </section>
        </div>

        {/* Footer Support Card */}
        <div className="mt-12 bg-rose-50/60 rounded-3xl border border-rose-200/70 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shadow-xs shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {t("გაქვთ კითხვები მოხმარების წესებთან დაკავშირებით?", "Have questions regarding our terms?")}
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                {t(
                  "ჩვენი იურიდიული და მხარდაჭერის გუნდი მზადაა დაგეხმაროთ: legal@moerge.ge",
                  "Our legal & support team is here to assist: legal@moerge.ge"
                )}
              </p>
            </div>
          </div>
          <Link
            href="/privacy"
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shrink-0"
          >
            {t("კონფიდენციალურობის პოლიტიკა →", "Privacy Policy →")}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-rose-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-black text-stone-900">MOERGE</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} MOERGE Ecosystem. {t("ყველა უფლება დაცულია.", "All rights reserved.")}</span>
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/" className="hover:text-rose-600">
              {t("მთავარი", "Home")}
            </Link>
            <Link href="/terms" className="text-rose-600">
              {t("მოხმარების წესები", "Terms")}
            </Link>
            <Link href="/privacy" className="hover:text-rose-600">
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
