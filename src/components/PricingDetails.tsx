"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Clock3, MessageSquareText, Sparkles, Users } from "lucide-react";
import MoargeLogo from "@/components/MoargeLogo";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { BILLING_CONFIG } from "@/lib/billing-plans";

const rows = [
  { ka: "ონლაინ ჩაწერის გვერდი", en: "Online booking page", trial: true, business: true, multi: true },
  { ka: "ჯავშნების კალენდარი და განრიგები", en: "Appointment calendar and schedules", trial: true, business: true, multi: true },
  { ka: "კლიენტების ბაზა და ვიზიტების ისტორია", en: "Client list and visit history", trial: true, business: true, multi: true },
  { ka: "ელფოსტის შეხსენებები", en: "Email reminders", trial: true, business: true, multi: true },
  { ka: "SMS თვეში", en: "SMS included per month", trial: false, business: true, multi: true },
  { ka: "ფილიალები პაკეტში", en: "Branches included", trial: true, business: true, multi: true },
  { ka: "სპეციალისტები პაკეტში", en: "Staff included", trial: true, business: true, multi: true },
] as const;

export default function PricingDetails() {
  const { t } = useLanguage();
  const config = BILLING_CONFIG;
  const plans = [
    {
      id: "trial",
      title: t("უფასო საცდელი", "Free trial"),
      eyebrow: t("დაიწყეთ მარტივად", "Get started"),
      price: 0,
      period: t("14 დღე", "14 days"),
      summary: t("დაათვალიერეთ moarge და გამოცადეთ ძირითადი სამუშაო პროცესი.", "Explore moarge and try the core workflow."),
      points: [
        t("1 ფილიალი", "1 branch"),
        t("7 სპეციალისტამდე", "Up to 7 staff"),
        t("ელფოსტის შეხსენებები", "Email reminders"),
        t("SMS საცდელ პერიოდში არ იგზავნება", "SMS is not sent during the trial"),
      ],
      featured: false,
    },
    {
      id: "business",
      title: t("ბიზნეს გეგმა", "Business"),
      eyebrow: t("ერთი ფილიალისთვის", "For one location"),
      price: config.plans.business.monthlyGel,
      period: t("თვეში", "per month"),
      summary: t("ერთი სალონის ყოველდღიური ჯავშნებისა და კლიენტების მართვისთვის.", "For daily bookings and client management at one salon."),
      points: [
        t("1 ფილიალი", "1 branch"),
        t(`${config.plans.business.staffIncluded} სპეციალისტი შედის`, `${config.plans.business.staffIncluded} staff included`),
        t(`${config.plans.business.staffLimit}-მდე სპეციალისტი`, `Up to ${config.plans.business.staffLimit} staff`),
        t(`დამატებითი სპეციალისტი: ₾${config.extraStaffMonthlyGel}/თვე`, `Additional staff: ₾${config.extraStaffMonthlyGel}/month`),
        t(`${config.plans.business.sms.toLocaleString("en-US")} SMS თვეში`, `${config.plans.business.sms.toLocaleString("en-US")} SMS per month`),
      ],
      featured: true,
    },
    {
      id: "multi",
      title: t("მრავალფილიალიანი", "Multi-branch"),
      eyebrow: t("რამდენიმე ლოკაციისთვის", "For growing teams"),
      price: config.plans.multi_branch.monthlyGel,
      period: t("თვეში", "per month"),
      summary: t("გააერთიანეთ რამდენიმე ფილიალი ერთ სამუშაო სივრცეში.", "Manage multiple locations in one workspace."),
      points: [
        t(`${config.plans.multi_branch.branches} ფილიალი შედის`, `${config.plans.multi_branch.branches} branches included`),
        t(`მე-4 ფილიალიდან: ₾${config.extraBranchMonthlyGel}/ფილიალი თვეში`, `From branch 4: ₾${config.extraBranchMonthlyGel}/branch per month`),
        t(`${config.plans.multi_branch.staffIncluded} სპეციალისტამდე`, `Up to ${config.plans.multi_branch.staffIncluded} staff`),
        t(`${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS თვეში`, `${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS per month`),
      ],
      featured: false,
    },
  ];

  return (
    <main className="min-h-screen bg-[#fdf8f6] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <MoargeLogo size="md" variant="icon" />
            <span className="text-xl font-black tracking-tight">moarge</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="hidden items-center gap-1 text-sm font-semibold text-stone-600 hover:text-rose-700 sm:inline-flex">
              <ArrowLeft className="h-4 w-4" />{t("მთავარი", "Home")}
            </Link>
            <LanguageSwitcher />
            <Link href="/login" className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800">
              {t("შესვლა", "Sign in")}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-rose-100 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-rose-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
              <Sparkles className="h-3.5 w-3.5" />{t("მარტივი და გასაგები ფასები", "Clear, straightforward pricing")}
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-950 sm:text-6xl">
              {t("აირჩიეთ გეგმა თქვენი სალონისთვის", "Find the right plan for your salon")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              {t("დაიწყეთ 14-დღიანი საცდელი პერიოდით. ერთი ფილიალისთვის აირჩიეთ Business, ხოლო რამდენიმე ლოკაციისთვის Multi-branch.", "Start with a 14-day trial. Choose Business for one location or Multi-branch for several.")}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${plan.featured ? "border-stone-900 bg-gradient-to-b from-stone-900 to-stone-950 text-white shadow-2xl shadow-rose-950/15" : "border-stone-200 bg-white shadow-sm"}`}>
              {plan.featured && <span className="absolute -top-3 left-6 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">{t("ერთი ფილიალის არჩევანი", "Popular for one location")}</span>}
              <p className={`text-xs font-bold uppercase tracking-widest ${plan.featured ? "text-rose-300" : "text-rose-700"}`}>{plan.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-extrabold">{plan.title}</h2>
              <p className={`mt-2 min-h-12 text-sm leading-6 ${plan.featured ? "text-stone-300" : "text-stone-600"}`}>{plan.summary}</p>
              <div className="mt-7 flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tight">₾{plan.price}</span>
                <span className={`text-sm ${plan.featured ? "text-stone-400" : "text-stone-500"}`}>/ {plan.period}</span>
              </div>
              <ul className={`mt-7 flex-1 space-y-3 border-t pt-6 text-sm ${plan.featured ? "border-stone-700 text-stone-200" : "border-stone-100 text-stone-700"}`}>
                {plan.points.map((point) => <li key={point} className="flex items-start gap-2.5"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-rose-300" : "text-rose-600"}`} /><span>{point}</span></li>)}
              </ul>
              <Link href="/register" className={`mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${plan.featured ? "bg-rose-600 text-white shadow-lg shadow-rose-900/30 hover:bg-rose-500" : "border border-stone-200 bg-white text-stone-900 hover:border-rose-300 hover:bg-rose-50"}`}>
                {plan.id === "trial" ? t("უფასო საცდელი პერიოდის დაწყება", "Start free trial") : t("გეგმის არჩევა", "Choose this plan")}<ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-rose-100 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-700">{t("შედარება", "Compare plans")}</p>
              <h2 className="mt-2 text-2xl font-extrabold">{t("რა შედის თითოეულ გეგმაში", "What each plan includes")}</h2>
            </div>
            <p className="text-sm text-stone-500">{t("ფასები მითითებულია ლარში, თვეში.", "Prices are in GEL per month.")}</p>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><th className="py-3 pr-4 font-semibold">{t("შესაძლებლობა", "Feature")}</th><th className="px-4 py-3 font-semibold">{t("საცდელი", "Trial")}</th><th className="px-4 py-3 font-semibold">Business</th><th className="px-4 py-3 font-semibold">Multi-branch</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.en} className="border-b border-stone-100 last:border-0"><th className="py-4 pr-4 font-medium text-stone-700">{t(row.ka, row.en)}</th><td className="px-4 py-4">{row.trial ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-stone-400">{t("არ შედის", "Not included")}</span>}</td><td className="px-4 py-4">{row.business ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-stone-400">{t("არ შედის", "Not included")}</span>}</td><td className="px-4 py-4">{row.multi ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-stone-400">{t("არ შედის", "Not included")}</span>}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
            <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-rose-600" />Business: 1 {t("ფილიალი", "branch")}; Multi-branch: {config.plans.multi_branch.branches} {t("ფილიალი", "branches")}.</p>
            <p className="flex items-center gap-2"><Users className="h-4 w-4 text-rose-600" />{t("დამატებითი სპეციალისტი Business გეგმაში", "Additional staff on Business")}: ₾{config.extraStaffMonthlyGel}/{t("თვე", "month")}.</p>
            <p className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-rose-600" />{t("SMS ლიმიტს ზემოთ", "SMS over quota")}: ₾{config.smsOveragePriceGel.toFixed(2)} {t("თითო შეტყობინება", "per message")}.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-rose-100 bg-rose-50/70 p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-700 shadow-sm"><Building2 className="h-5 w-5" /></div>
            <h2 className="mt-5 text-xl font-extrabold">{t("დამატებითი ფილიალები", "Additional branches")}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{t(`Multi-branch გეგმაში შედის ${config.plans.multi_branch.branches} ფილიალი. მე-${config.plans.multi_branch.branches + 1} და ყოველი შემდეგი აქტიური ფილიალი ღირს ₾${config.extraBranchMonthlyGel} თვეში. თანხა აისახება ყოველთვიურ გამოყენების ინვოისში.`, `The Multi-branch plan includes ${config.plans.multi_branch.branches} locations. The ${config.plans.multi_branch.branches + 1}th and each additional active branch costs ₾${config.extraBranchMonthlyGel} per month, billed in the monthly usage invoice.`)}</p>
            <p className="mt-4 rounded-xl bg-white/80 p-3 text-sm font-bold text-stone-800">{t("მაგალითი: 4 ფილიალი ჯამში ₾190 თვეში.", "Example: 4 branches cost ₾190 per month in total.")}</p>
          </article>
          <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><MessageSquareText className="h-5 w-5" /></div>
            <h2 className="mt-5 text-xl font-extrabold">{t("SMS და დამატებითი მოხმარება", "SMS and usage")}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
              <li>{t(`Business: ${config.plans.business.sms.toLocaleString("en-US")} SMS თვეში.`, `Business: ${config.plans.business.sms.toLocaleString("en-US")} SMS per month.`)}</li>
              <li>{t(`Multi-branch: ${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS თვეში.`, `Multi-branch: ${config.plans.multi_branch.sms.toLocaleString("en-US")} SMS per month.`)}</li>
              <li>{t(`ლიმიტს ზემოთ SMS: ₾${config.smsOveragePriceGel.toFixed(2)} თითო SMS-ზე; თვიური ხარჯის საწყისი ლიმიტი ₾${config.defaultSmsOverageCapGel}.`, `SMS over quota: ₾${config.smsOveragePriceGel.toFixed(2)} each; default monthly spend cap is ₾${config.defaultSmsOverageCapGel}.`)}</li>
              <li>{t(`წინასწარი SMS პაკეტი: ₾${config.smsPackPriceGel.toFixed(2)} თითო SMS-ზე, მინიმუმ ${config.smsPackMinimum}.`, `Prepaid SMS: ₾${config.smsPackPriceGel.toFixed(2)} each, minimum ${config.smsPackMinimum}.`)}</li>
            </ul>
          </article>
        </div>

        <div className="mt-6 rounded-3xl bg-stone-900 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-rose-300"><Clock3 className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-widest">{t("საცდელი პერიოდი", "Free trial")}</span></div>
            <h2 className="mt-3 text-2xl font-extrabold">{t("14 დღე moarge-ის გასაცნობად", "14 days to try moarge")}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-300">{t("საცდელი პერიოდი მოიცავს 1 ფილიალს, 7 სპეციალისტამდე და ელფოსტის შეხსენებებს. საცდელ პერიოდში SMS არ იგზავნება.", "The trial includes 1 branch, up to 7 staff, and email reminders. SMS is not sent during the trial.")}</p>
          </div>
          <Link href="/register" className="mt-5 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-500 sm:mt-0">
            {t("დაიწყეთ უფასოდ", "Start for free")}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-6 text-stone-500">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          {t(`3, 6 და 12 თვის წინასწარ გადახდაზე მოქმედებს ${config.prepaidDiscounts[3]}%, ${config.prepaidDiscounts[6]}% და ${config.prepaidDiscounts[12]}% ფასდაკლება საბაზო პაკეტზე. დამატებითი ფილიალები, სპეციალისტები და SMS მოხმარება ცალკე ირიცხება. რეალური ბარათით გადახდა ჯერ არ არის ჩართული.`, `Prepaying 3, 6, or 12 months discounts the base plan by ${config.prepaidDiscounts[3]}%, ${config.prepaidDiscounts[6]}%, or ${config.prepaidDiscounts[12]}%. Additional branches, staff, and SMS usage are billed separately. Live card payments are not enabled yet.`)}
        </p>
      </section>
    </main>
  );
}
