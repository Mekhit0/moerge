"use client";

import React from "react";
import Link from "next/link";
import { COMPANY_LEGAL_NAME_EN, COMPANY_LEGAL_NAME_KA, COMPANY_SHORT_NAME, SUPPORT_EMAIL } from "@/lib/contact";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { REFUND, currentOffer } from "@/lib/pricing";
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
import MoargeLogo from "@/components/MoargeLogo";

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-ivory text-stone-900 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <MoargeLogo size="md" variant="icon" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-stone-900 leading-none">
                  MOARGE
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
                moarge • {t("სამართლებრივი პირობები", "Legal Terms")}
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
              "წინამდებარე ხელშეკრულება წარმოადგენს იურიდიულად სავალდებულო შეთანხმებას moarge-ის პლატფორმის მომხმარებელსა (სალონის მფლობელი, ადმინისტრატორი, პერსონალი ან კლიენტი) და moarge-ის ადმინისტრაციას შორის. სისტემით სარგებლობით თქვენ ადასტურებთ, რომ სრულად ეთანხმებით ქვემოთ მოცემულ წესებს.",
              "These Terms of Service constitute a legally binding agreement between the user of the moarge platform (salon owner, staff, or customer) and moarge. By accessing or using the platform, you acknowledge and agree to comply with all terms set forth herein."
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
                "moarge არის ღრუბლოვანი პროგრამული უზრუნველყოფა სილამაზისა და ესთეტიკური სალონებისთვის. პლატფორმა მოიცავს ონლაინ ჯავშნებს, სპეციალისტების განრიგებს, კლიენტების ისტორიას და თანხმობაზე დაფუძნებულ შეტყობინებებს.",
                "moarge is cloud software for beauty and aesthetic salons. It provides online booking, staff schedules, client history, and consent-based notifications."
              )}
            </p>
            <p>
              {t(
                `MOARGE-ს მართავს და ამ წესებით მომსახურებას უწევს ${COMPANY_LEGAL_NAME_KA}, საქართველოში რეგისტრირებული ინდივიდუალური მეწარმე. კონტაქტი: ${SUPPORT_EMAIL}.`,
                `MOARGE is operated and provided under these terms by ${COMPANY_LEGAL_NAME_EN}, an individual entrepreneur registered in Georgia. Contact: ${SUPPORT_EMAIL}.`
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
                  "აკრძალულია ანგარიშის გადაცემა მესამე პირებისთვის moarge-ის წერილობითი თანხმობის გარეშე. საეჭვო აქტივობის შემჩნევის შემთხვევაში დაუყოვნებლივ დაუკავშირდით მხარდაჭერის გუნდს.",
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
                "ხელმისაწვდომი დროები ითვალისწინებს სალონის დროის სარტყელს, სპეციალისტის სამუშაო საათებს, სერვისის ხანგრძლივობას, შესვენებებს, დასვენების დროს და არსებულ ჯავშნებს. ნაგულისხმევი დროის სარტყელია Asia/Tbilisi.",
                "Available slots account for the salon timezone, staff hours, service duration, breaks, time off, and existing appointments. The default timezone is Asia/Tbilisi."
              )}
            </p>
            <p>
              {t(
                "სალონი თავად არის პასუხისმგებელი კლიენტის დროულ მიღებაზე, პროცედურის ხარისხსა და სალონის შიდა წესების დაცვაზე. moarge არ არის პასუხისმგებელი სალონსა და კლიენტს შორის მომსახურების უშუალო გაწევისას წარმოშობილ პრეტენზიებზე.",
                "The individual salon remains solely liable for the provision, timeliness, and quality of in-person salon services. moarge operates as an enabling technology provider."
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
                {t("4. შეტყობინებები და შეხსენებები", "4. Notifications & Reminders")}
              </h2>
            </div>
            <p>
              {t(
                "შეტყობინებები იგზავნება ვიზიტამდე 24 და 2 საათით ადრე, ასევე სერვისის განმეორების დროს, მხოლოდ კლიენტის თანხმობით. სატესტო პერიოდში SMS არ იგზავნება, მხოლოდ ელფოსტა.",
                "Reminders are sent 24 and 2 hours before a visit and when a service is due again, only with the client's consent. During the test period only email is sent, not SMS."
              )}
            </p>
            <p className="text-xs text-stone-500">
              {t(
                "შეტყობინების სტატუსი და მიწოდების მცდელობები notification log-ში ინახება. პარამეტრების, თანამშრომლებისა და ვიზიტების ცვლილებებზე ინახება მოქმედების, ავტორისა და შეცვლილი ველების ისტორია.",
                "Notification status and delivery attempts are stored in the notification log. Changes to settings, staff, and appointments record the action, actor, and changed field names."
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
                {t("5. სატესტო პერიოდი და გადახდა", "5. Test period and payment")}
              </h2>
            </div>
            <p>
              {t(
                `ახალ სალონებს ეძლევათ ${currentOffer().trialDays}-დღიანი უფასო სატესტო პერიოდი ბარათის გარეშე, ${BILLING_CONFIG.trialStaffLimit}-მდე სპეციალისტით. პერიოდის დასრულებისას ანგარიში სანახავ რეჟიმზე გადადის. მონაცემები ინახება და ავტომატურად არ იშლება.`,
                `New salons get a free ${currentOffer().trialDays}-day test period without a card, with up to ${BILLING_CONFIG.trialStaffLimit} specialists. When it ends, the account becomes view-only. Data is kept and is not deleted automatically.`
              )}
            </p>
            <p>
              {t(
                "სატესტო პერიოდში გადახდა არ ხდება. ფასიანი გეგმები და გადახდის პირობები გამოქვეყნდება მათ ჩართვამდე, ხოლო სალონებს წინასწარ ვაცნობებთ.",
                "No payment is taken during the test period. Paid plans and payment terms will be published before they start, and salons will be told in advance."
              )}
            </p>
            <p>
              {t(
                `თუ პირველი გადახდიდან ${REFUND.withinDays} დღის განმავლობაში მოგვწერთ, რომ moarge არ გჭირდებათ, გადახდილი თანხის ${REFUND.percent}%-ს დაგიბრუნებთ იმავე ბარათზე. მიზეზის ახსნა საჭირო არ არის. ეს მოქმედებს მხოლოდ პირველ გადახდაზე.`,
                `If you write to us within ${REFUND.withinDays} days of your first payment that moarge is not for you, we refund ${REFUND.percent}% of that payment to the same card. No reason is needed. This applies to the first payment only.`
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
                "წინამდებარე პირობები რეგულირდება და განიმარტება საქართველოს მოქმედი კანონმდებლობის შესაბამისად. ნებისმიერი დავა ან უთანხმოება, რომელიც შეიძლება წარმოიშვას ამ ხელშეკრულებიდან, მხარეთა მიერ გადაწყდება მოლაპარაკების გზით, ხოლო შეთანხმების მიუღწევლობის შემთხვევაში საქართველოს სასამართლოების მიერ (ქალაქი თბილისი).",
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
                  `კითხვების შემთხვევაში მოგვწერეთ: ${SUPPORT_EMAIL}`,
                  `If you have questions, write to us: ${SUPPORT_EMAIL}`
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
            <span className="font-black text-stone-900">MOARGE</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} {COMPANY_SHORT_NAME}. Managed by {COMPANY_SHORT_NAME}.</span>
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
