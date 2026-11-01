"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, GraduationCap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ButtonLink, Button, Card, cn } from "@/components/ui";
import { DeviceFrame, SCENES, type Text } from "@/components/tour/Scenes";
import { useOnScreen, usePrefersReducedMotion, useStepTimer } from "@/components/tour/useSceneLoop";

type Audience = "office" | "master";

interface Lesson {
  id: string;
  scene: keyof typeof SCENES;
  title: Text;
  intro: Text;
  steps: Text[];
  link?: { href: string; label: Text };
  /** Extra links, e.g. for the setup checklist. */
  links?: Array<{ href: string; label: Text }>;
}

const OFFICE: Lesson[] = [
  {
    id: "start", scene: "today",
    title: { ka: "დაწყება 5 ნაბიჯში", en: "Get started in 5 steps" },
    intro: { ka: "ერთხელ მოამზადეთ სალონი და შემდეგ ყველაფერი თავად მუშაობს.", en: "Set up your salon once and the rest runs by itself." },
    steps: [
      { ka: "შეავსეთ სალონის სახელი, ტელეფონი და მისამართი.", en: "Fill in the salon name, phone and address." },
      { ka: "დაამატეთ სერვისები: ფასი და ხანგრძლივობა.", en: "Add services with price and length." },
      { ka: "დაამატეთ სპეციალისტები და მათი სამუშაო საათები.", en: "Add specialists and their working hours." },
      { ka: "მოიწვიეთ გუნდი ბმულით, რომ თავად შევიდნენ.", en: "Invite your team with a link so they can sign in." },
      { ka: "გააზიარეთ ჯავშნის ბმული ან QR კოდი Instagram-ზე და სალონში.", en: "Share your booking link or QR code on Instagram and in the salon." },
    ],
    links: [
      { href: "/settings", label: { ka: "სალონის პარამეტრები", en: "Salon settings" } },
      { href: "/settings/services", label: { ka: "სერვისები", en: "Services" } },
      { href: "/settings/staff", label: { ka: "სპეციალისტები და გუნდი", en: "Specialists and team" } },
      { href: "/settings/schedules", label: { ka: "სამუშაო საათები", en: "Working hours" } },
      { href: "/dashboard", label: { ka: "ჯავშნის ბმული და QR", en: "Booking link and QR" } },
    ],
  },
  {
    id: "book", scene: "calendar",
    title: { ka: "ვიზიტის ჩაწერა", en: "Booking a visit" },
    intro: { ka: "კლიენტმა დარეკა? ჩაწერას რამდენიმე წამი სჭირდება.", en: "A client called? Booking takes a few seconds." },
    steps: [
      { ka: "გახსენით კალენდარი. თითოეულ სპეციალისტს თავისი სვეტი აქვს.", en: "Open the Calendar. Each specialist has a column." },
      { ka: "შეეხეთ ცარიელ დროს სასურველი სპეციალისტის სვეტში.", en: "Tap an empty time in the right specialist's column." },
      { ka: "მოძებნეთ კლიენტი სახელით ან ნომრით, ან დაამატეთ ახალი.", en: "Find the client by name or number, or add a new one." },
      { ka: "აირჩიეთ სერვისი. თავისუფალი დრო თავად გამოჩნდება.", en: "Pick the service. Free times appear on their own." },
      { ka: "შეინახეთ. დაკავებულ დროზე ჩაწერა შეუძლებელია.", en: "Save. Taken times cannot be double booked." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "visit", scene: "visit",
    title: { ka: "ვიზიტის დღე და გადახდა", en: "The visit day and payment" },
    intro: { ka: "მოვიდა, დასრულდა, გადახდა: სამი შეხება და დღე დახურულია.", en: "Arrived, done, paid: three taps and the day is in order." },
    steps: [
      { ka: "„დღეს“ გვერდზე შეეხეთ ვიზიტს.", en: "On Today, tap the visit." },
      { ka: "კლიენტი მოვიდა? დააჭირეთ „მოვიდა“.", en: "Client is here? Tap Arrived." },
      { ka: "დასრულებისას შეიყვანეთ გადახდა: ფასი, ფასდაკლება, თიფი, ნაღდი ან ბარათი.", en: "When done, enter the payment: price, discount, tip, cash or card." },
      { ka: "„არ მოვიდა“ და „გაუქმება“ მენიუშია. შეცდომა? დააბრუნეთ ერთი შეხებით.", en: "No-show and Cancel are in the menu. A mistake? Undo with one tap." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "move", scene: "calendar",
    title: { ka: "გადატანა და დროის დაბლოკვა", en: "Moving visits and blocking time" },
    intro: { ka: "გეგმები იცვლება. კალენდარი ამას მარტივად ართმევს თავს.", en: "Plans change. The calendar handles it easily." },
    steps: [
      { ka: "შეეხეთ ვიზიტს და აირჩიეთ „სხვა დროზე გადატანა“.", en: "Tap the visit and choose Move to another time." },
      { ka: "შეეხეთ ახალ დროს, სხვა სპეციალისტთანაც.", en: "Tap the new time, even with another specialist." },
      { ka: "კომპიუტერზე ვიზიტი თაგვითაც გადაიტანება.", en: "On a computer you can also drag it with the mouse." },
      { ka: "შესვენებისთვის შეეხეთ ცარიელ დროს და აირჩიეთ „დაბლოკვა“.", en: "For a break, tap an empty time and choose Block time." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "online", scene: "booking",
    title: { ka: "ონლაინ ჩაწერა და შეხსენებები", en: "Online booking and reminders" },
    intro: { ka: "კლიენტები თავად ეწერებიან დღე და ღამე, შეხსენებები თავად იგზავნება.", en: "Clients book themselves day and night; reminders go out on their own." },
    steps: [
      { ka: "„დღეს“ გვერდზე დააკოპირეთ ბმული ან ჩამოტვირთეთ QR კოდი.", en: "On Today, copy the link or download the QR code." },
      { ka: "კლიენტი ირჩევს სერვისს, სპეციალისტს და დროს და იღებს ჯავშნის კოდს.", en: "The client picks a service, specialist and time and gets a booking code." },
      { ka: "თუ ელ-ფოსტა მიუთითა, იღებს დადასტურებას და შეხსენებებს ერთი დღით და ორი საათით ადრე.", en: "If they gave an email, they get a confirmation and reminders a day and two hours before." },
      { ka: "კოდით კლიენტი თავად გადაიტანს ან გააუქმებს ვიზიტს.", en: "With the code, the client can move or cancel the visit." },
      { ka: "შეხსენების ტექსტი პარამეტრებში იცვლება.", en: "Change the reminder text in Settings." },
    ],
    link: { href: "/settings", label: { ka: "შეხსენებების პარამეტრები", en: "Reminder settings" } },
  },
  {
    id: "clients", scene: "clients",
    title: { ka: "კლიენტების ბაზა", en: "Your client base" },
    intro: { ka: "ყველა კლიენტის ისტორია ერთ ადგილას და ყოველთვის იცით, ვის დაურეკოთ.", en: "Every client's history in one place, and you always know whom to call." },
    steps: [
      { ka: "სიები თავად ივსება: დაბრუნების დროა, საფრთხეშია, დაბადების დღე, VIP.", en: "Lists fill themselves: due back, at risk, birthday, VIP." },
      { ka: "ბარათზე: ვიზიტები, დახარჯული, ჩვეული პერიოდი და შემდეგი ვიზიტი.", en: "On the card: visits, spending, usual gap and next visit." },
      { ka: "ჩაწერეთ ალერგიები და ფერის ფორმულები, რომ არავის დაავიწყდეს.", en: "Note allergies and colour formulas so nobody forgets." },
      { ka: "დარეკვა, Viber, WhatsApp და ჯავშანი ერთი შეხებით.", en: "Call, Viber, WhatsApp and Book with one tap." },
      { ka: "ერთი ადამიანის ორი ბარათი? გააერთიანეთ.", en: "Two cards for one person? Merge them." },
    ],
    link: { href: "/clients", label: { ka: "კლიენტების გახსნა", en: "Open clients" } },
  },
  {
    id: "team", scene: "team",
    title: { ka: "გუნდი და როლები", en: "Team and roles" },
    intro: { ka: "ყველა თავისი სახელით შედის და ხედავს მხოლოდ იმას, რაც სჭირდება.", en: "Everyone signs in with their own name and sees only what they need." },
    steps: [
      { ka: "პარამეტრები › სპეციალისტები › გუნდის წვდომა › მოწვევა.", en: "Settings › Specialists › Team access › Invite." },
      { ka: "აირჩიეთ როლი: სპეციალისტი ან ადმინისტრატორი.", en: "Choose a role: specialist or admin." },
      { ka: "გაუგზავნეთ ბმული Viber-ით ან WhatsApp-ით. მოქმედებს 7 დღე.", en: "Send the link by Viber or WhatsApp. It works for 7 days." },
      { ka: "სპეციალისტი ხედავს თავის ვიზიტებს, კლიენტებს და შემოსავალს.", en: "A specialist sees their own visits, clients and earnings." },
    ],
    link: { href: "/settings/staff", label: { ka: "გუნდის მართვა", en: "Manage the team" } },
  },
  {
    id: "earnings", scene: "earnings",
    title: { ka: "შემოსავალი და საკომისიო", en: "Earnings and commission" },
    intro: { ka: "თვის ბოლოს ხელით დათვლა აღარ გჭირდებათ.", en: "No more counting by hand at the end of the month." },
    steps: [
      { ka: "აირჩიეთ პერიოდი: დღეს, კვირა, თვე ან სხვა.", en: "Pick a period: today, week, month or custom." },
      { ka: "ნახეთ გადახდილი, ნაღდი, ბარათი, თიფი და შედარება წინა პერიოდთან.", en: "See paid, cash, card, tips and the comparison with before." },
      { ka: "მიუთითეთ თითოეული სპეციალისტის საკომისიო. ახალი პროცენტი მოქმედებს ახალ გადახდებზე.", en: "Set each specialist's commission. A new percent applies to new payments." },
      { ka: "გასაცემები ჩამოტვირთეთ Excel-ში.", en: "Download payouts to Excel." },
    ],
    link: { href: "/reports", label: { ka: "შემოსავლის გახსნა", en: "Open earnings" } },
  },
];

const MASTER: Lesson[] = [
  {
    id: "my-day", scene: "today",
    title: { ka: "შენი დღე", en: "Your day" },
    intro: { ka: "ხედავ მხოლოდ შენს ვიზიტებს და შენს კლიენტებს.", en: "You see only your own visits and clients." },
    steps: [
      { ka: "„დღეს“ გვერდზე შენი დღის ვიზიტებია.", en: "Today shows your visits for the day." },
      { ka: "კალენდარში შენი სვეტი და კვირის ხედი.", en: "The Calendar shows your column and your week." },
      { ka: "შეეხე ვიზიტს: კლიენტის ნომერი და მოქმედებები.", en: "Tap a visit: the client's number and actions." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "my-visits", scene: "visit",
    title: { ka: "მოვიდა და დასრულდა", en: "Arrived and done" },
    intro: { ka: "მონიშნე ვიზიტის მდგომარეობა. გადახდას ადმინისტრაცია იღებს.", en: "Mark the visit status. The front desk takes the payment." },
    steps: [
      { ka: "კლიენტი მოვიდა? შეეხე „მოვიდა“.", en: "Client is here? Tap Arrived." },
      { ka: "დამთავრდა? შეეხე „დასრულება“.", en: "Finished? Tap Done." },
      { ka: "არ მოვიდა? აირჩიე „არ მოვიდა“.", en: "Didn't come? Choose No-show." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "my-time", scene: "calendar",
    title: { ka: "შენი დროის დაბლოკვა", en: "Blocking your time" },
    intro: { ka: "შესვენება ან ექიმთან ვიზიტი? დაბლოკე დრო და მასზე ვერავინ ჩაეწერება.", en: "A break or a doctor's visit? Block the time and nobody can book it." },
    steps: [
      { ka: "კალენდარში შეეხე „დაბლოკვა“ ან ცარიელ დროს.", en: "In the Calendar, tap Block time or an empty time." },
      { ka: "აირჩიე დასაწყისი და დასასრული, შეგიძლია მიზეზიც დაწერო.", en: "Pick the start and end; you can add a reason." },
      { ka: "გასაუქმებლად შეეხე დაბლოკილ დროს.", en: "To remove it, tap the blocked time." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "my-clients", scene: "clients",
    title: { ka: "შენი კლიენტები", en: "Your clients" },
    intro: { ka: "ნახე ისტორია და ჩაწერე, რაც უნდა გახსოვდეს.", en: "See the history and note what you need to remember." },
    steps: [
      { ka: "კლიენტების გვერდზე ის კლიენტები არიან, ვინც შენთან იყო ან ჩაწერილია.", en: "Clients shows the people who came to you or are booked with you." },
      { ka: "ბარათზე ჩაწერე ალერგია, ფორმულა ან შენიშვნა.", en: "On the card, add an allergy, a formula or a note." },
    ],
    link: { href: "/clients", label: { ka: "კლიენტების გახსნა", en: "Open clients" } },
  },
  {
    id: "my-earnings", scene: "earnings",
    title: { ka: "შენი შემოსავალი", en: "Your earnings" },
    intro: { ka: "ნახე შენი საკომისიო, თიფი და გასაცემი ნებისმიერი პერიოდისთვის.", en: "See your commission, tips and payout for any period." },
    steps: [
      { ka: "გახსენი „ჩემი შემოსავალი“ და აირჩიე პერიოდი.", en: "Open My earnings and pick a period." },
      { ka: "გასაცემი = საკომისიო + თიფი.", en: "Payout = commission + tips." },
    ],
    link: { href: "/reports", label: { ka: "ჩემი შემოსავალი", en: "My earnings" } },
  },
];

const STORAGE_KEY = "moarge.guide.viewed";
const STEP_MS = 2400;

function readViewed(): string[] {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]; } catch { return []; }
}

/** A short, animated guide to the dashboard. Masters get their own lessons. */
export default function GuideView({ audience, initialLesson }: { audience: Audience; initialLesson?: string }) {
  const { lang, t } = useLanguage();
  const lessons = audience === "master" ? MASTER : OFFICE;
  const [index, setIndex] = useState(() => Math.max(0, lessons.findIndex((lesson) => lesson.id === initialLesson)));
  const [viewed, setViewed] = useState<string[]>([]);
  const lesson = lessons[index];
  const scene = SCENES[lesson.scene];
  const reducedMotion = usePrefersReducedMotion();
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [step, setStep] = useStepTimer({ count: scene.captions.length, interval: STEP_MS, running: onScreen && !reducedMotion });
  const shownStep = reducedMotion && step === 0 ? scene.captions.length - 1 : step;

  useEffect(() => { setViewed(readViewed()); }, []);

  // Opening a lesson counts as seen; remembered only in this browser.
  useEffect(() => {
    setViewed((current) => {
      if (current.includes(lesson.id)) return current;
      const next = [...current, lesson.id];
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage may be off */ }
      return next;
    });
    window.history.replaceState(null, "", `/guide?lesson=${lesson.id}`);
  }, [lesson.id]);

  function open(next: number) {
    setIndex(next);
    setStep(0);
  }

  const done = lessons.filter((item) => viewed.includes(item.id)).length;
  const Scene = scene.Scene;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand"><GraduationCap className="h-4 w-4" />{t("გზამკვლევი", "Guide")}</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">{t("როგორ მუშაობს moarge", "How moarge works")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("მოკლე გაკვეთილები ანიმაციით. თითოეულს ერთი წუთი სჭირდება.", "Short animated lessons. Each takes about a minute.")}</p>
        </div>
        <div className="w-full max-w-xs">
          <p className="text-sm text-stone-600">{t(`ნანახია ${done} / ${lessons.length}`, `Seen ${done} / ${lessons.length}`)}</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(done / lessons.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <nav aria-label={t("გაკვეთილები", "Lessons")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {lessons.map((item, itemIndex) => {
            const active = itemIndex === index;
            const seen = viewed.includes(item.id);
            return (
              <button key={item.id} type="button" onClick={() => open(itemIndex)} aria-current={active ? "step" : undefined}
                className={cn("flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-3 text-left text-sm font-semibold transition",
                  active ? "border-brand bg-brand text-white shadow-sm" : "border-stone-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-brand-soft")}>
                <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                  active ? "bg-white/20 text-white" : seen ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500")}>
                  {seen && !active ? <Check className="h-4 w-4" /> : itemIndex + 1}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{item.title[lang]}</span>
              </button>
            );
          })}
        </nav>

        <Card key={lesson.id} className="step-in">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-sm font-semibold text-brand">{t(`გაკვეთილი ${index + 1}`, `Lesson ${index + 1}`)}</p>
                <h2 className="mt-1 text-xl font-bold text-stone-900 sm:text-2xl">{lesson.title[lang]}</h2>
                <p className="mt-1 text-stone-600">{lesson.intro[lang]}</p>
              </div>
              <ol className="space-y-2.5">
                {lesson.steps.map((item, stepIndex) => (
                  <li key={stepIndex} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">{stepIndex + 1}</span>
                    <span className="text-stone-800">{item[lang]}</span>
                  </li>
                ))}
              </ol>
              {lesson.links && <div className="flex flex-wrap gap-2">
                {lesson.links.map((link) => (
                  <ButtonLink key={link.href} href={link.href} variant="secondary" icon={<ExternalLink className="h-4 w-4 text-brand" />}>{link.label[lang]}</ButtonLink>
                ))}
              </div>}
              <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                {lesson.link && <ButtonLink href={lesson.link.href} icon={<ArrowRight className="h-4 w-4" />}>{lesson.link.label[lang]}</ButtonLink>}
                {index + 1 < lessons.length
                  ? <Button variant="secondary" onClick={() => open(index + 1)} icon={<ChevronRight className="h-4 w-4" />}>{t("შემდეგი გაკვეთილი", "Next lesson")}</Button>
                  : <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />{t("ყველა გაკვეთილი ნანახია. წარმატებები!", "That was the last lesson. Good luck!")}</p>}
              </div>
            </div>

            <div ref={ref} className="mx-auto w-full max-w-[480px] xl:w-[300px]">
              <div aria-hidden="true" className="flex justify-center">
                <div className={cn("w-full", scene.frame === "phone" && "max-w-[232px]")}>
                  <DeviceFrame frame={scene.frame}><Scene step={shownStep} /></DeviceFrame>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setStep((shownStep - 1 + scene.captions.length) % scene.captions.length)} aria-label={t("წინა", "Previous")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-brand-soft"><ChevronLeft className="h-5 w-5" /></button>
                <p className="min-w-0 flex-1 text-center text-sm font-semibold text-stone-800">{scene.captions[shownStep][lang]}</p>
                <button type="button" onClick={() => setStep((shownStep + 1) % scene.captions.length)} aria-label={t("შემდეგი", "Next")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-brand-soft"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="mt-2 flex justify-center gap-1">
                {scene.captions.map((_, dot) => <span key={dot} className={cn("h-1.5 rounded-full transition-all duration-300", dot === shownStep ? "w-6 bg-brand" : "w-1.5 bg-rose-200")} />)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
