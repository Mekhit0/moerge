"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MoargeLogo from "@/components/MoargeLogo";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export default function PricingDetails() {
  const { t } = useLanguage();
  const config = BILLING_CONFIG;
  const plans = [
    {
      id: "trial",
      title: t("უფასო საცდელი", "Free trial"),
      note: t("moarge-ის გასაცნობად", "To explore moarge"),
      price: 0,
      period: t("14 დღე", "14 days"),
      href: "/register",
      action: t("საცდელი პერიოდის დაწყება", "Start free trial"),
      features: [
        t("1 ფილიალი", "1 branch"),
        t("7 სპეციალისტამდე", "Up to 7 staff"),
        t("SMS არ შედის", "SMS not included"),
      ],
    },
    {
      id: "business",
      title: "Business",
      note: t("ერთი ფილიალი", "One branch"),
      price: config.plans.business.monthlyGel,
      period: t("თვეში", "per month"),
      href: "/login?mode=signup&plan=business",
      action: t("Business-ის არჩევა", "Choose Business"),
      features: [
        t("1 ფილიალი", "1 branch"),
        t(`${config.plans.business.staffIncluded} სპეციალისტი შედის`, `${config.plans.business.staffIncluded} staff included`),
        t(`დამატებითი სპეციალისტი ₾${config.extraStaffMonthlyGel}/თვეში`, `Additional staff ₾${config.extraStaffMonthlyGel}/month`),
        t(`${config.plans.business.sms.toLocaleString("en-US")} SMS თვეში`, `${config.plans.business.sms.toLocaleString("en-US")} SMS per month`),
      ],
    },
    {
      id: "multi_branch",
      title: "Multi-branch",
      note: t("რამდენიმე ფილიალი", "Multiple branches"),
      price: config.plans.multi_branch.monthlyGel,
      period: t("თვეში", "per month"),
      href: "/login?mode=signup&plan=multi_branch",
      action: t("Multi-branch-ის არჩევა", "Choose Multi-branch"),
      features: [
        t(`${config.plans.multi_branch.branches} ფილიალი შედის`, `${config.plans.multi_branch.branches} branches included`),
        t(`მე-4 და ყოველი შემდეგი ფილიალი ₾${config.extraBranchMonthlyGel}/თვეში`, `₾${config.extraBranchMonthlyGel}/month for each branch from the 4th`),
        t(`${config.plans.multi_branch.staffIncluded} სპეციალისტამდე`, `Up to ${config.plans.multi_branch.staffIncluded} staff`),
        t(`${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS თვეში`, `${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS per month`),
      ],
    },
  ];

  const comparison = [
    { name: t("ფილიალები", "Branches"), trial: "1", business: "1", multi: "3" },
    { name: t("სპეციალისტები", "Staff"), trial: t("7-მდე", "Up to 7"), business: t("7 შედის, დამატებითი ₾9/თვეში", "7 included, extra ₾9/month"), multi: t("50-მდე", "Up to 50") },
    { name: t("SMS თვეში", "SMS per month"), trial: "0", business: "1,000", multi: "3,000" },
  ];

  return (
    <main className="min-h-screen bg-ivory text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="moarge home"><MoargeLogo size="md" variant="full" /></Link>
          <nav className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm font-semibold text-stone-700 hover:text-rose-700">{t("შესვლა", "Sign in")}</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
        <p className="text-sm font-semibold text-rose-700">moarge · {t("ფასები", "Pricing")}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          {t("აირჩიეთ თქვენთვის საჭირო პაკეტი", "Choose the plan that fits your salon")}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
          {t("დაიწყეთ უფასო საცდელი პერიოდით ან პირდაპირ აირჩიეთ ფასიანი პაკეტი.", "Start with the free trial or go straight to a paid plan.")}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="flex flex-col border border-stone-200 bg-white p-6 sm:p-7">
              <p className="text-sm text-stone-500">{plan.note}</p>
              <h2 className="mt-1 text-xl font-bold">{plan.title}</h2>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">₾{plan.price}</span>
                <span className="text-sm text-stone-500">{plan.period}</span>
              </p>
              <ul className="mt-6 flex-1 border-t border-stone-200 pt-5 text-sm leading-6 text-stone-700">
                {plan.features.map((feature) => <li key={feature} className="border-b border-stone-100 py-2.5 last:border-0">{feature}</li>)}
              </ul>
              <Link href={plan.href} className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition ${plan.id === "trial" ? "border border-stone-300 text-stone-800 hover:border-stone-500" : "bg-rose-700 text-white hover:bg-rose-800"}`}>
                {plan.action}<ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-500">
          {t("ფასები ლარშია. Multi-branch პაკეტში მეოთხე და ყოველი შემდეგი აქტიური ფილიალი დამატებით ₾40 ღირს თვეში. რეალური ბარათით გადახდა ჯერ არ არის ჩართული.", "Prices are in GEL. Each active branch after the first three on Multi-branch adds ₾40 per month. Live card payments are not enabled yet.")}
        </p>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{t("პაკეტების შედარება", "Plan comparison")}</h2>
            <p className="text-sm text-stone-500">{t("ყოველთვიური ფასი", "Monthly pricing")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-stone-300 text-stone-500"><th className="py-3 pr-4 font-medium">{t("შესაძლებლობა", "Included")}</th><th className="px-4 py-3 font-medium">{t("უფასო", "Free")}</th><th className="px-4 py-3 font-medium">Business</th><th className="px-4 py-3 font-medium">Multi-branch</th></tr></thead>
              <tbody>{comparison.map((row) => <tr key={row.name} className="border-b border-stone-100 last:border-0"><th scope="row" className="py-3 pr-4 font-medium text-stone-700">{row.name}</th><td className="px-4 py-3 text-stone-600">{row.trial}</td><td className="px-4 py-3 text-stone-600">{row.business}</td><td className="px-4 py-3 text-stone-600">{row.multi}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold">{t("დამატებითი მოხმარება", "Additional usage")}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{t(`Business პაკეტში 7 სპეციალისტი შედის. თითო დამატებითი სპეციალისტი ღირს ₾${config.extraStaffMonthlyGel} თვეში. SMS ლიმიტს ზემოთ თითო შეტყობინება ₾${config.smsOveragePriceGel.toFixed(2)} ღირს. SMS-ის ხარჯის საწყისი თვიური ლიმიტია ₾${config.defaultSmsOverageCapGel}. წინასწარი SMS პაკეტის ფასი ₾${config.smsPackPriceGel.toFixed(2)} თითო SMS-ზეა, მინიმუმ ${config.smsPackMinimum} SMS.`, `Business includes 7 staff. Each additional staff member costs ₾${config.extraStaffMonthlyGel} per month. SMS beyond the included quota costs ₾${config.smsOveragePriceGel.toFixed(2)} per message, with a default monthly spend cap of ₾${config.defaultSmsOverageCapGel}. Prepaid SMS packs cost ₾${config.smsPackPriceGel.toFixed(2)} per message, minimum ${config.smsPackMinimum} messages.`)}</p>
        </div>
        <div>
          <h2 className="text-lg font-bold">{t("გადახდის პირობები", "Payment terms")}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{t(`3, 6 და 12 თვის წინასწარ გადახდაზე მოქმედებს ${config.prepaidDiscounts[3]}%, ${config.prepaidDiscounts[6]}% და ${config.prepaidDiscounts[12]}% ფასდაკლება საბაზო პაკეტზე. ამჟამად რეალური ბარათით გადახდა ჩართული არ არის.`, `Prepaying for 3, 6, or 12 months discounts the base plan by ${config.prepaidDiscounts[3]}%, ${config.prepaidDiscounts[6]}%, or ${config.prepaidDiscounts[12]}%. Live card payments are not enabled yet.`)}</p>
        </div>
      </section>
    </main>
  );
}
