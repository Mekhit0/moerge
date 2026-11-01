"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Mail,
  Gift,
  Globe,
  Phone,
  MessageCircle,
  NotebookPen,
  QrCode,
  RefreshCcw,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import ProductTour from "@/components/tour/ProductTour";
import Reveal from "@/components/tour/Reveal";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { COMPANY_SHORT_NAME, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/contact";

const SIGNUP_HREF = "/login?mode=signup";
const DEMO_BOOKING_HREF = "/book";

export default function MoargeLandingPage() {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const trialDays = BILLING_CONFIG.trialDays;
  const staffLimit = BILLING_CONFIG.trialStaffLimit;

  // Grouped by who it helps. Only what is built and working today.
  const featureGroups = [
    {
      title: t("კლიენტებისთვის", "For your clients"),
      items: [
        { icon: Globe, title: t("ონლაინ ჩაწერა 24/7", "Online booking, day and night"), text: t("კლიენტი ბმულიდან ირჩევს სერვისს, სპეციალისტს და თავისუფალ დროს. აპლიკაცია და რეგისტრაცია არ სჭირდება.", "From your link the client picks a service, a specialist and a free time. No app, no account.") },
        { icon: BellRing, title: t("შეხსენება ელ-ფოსტით", "Email reminders"), text: t("დადასტურება ჩაწერისთანავე, შეხსენება ერთი დღით და ორი საათით ადრე. SMS მალე დაემატება.", "A confirmation right away, reminders a day and two hours before. SMS is coming soon.") },
        { icon: RefreshCcw, title: t("გადატანა დარეკვის გარეშე", "Changes without a call"), text: t("ჯავშნის კოდით კლიენტი თავად გადაიტანს ან გააუქმებს ვიზიტს.", "With the booking code, clients move or cancel the visit themselves.") },
      ],
    },
    {
      title: t("რეცეფციისთვის", "For the front desk"),
      items: [
        { icon: CalendarDays, title: t("კალენდარი პლანშეტზე", "A calendar made for the tablet"), text: t("ყველა სპეციალისტი ერთ ეკრანზე. გადატანა, შესვენების დაბლოკვა და ორმაგი ჯავშნისგან დაცვა.", "Every specialist on one screen. Moving visits, blocking breaks, and no double bookings.") },
        { icon: Wallet, title: t("ვიზიტი და გადახდა", "Visits and payments"), text: t("მოვიდა, დასრულდა, გადახდა: ნაღდი, ბარათი, ფასდაკლება და თიფი. დღის შემოსავალი თავად ითვლება.", "Arrived, done, paid: cash, card, discount and tip. The day's income adds up by itself.") },
        { icon: Users, title: t("კლიენტების ბაზა", "A client base that remembers"), text: t("ისტორია, ალერგიები, ფერის ფორმულები და ავტომატური სიები: დაბრუნების დროა, VIP, საფრთხეშია.", "History, allergies, colour formulas and automatic lists: due back, VIP, at risk.") },
      ],
    },
    {
      title: t("მფლობელისთვის", "For the owner"),
      items: [
        { icon: UsersRound, title: t("გუნდი და როლები", "Team and roles"), text: t("სპეციალისტები ბმულით შედიან და ხედავენ მხოლოდ თავის ვიზიტებს. თქვენ ხედავთ ყველაფერს.", "Specialists join by link and see only their own visits. You see everything.") },
        { icon: BarChart3, title: t("შემოსავალი და საკომისიო", "Earnings and commission"), text: t("გადახდილი, საშუალო ჩეკი, დატვირთვა, თითოეულის საკომისიო და გასაცემი. Excel-ში ერთი ღილაკით.", "Paid, average check, how busy, each specialist's commission and payout. To Excel in one click.") },
        { icon: ShieldCheck, title: t("უსაფრთხო და ცალკე", "Safe and separate"), text: t("თითოეული სალონის მონაცემები ცალკეა. კლიენტს შეტყობინება მხოლოდ მისი თანხმობით ეგზავნება.", "Each salon's data is kept apart. Clients get messages only if they agreed.") },
      ],
    },
  ];

  const steps = [
    {
      icon: UserPlus,
      title: t("დარეგისტრირდით", "Sign up"),
      text: t("საკმარისია სალონის სახელი, ელფოსტა და პაროლი.", "All you need is a salon name, an email and a password."),
    },
    {
      icon: Scissors,
      title: t("დაამატეთ სერვისები და გუნდი", "Add services and your team"),
      text: t("მიუთითეთ ფასები, ხანგრძლივობა და სამუშაო საათები, შემდეგ მოიწვიეთ სპეციალისტები ბმულით.", "Enter prices, lengths and working hours, then invite your specialists with a link."),
    },
    {
      icon: QrCode,
      title: t("გაუზიარეთ ბმული კლიენტებს", "Share your link"),
      text: t("ჩასვით Instagram-ზე ან Facebook-ზე, ან დაბეჭდეთ QR კოდი სალონისთვის.", "Put it on Instagram or Facebook, or print the QR code for your salon."),
    },
  ];

  const faqs = [
    {
      q: t("რა ღირს?", "How much does it cost?"),
      a: t(
        `სატესტო თვე სრულიად უფასოა: ${trialDays} დღე, ბარათის მითითების გარეშე.`,
        `The test month is completely free: ${trialDays} days, no card needed.`
      ),
    },
    {
      q: t(`რა მოხდება ${trialDays} დღის შემდეგ?`, `What happens after ${trialDays} days?`),
      a: t(
        "ანგარიში სანახავ რეჟიმზე გადავა. ახალ ჯავშნებს ვერ დაამატებთ, მაგრამ ყველა მონაცემი შენახული დარჩება და ავტომატურად არაფერი წაიშლება.",
        "The account becomes view-only. You can't add new bookings, but all your data is kept and nothing is deleted automatically."
      ),
    },
    {
      q: t("კლიენტები რვეულში ან Excel-ში მყავს. როგორ გადმოვიტანო?", "My clients are in a notebook or Excel. How do I move them?"),
      a: t(
        `კლიენტების დამატება შეგიძლიათ სათითაოდ, ან Excel-ის ფაილი შეინახეთ CSV ფორმატში და ატვირთეთ კლიენტების გვერდზე. თუ გაგიჭირდებათ, მოგვწერეთ ${SUPPORT_EMAIL} და დაგეხმარებით.`,
        `You can add clients one by one, or save your Excel file as CSV and upload it on the Clients page. If it's hard, write to ${SUPPORT_EMAIL} and we'll help.`
      ),
    },
    {
      q: t("კლიენტს აპლიკაციის ჩამოტვირთვა ან რეგისტრაცია სჭირდება?", "Do clients need an app or an account?"),
      a: t(
        "არა. ჯავშნის ბმული ტელეფონის ბრაუზერში იხსნება. კლიენტი უთითებს სახელს და ტელეფონს და ირჩევს დროს.",
        "No. The booking link opens in the phone's browser. The client enters a name and phone number and picks a time."
      ),
    },
    {
      q: t("სპეციალისტები ერთმანეთის კლიენტებს ხედავენ?", "Can specialists see each other's clients?"),
      a: t(
        "არა. სპეციალისტი ხედავს მხოლოდ თავის ვიზიტებს, იმ კლიენტების ტელეფონს და თავის შემოსავალს. მფლობელი და ადმინისტრატორი ხედავენ მთელ სალონს.",
        "No. A specialist sees only their own visits, those clients' phone numbers and their own earnings. The owner and admins see the whole salon."
      ),
    },
    {
      q: t("შეხსენებები SMS-ით მოდის?", "Do reminders come by SMS?"),
      a: t(
        "ახლა შეხსენებები ელ-ფოსტით იგზავნება, თუ კლიენტმა ელ-ფოსტა მიუთითა და დათანხმდა. SMS შეხსენებებზე ვმუშაობთ და მალე დაემატება.",
        "Right now reminders go by email when the client gave an email and agreed. We are working on SMS reminders and they are coming soon."
      ),
    },
    {
      q: t("რამდენი სპეციალისტის დამატება შემიძლია?", "How many specialists can I add?"),
      a: t(
        `სატესტო თვეში ${staffLimit}-მდე სპეციალისტს. თითოეულს აქვს საკუთარი განრიგი და სერვისები.`,
        `Up to ${staffLimit} during the test month. Each one has their own schedule and services.`
      ),
    },
    {
      q: t("უსაფრთხოა ჩემი მონაცემები?", "Is my data safe?"),
      a: t(
        "თითოეული სალონის მონაცემები ცალკეა და მათ მხოლოდ თქვენი სალონის წევრები ხედავენ. კლიენტს შეხსენება მხოლოდ მისი თანხმობით ეგზავნება.",
        "Each salon's data is kept separate and only your salon's members can see it. Clients get reminders only if they agreed to them."
      ),
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "moarge",
    operatingSystem: "Web",
    applicationCategory: "BusinessApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GEL" },
    description: "სალონის ონლაინ ჯავშნები, კალენდარი, კლიენტების ბაზა და ავტომატური შეხსენებები საქართველოში.",
  };

  return (
    <div className="min-h-screen bg-ivory text-stone-900 flex flex-col selection:bg-rose-200 selection:text-rose-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="moarge">
            <MoargeLogo size="md" variant="icon" />
            <span className="text-xl sm:text-2xl font-black tracking-[0.06em] text-stone-900">MOARGE</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-stone-600" aria-label={t("გვერდის ნავიგაცია", "Page navigation")}>
            <a href="#features" className="hover:text-rose-600 transition">{t("შესაძლებლობები", "Features")}</a>
            <a href="#how" className="hover:text-rose-600 transition">{t("როგორ მუშაობს", "How it works")}</a>
            <a href="#pilot" className="hover:text-rose-600 transition">{t("სატესტო თვე", "Test month")}</a>
            <a href="#faq" className="hover:text-rose-600 transition">{t("კითხვები", "FAQ")}</a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <Link href="/login" className="hidden sm:inline-flex min-h-10 items-center px-4 rounded-xl text-sm font-semibold text-stone-700 hover:bg-rose-50 transition">
              {t("შესვლა", "Sign in")}
            </Link>
            <Link href={SIGNUP_HREF} className="inline-flex min-h-10 items-center gap-1.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition">
              {t("დაწყება", "Start")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-rose-100">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-rose-200/35 blur-[120px] rounded-full pointer-events-none -z-10" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100/90 border border-rose-200 text-rose-950 text-sm font-semibold">
                <Gift className="w-4 h-4 text-rose-600" />
                {t(`სატესტო თვე: ${trialDays} დღე უფასოდ`, `Test month: ${trialDays} days free`)}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-stone-900">
                {t("სალონის ჯავშნები ", "Salon bookings ")}
                <span className="bg-gradient-to-r from-rose-600 via-rose-700 to-rose-900 bg-clip-text text-transparent">
                  {t("რვეულის გარეშე", "without the notebook")}
                </span>
              </h1>
              <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">
                {t(
                  "ონლაინ ჩაწერა, კალენდარი, კლიენტების ბაზა, გადახდები და შემოსავალი ერთ ადგილას. კლიენტები თავად ეწერებიან, შეხსენება თავად იგზავნება, თქვენ კი ყველაფერს ერთ ეკრანზე ხედავთ.",
                  "Online booking, a calendar, your client base, payments and earnings in one place. Clients book themselves, reminders go out on their own, and you see everything on one screen."
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={SIGNUP_HREF} className="inline-flex min-h-14 items-center justify-center gap-2 px-7 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold shadow-xl shadow-rose-600/25 transition">
                  {t("დაიწყეთ უფასოდ", "Start for free")}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href={DEMO_BOOKING_HREF} className="inline-flex min-h-14 items-center justify-center gap-2 px-7 rounded-2xl bg-white hover:bg-rose-50/70 text-stone-900 text-base font-semibold border border-stone-200 transition">
                  <Smartphone className="w-5 h-5 text-rose-600" />
                  {t("ნახეთ ჯავშნის გვერდი", "See a booking page")}
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
                {[
                  t("ბარათი არ არის საჭირო", "No card needed"),
                  t(`${staffLimit}-მდე სპეციალისტი`, `Up to ${staffLimit} specialists`),
                  t("მუშაობს ტელეფონზე", "Works on your phone"),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <ProductTour />
          </div>
        </section>

        {/* Notebook vs moarge */}
        <section className="py-14 sm:py-20 bg-white border-b border-rose-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-center text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              {t("რვეული თუ moarge?", "Notebook or moarge?")}
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="p-6 sm:p-8 rounded-3xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-2 text-stone-700 font-bold">
                  <NotebookPen className="w-5 h-5 text-stone-500" />
                  {t("რვეული და ტელეფონი", "Notebook and phone")}
                </div>
                <ul className="mt-5 space-y-3 text-sm sm:text-base text-stone-600">
                  {[
                    t("კლიენტები დღის განმავლობაში რეკავენ ჩასაწერად", "Clients call all day to book"),
                    t("ერთ დროზე ორი კლიენტი იწერება", "Two clients get booked at the same time"),
                    t("კლიენტს ავიწყდება ვიზიტი და არ მოდის", "Clients forget and don't show up"),
                    t("ძნელია იპოვო, ვინ როდის იყო და რა გაიკეთა", "Hard to find who came when and for what"),
                    t("თვის ბოლოს შემოსავალს და საკომისიოს ხელით ითვლით", "Month-end income and commission counted by hand"),
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <X className="w-4 h-4 mt-1 text-red-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-rose-50/80 to-emerald-50/40 border border-rose-200">
                <div className="flex items-center gap-2 text-stone-900 font-bold">
                  <MoargeLogo size="sm" variant="icon" />
                  MOARGE
                </div>
                <ul className="mt-5 space-y-3 text-sm sm:text-base text-stone-700">
                  {[
                    t("კლიენტები ბმულით თავად ეწერებიან", "Clients book themselves from a link"),
                    t("სისტემა გადაფარვას არ დაუშვებს", "The system blocks overlapping bookings"),
                    t("კლიენტი ვიზიტამდე შეხსენებას იღებს", "Clients get a reminder before the visit"),
                    t("ყველა კლიენტის ისტორია ერთ ადგილას", "Every client's history in one place"),
                    t("შემოსავალი და გასაცემი თავად ითვლება", "Income and payouts add up by themselves"),
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 mt-1 text-emerald-600 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-14 sm:py-20 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-center text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              {t("რას აკეთებს moarge", "What moarge does")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-base text-stone-600">
              {t("ერთი პროგრამა მთელი სალონისთვის: კლიენტიდან მფლობელამდე.", "One program for the whole salon, from the client to the owner.")}
            </p>
            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
              {featureGroups.map((group, groupIndex) => (
                <Reveal key={group.title} delay={groupIndex * 120} className="space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-700">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs text-white">{groupIndex + 1}</span>
                    {group.title}
                  </h3>
                  {group.items.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <article key={feature.title} className="group rounded-3xl border border-rose-100 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-950/5">
                        <div className="flex items-start gap-4">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <h4 className="text-base font-bold text-stone-900">{feature.title}</h4>
                            <p className="mt-1 text-sm leading-relaxed text-stone-600">{feature.text}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-14 sm:py-20 bg-white border-y border-rose-100 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-center text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              {t("დაწყება 3 ნაბიჯში", "Get started in 3 steps")}
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Reveal as="li" key={step.title} delay={index * 120} className="relative bg-ivory rounded-3xl border border-rose-100 p-6 sm:p-8">
                    <span className="absolute top-4 right-6 text-5xl font-black text-rose-100 pointer-events-none">{index + 1}</span>
                    <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-white text-rose-600 border border-rose-100">
                      <Icon className="w-6 h-6" />
                    </span>
                    <h3 className="mt-5 text-lg font-bold text-stone-900">{step.title}</h3>
                    <p className="mt-2 text-sm sm:text-base text-stone-600 leading-relaxed">{step.text}</p>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Pilot offer */}
        <section id="pilot" className="py-14 sm:py-20 scroll-mt-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border-2 border-rose-200 bg-white p-6 sm:p-10 shadow-xl shadow-rose-950/5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                {t("სატესტო თვე", "Test month")}
              </span>
              <h2 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
                {t("გამოსცადეთ moarge თქვენს სალონში", "Try moarge in your salon")}
              </h2>
              <p className="mt-3 text-base sm:text-lg text-stone-600 leading-relaxed">
                {t(
                  "ვეძებთ სალონებს, რომლებიც moarge-ს ერთი თვე უფასოდ გამოიყენებენ და გაგვიზიარებენ აზრს. თქვენი რჩევებით ვაუმჯობესებთ პროგრამას.",
                  "We're looking for salons to use moarge free for one month and tell us what they think. Your advice shapes what we build next."
                )}
              </p>
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 text-base text-stone-800">
                {[
                  t(`${trialDays} დღე სრულიად უფასოდ`, `${trialDays} days completely free`),
                  t("ბარათის მითითება არ გჭირდებათ", "No card needed"),
                  t(`${staffLimit}-მდე სპეციალისტი`, `Up to ${staffLimit} specialists`),
                  t("ყველა ფუნქცია ერთბაშად", "Every feature included"),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex items-start gap-2.5 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                <MessageCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>
                  {t(
                    "აზრის გაზიარება შეგიძლიათ პირდაპირ პანელიდან, ღილაკით „უკუკავშირი“, ან მოგვწერეთ: ",
                    "You can share feedback right from the dashboard with the Feedback button, or write to: "
                  )}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-rose-700 hover:underline break-all">{SUPPORT_EMAIL}</a>
                </span>
              </p>
              <Link href={SIGNUP_HREF} className="mt-8 inline-flex w-full sm:w-auto min-h-14 items-center justify-center gap-2 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold shadow-lg shadow-rose-600/25 transition">
                {t("სალონის რეგისტრაცია", "Register your salon")}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-14 sm:py-20 bg-white border-t border-rose-100 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-center text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              {t("ხშირად დასმული კითხვები", "Common questions")}
            </h2>
            <div className="mt-10 space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.q} className="rounded-2xl border border-rose-100 bg-ivory overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="w-full min-h-14 p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-base text-stone-900 hover:text-rose-700 transition"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-rose-600 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <p className="px-4 pb-5 sm:px-5 text-sm sm:text-base text-stone-600 leading-relaxed">{faq.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="py-14 sm:py-16 bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {t("მზად ხართ დაემშვიდობოთ რვეულს?", "Ready to put the notebook away?")}
            </h2>
            <p className="text-rose-100/80 text-base sm:text-lg">
              {t(`რეგისტრაციას რამდენიმე წუთი სჭირდება. ${trialDays} დღე უფასოა.`, `Signing up takes a few minutes. ${trialDays} days are free.`)}
            </p>
            <Link href={SIGNUP_HREF} className="inline-flex w-full sm:w-auto min-h-14 items-center justify-center gap-2 px-8 rounded-2xl bg-white hover:bg-rose-50 text-rose-950 text-base font-bold shadow-xl transition">
              {t("დაიწყეთ უფასოდ", "Start for free")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ivory border-t border-rose-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm space-y-4">
              <MoargeLogo size="md" variant="full" />
              <p className="text-base text-stone-600 leading-relaxed">
                {t(
                  "ონლაინ ჯავშნები, კალენდარი და კლიენტების ბაზა საქართველოს სალონებისთვის.",
                  "Online booking, a calendar and a client list for salons in Georgia."
                )}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <a href={`tel:${SUPPORT_PHONE_TEL}`} className="group inline-flex min-h-12 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 text-sm font-semibold text-stone-800 shadow-xs transition hover:border-rose-300 hover:shadow-sm">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white"><Phone className="h-4 w-4" /></span>
                  {SUPPORT_PHONE_DISPLAY}
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="group inline-flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 text-sm font-semibold text-stone-800 shadow-xs transition hover:border-rose-300 hover:shadow-sm">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white"><Mail className="h-4 w-4" /></span>
                  <span className="truncate">{SUPPORT_EMAIL}</span>
                </a>
              </div>
            </div>

            <nav aria-label={t("ფუტერის ბმულები", "Footer links")} className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-14">
              {[
                {
                  title: t("სალონებისთვის", "For salons"),
                  links: [
                    { href: SIGNUP_HREF, label: t("რეგისტრაცია", "Sign up") },
                    { href: "/login", label: t("შესვლა", "Sign in") },
                    { href: "#pilot", label: t("სატესტო თვე", "Test month") },
                    { href: "#faq", label: t("კითხვები", "FAQ") },
                  ],
                },
                {
                  title: t("კლიენტებისთვის", "For clients"),
                  links: [
                    { href: "/manage-booking", label: t("ჩემი ჯავშანი", "My booking") },
                    { href: DEMO_BOOKING_HREF, label: t("ჯავშნის მაგალითი", "Booking example") },
                  ],
                },
                {
                  title: t("დოკუმენტები", "Legal"),
                  links: [
                    { href: "/terms", label: t("წესები და პირობები", "Terms") },
                    { href: "/privacy", label: t("კონფიდენციალურობა", "Privacy") },
                  ],
                },
              ].map((column) => (
                <div key={column.title}>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{column.title}</p>
                  <ul className="mt-4 space-y-3 text-sm">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="text-stone-700 transition hover:text-rose-600">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-12 flex flex-col gap-2 border-t border-rose-100 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {COMPANY_SHORT_NAME}. {t("ყველა უფლება დაცულია.", "All rights reserved.")}</p>
            <p>Managed by {COMPANY_SHORT_NAME}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
