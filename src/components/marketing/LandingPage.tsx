"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, BellRing, CalendarDays, Check, Globe, Minus, Plus, RefreshCcw, Users, UsersRound, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { DEMO_BOOKING_HREF, MarketingFooter, MarketingHeader, SIGNUP_HREF } from "./MarketingChrome";
import ProductTour from "@/components/tour/ProductTour";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { CHEAPEST_MONTHLY_GEL, EARLY_BIRD, PACKAGES, SMS_PACK, SMS_PACK_PRICE_GEL, formatGel, type Offer } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/contact";

export default function MoargeLandingPage({ offer }: { offer: Offer }) {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { trialDays } = offer;
  const staffLimit = BILLING_CONFIG.trialStaffLimit;
  const [solo, business] = PACKAGES;
  const fromPrice = t(`${CHEAPEST_MONTHLY_GEL} ₾-დან თვეში`, `from ${CHEAPEST_MONTHLY_GEL} ₾ a month`);

  // Each row: how it goes today, and how it goes with moarge.
  const comparison = [
    [t("კლიენტები მთელი დღე რეკავენ ჩასაწერად", "Clients call all day to book"), t("კლიენტი ბმულით თავად ეწერება, ღამითაც", "Clients book from your link, even at night")],
    [t("ერთ დროზე ორი კლიენტი იწერება", "Two clients end up in the same slot"), t("კალენდარი დაკავებულ დროს არავის მისცემს", "The calendar never gives out a taken slot")],
    [t("კლიენტს ავიწყდება და არ მოდის", "Clients forget and don't come"), t("კლიენტი ვიზიტამდე შეხსენებას იღებს", "Clients get a reminder before the visit")],
    [t("ვინ როდის იყო, რვეულში უნდა ეძებო", "Finding who came when means flipping pages"), t("ყოველი კლიენტის ისტორია ერთ გვერდზეა", "Every client's history is on one page")],
    [t("თვის ბოლოს საკომისიოს ხელით ითვლით", "Commission gets counted by hand"), t("შემოსავალი და საკომისიო თავად ითვლება", "Earnings and commission add up on their own")],
  ];

  // Only what is built and working today.
  const features = [
    { href: "/onlain-javshani", icon: Globe, title: t("ონლაინ ჩაწერა", "Online booking"), text: t("კლიენტი ირჩევს სერვისს, სპეციალისტს და დროს. აპლიკაცია და რეგისტრაცია არ სჭირდება.", "Clients pick a service, a specialist and a time. No app, no account.") },
    { href: "/salonis-kalendari", icon: CalendarDays, title: t("კალენდარი", "Calendar"), text: t("ყველა სპეციალისტი ერთ ეკრანზე. ვიზიტს მარტივად გადაიტანთ, შესვენებას დაბლოკავთ.", "Every specialist on one screen. Move visits easily, block out breaks.") },
    { href: "/shekhsenebebi", icon: BellRing, title: t("შეხსენებები", "Reminders"), text: offer.smsLive
      ? t("ვიზიტამდე ერთი დღით და ორი საათით ადრე. SMS შეხსენებები ფასიან პაკეტებში.", "A day and two hours before the visit. SMS reminders on paid plans.")
      : t("ვიზიტამდე ერთი დღით და ორი საათით ადრე. SMS შეხსენებები ფასიან პაკეტებში, 1 დეკემბრიდან.", "A day and two hours before the visit. SMS reminders on paid plans, from 1 December.") },
    { icon: RefreshCcw, title: t("გადატანა დარეკვის გარეშე", "Changes without a call"), text: t("ჯავშნის კოდით კლიენტი თავად გადაიტანს ან გააუქმებს ვიზიტს.", "With the booking code, clients move or cancel on their own.") },
    { href: "/klientebis-baza", icon: Users, title: t("კლიენტების ბაზა", "Client base"), text: t("ისტორია, ალერგიები, ფერის ფორმულები. სიები: დაბრუნების დროა, VIP, დიდი ხანია არ მოსულა.", "History, allergies, colour formulas. Lists of who is due back, VIPs and who hasn't come in a while.") },
    { icon: Wallet, title: t("ვიზიტი და გადახდა", "Visits and payments"), text: t("ნაღდი, ბარათი, ფასდაკლება და თიფი. დღის კასა თავად იკრიბება.", "Cash, card, discount and tip. The day's takings add up by themselves.") },
    { icon: UsersRound, title: t("გუნდი", "Team"), text: t("სპეციალისტი ბმულით შემოდის და მხოლოდ თავის ვიზიტებს ხედავს.", "Specialists join by link and see only their own visits.") },
    { href: "/shemosavali-da-sakomisio", icon: BarChart3, title: t("შემოსავალი და საკომისიო", "Earnings and commission"), text: t("ვინ რამდენი გამოიმუშავა და რამდენი ეკუთვნის. Excel-ში ერთი ღილაკით.", "Who earned what and what they are owed. To Excel in one click.") },
  ];

  const steps = [
    { title: t("დარეგისტრირდით", "Sign up"), text: t("სალონის სახელი, ელ-ფოსტა და პაროლი. სულ ეს არის.", "A salon name, an email and a password. That's it.") },
    { title: t("დაამატეთ სერვისები და გუნდი", "Add services and your team"), text: t("ფასები, ხანგრძლივობა, სამუშაო საათები. სპეციალისტებს ბმულს გაუგზავნით.", "Prices, lengths and hours. Send your specialists a link.") },
    { title: t("გააზიარეთ ბმული", "Share your link"), text: t("Instagram-ზე, Facebook-ზე ან დაბეჭდილი QR კოდით სალონში.", "On Instagram, Facebook, or as a printed QR code at the desk.") },
  ];

  const faqs = [
    {
      q: t("რა არის moarge?", "What is moarge?"),
      a: t(
        "moarge (მოარგე) სალონის მართვის პროგრამაა საქართველოს სილამაზის სალონებისთვის, ბარბერშოპებისთვის და კოსმეტოლოგებისთვის. ერთ ადგილას აერთიანებს ონლაინ ჯავშანს, კალენდარს, კლიენტების ბაზას (CRM) და შემოსავლის დათვლას.",
        "moarge (მოარგე) is salon management software for beauty salons, barbershops and cosmetologists in Georgia. It brings online booking, the calendar, the client base (CRM) and earnings into one place."
      ),
    },
    {
      q: t("რა ღირს?", "How much does it cost?"),
      a: t(
        `${solo.name.ka} ${solo.monthlyGel} ₾ და ${business.name.ka} ${business.monthlyGel} ₾ თვეში, ბიზნესში ${business.staffIncluded} სპეციალისტი შედის. 6 თვით გადახდისას 10% ფასდაკლებაა, 12 თვით 20%. ${offer.pilot ? "ნოემბერში moarge სრულიად უფასოა." : `პირველი ${trialDays} დღე უფასოა.`}`,
        `${solo.name.en} is ${solo.monthlyGel} ₾ and ${business.name.en} ${business.monthlyGel} ₾ a month, with ${business.staffIncluded} specialists included in Business. Pay for 6 months and get 10% off, 12 months and get 20% off. ${offer.pilot ? "In November moarge is completely free." : `The first ${trialDays} days are free.`}`
      ),
    },
    {
      q: t("რა ხდება უფასო პერიოდის შემდეგ?", "What happens after the free period?"),
      a: t(
        `${offer.pilot ? `ნოემბერში დარეგისტრირებული სალონები ${trialDays} დღე უფასოდ იყენებენ. ` : ""}შემდეგ აირჩევთ პაკეტს და გადაიხდით ბარათით. თუ არ აირჩევთ, ანგარიში მხოლოდ სანახავი ხდება, მონაცემები კი რჩება და არაფერი იშლება.`,
        `${offer.pilot ? `Salons that sign up in November use it free for ${trialDays} days. ` : ""}Then you pick a package and pay by card. If you don't, the account turns view only, and your data stays and nothing is deleted.`
      ),
    },
    {
      q: t("კლიენტები რვეულში ან Excel-ში მყავს. როგორ გადმოვიტანო?", "My clients are in a notebook or Excel. How do I move them?"),
      a: t(
        `დაამატეთ სათითაოდ, ან Excel შეინახეთ CSV ფაილად და ატვირთეთ კლიენტების გვერდზე. თუ გაგიჭირდათ, მოგვწერეთ ${SUPPORT_EMAIL} და დაგეხმარებით.`,
        `Add them one by one, or save your Excel as a CSV file and upload it on the Clients page. Stuck? Write to ${SUPPORT_EMAIL} and we'll help.`
      ),
    },
    {
      q: t("კლიენტს აპლიკაცია სჭირდება?", "Do clients need an app?"),
      a: t("არა. ბმული ტელეფონის ბრაუზერში იხსნება. კლიენტი წერს სახელს და ნომერს და ირჩევს დროს.", "No. The link opens in the phone's browser. The client types a name and number and picks a time."),
    },
    {
      q: t("სპეციალისტები ერთმანეთის კლიენტებს ხედავენ?", "Can specialists see each other's clients?"),
      a: t(
        "არა. სპეციალისტი ხედავს მხოლოდ თავის ვიზიტებს და თავის შემოსავალს. მფლობელი და ადმინისტრატორი მთელ სალონს ხედავენ.",
        "No. Specialists see only their own visits and earnings. The owner and admins see the whole salon."
      ),
    },
    {
      q: t("შეხსენება SMS-ით მოდის?", "Do reminders come by SMS?"),
      a: t(
        `SMS შეხსენებები ორივე პაკეტშია: სოლოში თვეში ${formatGel(solo.smsIncluded)} SMS, ბიზნესში ${formatGel(business.smsIncluded)}. დამატებით ${formatGel(SMS_PACK.minimum)} SMS ${formatGel(SMS_PACK_PRICE_GEL)} ₾ ღირს, ნებისმიერ პაკეტზე.${offer.smsLive ? "" : " SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე."}`,
        `SMS reminders come with both packages: ${formatGel(solo.smsIncluded)} SMS a month on Solo, ${formatGel(business.smsIncluded)} on Business. Extra ${formatGel(SMS_PACK.minimum)} SMS cost ${formatGel(SMS_PACK_PRICE_GEL)} ₾ on any package.${offer.smsLive ? "" : " SMS reminders start on 1 December, on paid plans."}`
      ),
    },
    {
      q: t("რამდენი სპეციალისტის დამატება შეიძლება?", "How many specialists can I add?"),
      a: t(
        `სოლოში ერთი, ბიზნესში ${business.staffIncluded} შედის და ყოველი დამატებითი ${business.extraStaffGel} ₾ თვეში. უფასო პერიოდში ${staffLimit}-მდე. თითოეულს საკუთარი განრიგი და სერვისები აქვს.`,
        `One on Solo. Business includes ${business.staffIncluded}, and each extra one is ${business.extraStaffGel} ₾ a month. Up to ${staffLimit} during the free period. Each has their own schedule and services.`
      ),
    },
    {
      q: t("ჩემი მონაცემები დაცულია?", "Is my data safe?"),
      a: t(
        "თითოეული სალონის მონაცემები ცალკე ინახება და მათ მხოლოდ თქვენი გუნდი ხედავს. კლიენტს შეხსენება მხოლოდ თანხმობით ეგზავნება.",
        "Each salon's data is stored separately and only your team can see it. Clients get reminders only if they agreed."
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-ivory text-stone-900 flex flex-col selection:bg-rose-200 selection:text-rose-950">
      <MarketingHeader onHome />

      <main>
        {/* Hero */}
        <section className="border-b border-stone-200/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-16 sm:pb-20 grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-sm font-semibold text-rose-700">
                {t("სილამაზის სალონებს, ბარბერშოპებს და კოსმეტოლოგებს", "For beauty salons, barbershops and cosmetologists")}
              </p>
              <h1 className="mt-4 text-[2.5rem] sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.08] text-stone-900">
                {t("სალონის მართვის პროგრამა ", "Salon management software ")}
                <span className="block text-rose-600">{t("რვეულის გარეშე", "without the notebook")}</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-stone-600 leading-relaxed max-w-lg">
                {t(
                  "კლიენტები ბმულით თავად ეწერებიან და შეხსენებას იღებენ. თქვენ მთელ დღეს ერთ ეკრანზე ხედავთ: ვინ მოდის, ვისთან და რამდენი შემოვიდა.",
                  "Clients book from your link and get a reminder. You see the whole day on one screen: who is coming, to whom, and what came in."
                )}
              </p>
              <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <Link href={SIGNUP_HREF} className="inline-flex min-h-13 items-center justify-center gap-2 px-7 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold transition">
                  {t("დაიწყეთ უფასოდ", "Start for free")}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href={DEMO_BOOKING_HREF} className="inline-flex min-h-11 items-center justify-center gap-1.5 text-base font-semibold text-stone-800 underline decoration-rose-300 decoration-2 underline-offset-4 hover:decoration-rose-600 transition">
                  {t("ნახეთ ჯავშნის გვერდი", "See a booking page")}
                </Link>
              </div>
              <p className="mt-5 text-sm text-stone-500">
                {offer.pilot
                  ? t("ნოემბერში უფასოდ, ბარათის გარეშე. დეკემბრიდან ", "Free in November, no card. From December ")
                  : t(`${trialDays} დღე უფასოდ, ბარათის გარეშე. შემდეგ `, `${trialDays} days free, no card. Then `)}
                <Link href="/pricing" className="font-semibold text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-rose-700">{fromPrice}</Link>
              </p>
            </div>

            <ProductTour />
          </div>
        </section>

        {/* Notebook vs moarge */}
        <section className="py-14 sm:py-20 bg-white border-b border-stone-200/70">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900 max-w-xl">
              {t("რვეული ავსებს დღეს. moarge ათავისუფლებს.", "The notebook fills your day. moarge frees it up.")}
            </h2>
            <div className="mt-8 sm:mt-10 border-t border-stone-200">
              <div className="hidden sm:grid grid-cols-2 gap-8 py-3 text-xs font-bold uppercase tracking-wide text-stone-400">
                <span>{t("ახლა", "Today")}</span>
                <span className="text-rose-700">{t("moarge-ით", "With moarge")}</span>
              </div>
              {comparison.map(([before, after]) => (
                <div key={before} className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-8 border-t border-stone-100 py-4 first:border-t-0 sm:first:border-t">
                  <p className="text-sm sm:text-base text-stone-500 line-through decoration-stone-300">{before}</p>
                  <p className="flex items-start gap-2 text-base font-semibold text-stone-900">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    {after}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-14 sm:py-20 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">{t("რა შედის", "What's inside")}</h2>
              <p className="mt-3 text-base text-stone-600 leading-relaxed max-w-sm">
                {t("ყველაფერი, რაც სალონს ყოველდღე სჭირდება. ყველაფერი უკვე მუშაობს.", "What a salon needs every day. All of it works today.")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="border-t border-stone-200 py-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-stone-900">
                      <Icon className="h-4 w-4 text-rose-600" />
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm sm:text-[0.95rem] leading-relaxed text-stone-600">{feature.text}</p>
                    {feature.href && (
                      <Link href={feature.href} className="mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-rose-700 hover:text-rose-900">
                        {t("ვრცლად", "More")}<ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-14 sm:py-20 bg-white border-y border-stone-200/70 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">{t("როგორ დავიწყოთ", "How to start")}</h2>
            <ol className="mt-8 sm:mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="text-4xl font-black text-rose-600 tabular-nums">{index + 1}</span>
                  <h3 className="mt-2 text-lg font-bold text-stone-900">{step.title}</h3>
                  <p className="mt-1.5 text-base text-stone-600 leading-relaxed">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pilot offer */}
        <section id="pilot" className="py-14 sm:py-20 scroll-mt-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 md:items-start">
            <div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
                {offer.pilot ? t("ნოემბერი უფასოა", "November is free") : t(`${trialDays} დღე უფასოდ`, `${trialDays} days free`)}
              </h2>
              <p className="mt-4 text-base sm:text-lg text-stone-600 leading-relaxed">
                {offer.pilot
                  ? t(
                    `moarge ახალია და ნოემბერს სალონებთან ერთად ვცდით. დარეგისტრირდით ახლა, გამოიყენეთ ${trialDays} დღე უფასოდ და გვითხარით, რა აკლია. თქვენი რჩევით ვწყვეტთ, რას გავაკეთებთ შემდეგ.`,
                    `moarge is new and we're testing it with salons through November. Sign up now, use it free for ${trialDays} days and tell us what's missing. Your advice decides what we build next.`
                  )
                  : t(
                    "სცადეთ moarge თქვენს სალონში, თქვენი კლიენტებით. ბარათი არ გჭირდებათ. თუ მოგეწონებათ, აირჩევთ პაკეტს.",
                    "Try moarge in your salon, with your own clients. No card needed. If you like it, pick a package."
                  )}
              </p>
              <p className="mt-4 text-sm text-stone-500">
                {t("აზრი მოგვწერეთ პანელიდან, ღილაკით „უკუკავშირი“, ან აქ: ", "Send feedback from the dashboard with the Feedback button, or to ")}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-block font-semibold text-rose-700 hover:underline">{SUPPORT_EMAIL}</a>
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-7">
              <dl className="divide-y divide-stone-100">
                {[
                  offer.pilot ? [t("ნოემბერი", "November"), t("უფასოდ", "Free")] : [t("საცდელი", "Trial"), t(`${trialDays} დღე უფასოდ`, `${trialDays} days free`)],
                  [offer.pilot ? t("დეკემბრიდან", "From December") : t("შემდეგ", "Then"), fromPrice],
                  [t("ბარათი", "Card"), t("არ გჭირდებათ", "Not needed")],
                  offer.earlyBird
                    ? [t("დეკემბერში", "In December"), t(`პირველ ${EARLY_BIRD.salons} სალონს −${EARLY_BIRD.discountPercent}%`, `−${EARLY_BIRD.discountPercent}% for the first ${EARLY_BIRD.salons} salons`)]
                    : [t("გუნდი", "Team"), t(`${staffLimit}-მდე სპეციალისტი`, `Up to ${staffLimit} specialists`)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-3 first:pt-0">
                    <dt className="text-sm text-stone-500">{label}</dt>
                    <dd className="text-right text-base font-semibold text-stone-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href={SIGNUP_HREF} className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-base font-bold text-white transition hover:bg-rose-700">
                {t("სალონის რეგისტრაცია", "Register your salon")}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/pricing" className="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-rose-700">
                {t("ყველა პაკეტი და ფასი", "All packages and prices")}
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-14 sm:py-20 bg-white border-t border-stone-200/70 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">{t("კითხვები", "Questions")}</h2>
              <p className="mt-3 text-base text-stone-600">
                {t("ვერ იპოვეთ პასუხი? ", "Didn't find your answer? ")}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-rose-700 hover:underline">{t("მოგვწერეთ", "Write to us")}</a>
              </p>
            </div>
            <div className="border-b border-stone-200">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                const Icon = isOpen ? Minus : Plus;
                return (
                  <div key={faq.q} className="border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="w-full min-h-14 py-4 text-left flex items-center justify-between gap-4 font-bold text-base text-stone-900 hover:text-rose-700 transition"
                    >
                      <span>{faq.q}</span>
                      <Icon className="w-5 h-5 text-rose-600 shrink-0" />
                    </button>
                    <p hidden={!isOpen} className="pb-5 pr-8 text-base text-stone-600 leading-relaxed">{faq.a}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col gap-5 rounded-2xl bg-rose-600 px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("სცადეთ ამ კვირაში", "Try it this week")}</h2>
                <p className="mt-1.5 text-base text-rose-100">
                  {offer.pilot
                    ? t("რეგისტრაციას რამდენიმე წუთი სჭირდება. ნოემბერში უფასოა.", "Signing up takes a few minutes. It's free in November.")
                    : t(`რეგისტრაციას რამდენიმე წუთი სჭირდება. ${trialDays} დღე უფასოა.`, `Signing up takes a few minutes. ${trialDays} days are free.`)}
                </p>
              </div>
              <Link href={SIGNUP_HREF} className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-rose-700 transition hover:bg-rose-50">
                {t("დაიწყეთ უფასოდ", "Start for free")}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter onHome />
    </div>
  );
}
