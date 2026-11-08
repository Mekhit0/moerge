"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { cn } from "@/components/ui";
import { MarketingFooter, MarketingHeader, SIGNUP_HREF } from "./MarketingChrome";
import {
  BILLING_PERIODS, EARLY_BIRD, PACKAGES, SMS_PACK, SMS_PACK_PRICE_GEL,
  formatGel, packagePrice, type BillingMonths, type Offer, type PricePackage,
} from "@/lib/pricing";
import { pricingFaq } from "@/lib/pricing-faq";

type Line = { text: string; included: boolean; soon?: boolean };

export default function PricingView({ offer }: { offer: Offer }) {
  const { lang, t } = useLanguage();
  const [months, setMonths] = useState<BillingMonths>(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const faqs = pricingFaq(offer);

  function lines(pkg: PricePackage): Line[] {
    const smsSoon = !offer.smsLive;
    const common: Line[] = [
      { text: t("ონლაინ ჯავშნის ბმული და QR კოდი", "Booking link and QR code"), included: true },
      { text: t("კალენდარი, შესვენებები, დასვენება", "Calendar, breaks, time off"), included: true },
      { text: t("კლიენტების ბაზა და ისტორია", "Client base and history"), included: true },
      { text: t("ვიზიტები და გადახდები", "Visits and payments"), included: true },
    ];
    if (pkg.code === "solo") return [
      { text: t("1 სპეციალისტი", "1 specialist"), included: true },
      ...common,
      { text: t("თქვენი შემოსავალი", "Your own earnings"), included: true },
      { text: t(`${formatGel(pkg.smsIncluded)} SMS შეხსენება თვეში`, `${formatGel(pkg.smsIncluded)} SMS reminders a month`), included: true, soon: smsSoon },
      { text: t("გუნდი, როლები, საკომისიო", "Team, roles, commission"), included: false },
    ];
    if (pkg.code === "business") return [
      { text: t(`${pkg.staffIncluded} სპეციალისტი შედის, დამატებითი ${pkg.extraStaffGel} ₾`, `${pkg.staffIncluded} specialists included, extra ${pkg.extraStaffGel} ₾ each`), included: true },
      ...common,
      { text: t(`${formatGel(pkg.smsIncluded)} SMS შეხსენება თვეში`, `${formatGel(pkg.smsIncluded)} SMS reminders a month`), included: true, soon: smsSoon },
      { text: t("გუნდი და როლები", "Team and roles"), included: true },
      { text: t("საკომისიო და გასაცემი", "Commission and payouts"), included: true },
      { text: t("ანგარიშები და Excel", "Reports and Excel"), included: true },
    ];
    return [
      { text: t(`${pkg.branches} ფილიალი, დამატებითი ${pkg.extraBranchGel} ₾`, `${pkg.branches} locations, extra ${pkg.extraBranchGel} ₾ each`), included: true },
      { text: t(`${pkg.staffLimit}-მდე სპეციალისტი`, `Up to ${pkg.staffLimit} specialists`), included: true },
      { text: t(`${formatGel(pkg.smsIncluded)} SMS შეხსენება თვეში`, `${formatGel(pkg.smsIncluded)} SMS reminders a month`), included: true, soon: smsSoon },
      { text: t("ყველაფერი ბიზნესიდან", "Everything in Business"), included: true },
      { text: t("კლიენტების გადმოტანას ჩვენ ვაკეთებთ", "We move your clients in for you"), included: true },
    ];
  }

  const periodLabel = (value: BillingMonths) =>
    value === 1 ? t("თვიური", "Monthly") : value === 6 ? t("6 თვე", "6 months") : t("12 თვე", "12 months");

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-stone-900">
      <MarketingHeader />

      <main className="flex-1">
        <section className="border-b border-stone-200/70">
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
            <h1 className="max-w-3xl text-[2.25rem] font-black leading-[1.1] tracking-tight sm:text-5xl">
              {t("აირჩიეთ პაკეტი სალონის ზომის მიხედვით", "Pick the package that fits your salon")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg">
              {offer.pilot
                ? t("ნოემბერში moarge სრულიად უფასოა. ფასები მოქმედებს 1 დეკემბრიდან.", "moarge is completely free in November. Prices apply from 1 December.")
                : t(`პირველი ${offer.trialDays} დღე უფასოა, ბარათის გარეშე. შემდეგ აირჩიეთ პაკეტი.`, `The first ${offer.trialDays} days are free, no card needed. Then pick a package.`)}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div role="radiogroup" aria-label={t("გადახდის პერიოდი", "Billing period")} className="inline-flex self-start rounded-xl border border-stone-200 bg-white p-1">
                {BILLING_PERIODS.map((period) => (
                  <button key={period.months} type="button" role="radio" aria-checked={months === period.months} onClick={() => setMonths(period.months)}
                    className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition sm:px-4",
                      months === period.months ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50")}>
                    {periodLabel(period.months)}
                    {period.discountPercent > 0 && (
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", months === period.months ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700")}>
                        −{period.discountPercent}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {offer.earlyBird && (
                <p className="text-sm text-stone-600">
                  <span className="font-bold text-rose-700">−{EARLY_BIRD.discountPercent}%</span>{" "}
                  {t(`დეკემბრის პირველ ${EARLY_BIRD.salons} სალონს პირველ გადახდაზე`, `for the first ${EARLY_BIRD.salons} salons in December, on the first payment`)}
                </p>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-3 lg:gap-4">
              {PACKAGES.map((pkg) => {
                const price = packagePrice(pkg, months);
                const featured = pkg.code === "business";
                return (
                  <article key={pkg.code} className={cn("relative flex flex-col rounded-2xl border bg-white p-6", featured ? "border-rose-600 ring-1 ring-rose-600" : "border-stone-200")}>
                    {(featured || !pkg.available) && (
                      <span className={cn("absolute -top-3 left-6 rounded-md px-2 py-0.5 text-xs font-bold", featured ? "bg-rose-600 text-white" : "bg-stone-200 text-stone-700")}>
                        {featured ? t("რეკომენდებული", "Recommended") : t("მალე", "Soon")}
                      </span>
                    )}
                    <h2 className="text-xl font-extrabold">{pkg.name[lang]}</h2>
                    <p className="mt-0.5 text-sm text-stone-500">{pkg.forWho[lang]}</p>

                    <p className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-4xl font-black tabular-nums tracking-tight">{formatGel(price.perMonth)} ₾</span>
                      <span className="text-sm text-stone-500">{t("თვეში", "a month")}</span>
                    </p>
                    <p className="mt-1 min-h-5 text-sm text-stone-500">
                      {months > 1 && t(`ერთად ${formatGel(price.total)} ₾ ${months} თვეზე`, `${formatGel(price.total)} ₾ for ${months} months`)}
                    </p>
                    <p className="mt-3 text-[0.95rem] font-semibold leading-snug text-stone-800">{pkg.worth[lang]}</p>

                    {pkg.available ? (
                      <Link href={SIGNUP_HREF} className={cn("mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition",
                        featured ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-stone-300 text-stone-900 hover:bg-stone-50")}>
                        {t("დაიწყეთ უფასოდ", "Start for free")}<ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("moarge: მრავალი ფილიალი")}`}
                        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-5 text-base font-bold text-stone-900 transition hover:bg-stone-50">
                        {t("შემატყობინეთ", "Let me know")}
                      </a>
                    )}

                    <ul className="mt-6 space-y-2.5 border-t border-stone-100 pt-5 text-sm">
                      {lines(pkg).map((line) => (
                        <li key={line.text} className={cn("flex items-start gap-2", line.included ? "text-stone-800" : "text-stone-400")}>
                          {line.included ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0" />}
                          <span>
                            {line.text}
                            {line.soon && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">{t("1 დეკემბრიდან", "from 1 December")}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* SMS packs */}
        <section className="border-b border-stone-200/70 bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 md:items-center md:gap-14">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("დამატებითი SMS", "Extra SMS")}</h2>
              <p className="mt-3 text-base leading-relaxed text-stone-600">
                {t(
                  "SMS შეხსენებას კლიენტი ნამდვილად კითხულობს. თუ პაკეტში შემავალი SMS არ გყოფნით, ან სოლოზე ხართ, დაამატეთ იმდენი, რამდენიც გჭირდებათ.",
                  "Clients actually read an SMS reminder. If your package's SMS aren't enough, or you're on Solo, add as many as you need."
                )}
              </p>
              {!offer.smsLive && <p className="mt-3 text-sm text-stone-500">{t("SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე.", "SMS reminders start on 1 December, on paid plans.")}</p>}
            </div>
            <div className="rounded-2xl border border-stone-200 bg-ivory p-6">
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums">{formatGel(SMS_PACK_PRICE_GEL)} ₾</span>
                <span className="text-base text-stone-600">{t(`${formatGel(SMS_PACK.minimum)} SMS-ისთვის`, `for ${formatGel(SMS_PACK.minimum)} SMS`)}</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-stone-700">
                {[
                  t("ნაყიდი SMS არ იწვება და გადადის შემდეგ თვეში", "Bought SMS never expire and carry over"),
                  t("პაკეტში შემავალი SMS ყოველთვე ახლდება", "Your package's SMS renew every month"),
                  t("ჯერ პაკეტის SMS იხარჯება, შემდეგ ნაყიდი", "Package SMS are used first, then bought ones"),
                  t(`ყიდულობთ ${formatGel(SMS_PACK.minimum)}-ით, ნებისმიერ პაკეტზე`, `Sold in ${formatGel(SMS_PACK.minimum)}s, on any package`),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("კითხვები ფასზე", "Questions about price")}</h2>
              <p className="mt-3 text-base text-stone-600">
                {t("სხვა კითხვა გაქვთ? ", "Another question? ")}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-rose-700 hover:underline">{t("მოგვწერეთ", "Write to us")}</a>
              </p>
            </div>
            <div className="border-b border-stone-200">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.q.en} className="border-t border-stone-200">
                    <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen}
                      className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left text-base font-bold text-stone-900 transition hover:text-rose-700">
                      <span>{faq.q[lang]}</span>
                      {isOpen ? <Minus className="h-5 w-5 shrink-0 text-rose-600" /> : <Plus className="h-5 w-5 shrink-0 text-rose-600" />}
                    </button>
                    <p hidden={!isOpen} className="pb-5 pr-8 text-base leading-relaxed text-stone-600">{faq.a[lang]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-5 rounded-2xl bg-rose-600 px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {offer.pilot ? t("ნოემბერი უფასოა", "November is free") : t(`${offer.trialDays} დღე უფასოდ`, `${offer.trialDays} days free`)}
                </h2>
                <p className="mt-1.5 text-base text-rose-100">{t("რეგისტრაციას რამდენიმე წუთი სჭირდება. ბარათი არ გჭირდებათ.", "Signing up takes a few minutes. No card needed.")}</p>
              </div>
              <Link href={SIGNUP_HREF} className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-rose-700 transition hover:bg-rose-50">
                {t("დაიწყეთ უფასოდ", "Start for free")}<ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
