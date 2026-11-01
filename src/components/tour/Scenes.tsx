"use client";

import React from "react";
import { Check, CheckCircle2, Copy, Download, Lock, Mail, MessageCircle, Move, Plus, Sparkles, UserCheck, Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/components/ui";

// Small, self-contained pictures of real moarge screens. Each scene is driven by `step` from the
// outside (the landing page tour or the dashboard guide). Only opacity and transform animate, so
// they stay smooth on cheap phones. Names and numbers are examples.

export type Text = { ka: string; en: string };
export interface SceneProps { step: number }
export interface SceneInfo {
  id: string;
  title: Text;
  frame: "phone" | "tablet";
  captions: Text[];
  Scene: (props: SceneProps) => React.JSX.Element;
}

const ROSE = "#e11d48";
const VIOLET = "#7c3aed";
const CYAN = "#0891b2";
const EASE = "transition-all duration-500 ease-out";

function show(visible: boolean, from = "translate-y-2") {
  return visible ? "opacity-100 translate-x-0 translate-y-0 scale-100" : `pointer-events-none opacity-0 ${from}`;
}

/** Phone or tablet outline around a scene. Purely decorative. */
export function DeviceFrame({ frame, children }: { frame: "phone" | "tablet"; children: React.ReactNode }) {
  return frame === "phone" ? (
    <div className="relative mx-auto h-[440px] w-[232px] shrink-0 overflow-hidden rounded-[2.2rem] border-[7px] border-stone-900 bg-white shadow-2xl shadow-rose-950/20">
      <div className="absolute left-1/2 top-1.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-stone-900" />
      <div className="relative h-full overflow-hidden pt-7">{children}</div>
    </div>
  ) : (
    <div className="relative mx-auto h-[340px] w-full max-w-[480px] overflow-hidden rounded-[1.6rem] border-[7px] border-stone-900 bg-white shadow-2xl shadow-rose-950/20">
      <div className="relative h-full overflow-hidden">{children}</div>
    </div>
  );
}

function Toast({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("absolute inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-[11px] font-semibold text-white shadow-lg", EASE, show(visible))}>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />{children}
    </div>
  );
}

/* 1. A client books on their phone. */
function BookingScene({ step }: SceneProps) {
  const { t } = useLanguage();
  const services = [
    { name: t("მანიკური", "Manicure"), price: "40 ₾", time: t("60 წთ", "60 min") },
    { name: t("თმის შეღებვა", "Hair colour"), price: "150 ₾", time: t("2 სთ", "2 h") },
    { name: t("წარბები", "Brows"), price: "25 ₾", time: t("30 წთ", "30 min") },
  ];
  return (
    <div className="flex h-full flex-col bg-ivory text-stone-900">
      <div className="bg-rose-600 px-4 pb-4 pt-2 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-100">moarge</p>
        <p className="text-base font-bold">{t("სალონი ია", "Salon Ia")}</p>
        <p className="text-[11px] text-rose-100">{t("ონლაინ ჩაწერა", "Book online")}</p>
      </div>
      <div className="relative flex-1 space-y-3 p-3">
        <div className="space-y-1.5">
          {services.map((service, index) => (
            <div key={service.name} className={cn("flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-[12px]", EASE,
              step >= 1 && index === 0 ? "border-rose-500 ring-2 ring-rose-200" : "border-stone-200", step >= 1 && index !== 0 && "opacity-50")}>
              <span><span className="block font-semibold">{service.name}</span><span className="text-[10px] text-stone-500">{service.time}</span></span>
              <span className="font-bold text-rose-700">{service.price}</span>
            </div>
          ))}
        </div>
        <div className={cn("space-y-2", EASE, show(step >= 1))}>
          <div className="flex gap-1.5">
            {[t("ანა", "Ana"), t("თამარი", "Tamar"), t("ნებისმიერი", "Anyone")].map((name, index) => (
              <span key={name} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", index === 0 ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200 bg-white text-stone-700")}>{name}</span>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-stone-600">{t("ხვალ, 12 ნოემბერი", "Tomorrow, 12 November")}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {["11:00", "12:30", "14:00", "16:30"].map((time) => (
              <span key={time} className={cn("rounded-lg border py-1.5 text-center text-[11px] font-semibold", EASE,
                step >= 2 && time === "12:30" ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200 bg-white")}>{time}</span>
            ))}
          </div>
        </div>
        <div className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ivory p-4 text-center", EASE, show(step >= 3, "scale-95"))}>
          <span className={cn("inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white", EASE, step >= 3 ? "scale-100" : "scale-50")}><Check className="h-7 w-7" /></span>
          <p className="text-sm font-bold">{t("ჯავშანი დადასტურდა", "Booking confirmed")}</p>
          <p className="text-[11px] text-stone-600">{t("ხვალ 12:30 · მანიკური · ანა", "Tomorrow 12:30 · Manicure · Ana")}</p>
          <div className="rounded-xl bg-white px-4 py-2 shadow-sm">
            <p className="text-[10px] text-stone-500">{t("ჯავშნის კოდი", "Booking code")}</p>
            <p className="text-xl font-black tracking-[0.2em] text-rose-700">750 934</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 2. The booking lands in the calendar; move it, block time. */
function CalendarScene({ step }: SceneProps) {
  const { t } = useLanguage();
  const columns = [{ name: t("ანა", "Ana"), color: ROSE }, { name: t("თამარი", "Tamar"), color: VIOLET }, { name: t("ლიკა", "Lika"), color: CYAN }];
  const hours = ["11:00", "12:00", "13:00", "14:00", "15:00"];
  const slot = 48; // pixels per hour in this picture
  const block = (color: string) => ({ backgroundColor: `${color}1f`, borderLeftColor: color });
  return (
    <div className="flex h-full flex-col text-stone-900">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <p className="text-[12px] font-bold">{t("ხუთშაბათი, 12 ნოემბერი", "Thursday, 12 November")}</p>
        <span className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white">+ {t("ჯავშანი", "Book")}</span>
      </div>
      <div className="grid grid-cols-[38px_1fr] px-2 pt-1">
        <span />
        <div className="grid grid-cols-3 gap-1 pb-1 text-center text-[10px] font-semibold">
          {columns.map((column) => <span key={column.name} className="flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: column.color }} />{column.name}</span>)}
        </div>
      </div>
      <div className="relative grid flex-1 grid-cols-[38px_1fr] px-2">
        <div>{hours.map((hour) => <p key={hour} className="h-12 text-[9px] text-stone-400">{hour}</p>)}</div>
        <div className="relative grid grid-cols-3 gap-1">
          {columns.map((column) => <div key={column.name} className="rounded-md border-l border-stone-100 bg-[repeating-linear-gradient(to_bottom,transparent,transparent_47px,#f5f5f4_47px,#f5f5f4_48px)]" />)}
          <div className="absolute left-0 w-[calc((100%-0.5rem)/3)] rounded-md border-l-4 px-1.5 py-1 text-[9px]" style={{ top: 0, height: slot - 4, ...block(ROSE) }}><b>11:00</b> {t("ეკა", "Eka")}</div>
          <div className="absolute w-[calc((100%-0.5rem)/3)] rounded-md border-l-4 px-1.5 py-1 text-[9px]" style={{ left: "calc((100% + 0.25rem) / 3)", top: slot * 0.5, height: slot * 1.5 - 4, ...block(VIOLET) }}><b>11:30</b> {t("მარიამი", "Mariam")}</div>
          <div className="absolute w-[calc((100%-0.5rem)/3)] rounded-md border-l-4 px-1.5 py-1 text-[9px]" style={{ left: "calc((100% + 0.25rem) * 2 / 3)", top: slot * 2, height: slot - 4, ...block(CYAN) }}><b>13:00</b> {t("ნატო", "Nato")}</div>
          {/* The new online booking: appears in Ana's column, then moves to Tamar at 14:00. */}
          <div className={cn("absolute left-0 w-[calc((100%-0.5rem)/3)] rounded-md border-l-4 px-1.5 py-1 text-[9px] shadow-md", "transition-all duration-700 ease-out",
            step >= 1 ? "opacity-100" : "opacity-0", step === 1 && "ring-2 ring-rose-300")}
            style={{ top: slot * 1.5, height: slot - 4, ...block(step >= 2 ? VIOLET : ROSE), transform: step >= 2 ? `translate(calc(100% + 0.25rem), ${slot * 1.5}px)` : "translate(0,0)" }}>
            <b>{step >= 2 ? "14:00" : "12:30"}</b> {t("ნინო", "Nino")}{step >= 2 && <Move className="ml-0.5 inline h-2.5 w-2.5" />}
          </div>
          <div className={cn("absolute flex w-[calc((100%-0.5rem)/3)] items-start gap-1 rounded-md border border-stone-300 px-1.5 py-1 text-[9px] text-stone-600 [background:repeating-linear-gradient(135deg,#f5f5f4,#f5f5f4_5px,#e7e5e4_5px,#e7e5e4_10px)]", EASE, show(step >= 3, "scale-95"))}
            style={{ left: "calc((100% + 0.25rem) * 2 / 3)", top: slot * 3.5, height: slot - 4 }}>
            <Lock className="h-2.5 w-2.5 shrink-0" />{t("შესვენება", "Break")}
          </div>
        </div>
      </div>
      <Toast visible={step === 1}>{t("ახალი ონლაინ ჯავშანი · 12:30", "New online booking · 12:30")}</Toast>
      <Toast visible={step === 2}>{t("გადატანილია · 14:00 თამართან", "Moved · 14:00 with Tamar")}</Toast>
      <Toast visible={step === 3}>{t("დრო დაიბლოკა", "Time blocked")}</Toast>
    </div>
  );
}

/* 3. The reminder reaches the client by email. */
function ReminderScene({ step }: SceneProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-stone-800 to-stone-950 text-white">
      <div className={cn("pt-10 text-center", EASE, step >= 2 ? "opacity-0" : "opacity-100")}>
        <p className="text-4xl font-light">11:00</p>
        <p className="text-[11px] text-stone-300">{t("ოთხშაბათი, 11 ნოემბერი", "Wednesday, 11 November")}</p>
      </div>
      <div className={cn("absolute inset-x-3 top-36 rounded-2xl bg-white/95 p-3 text-stone-900 shadow-xl", EASE, show(step === 1, "-translate-y-6"))}>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500"><Mail className="h-3 w-3 text-rose-600" />{t("ელ-ფოსტა · ახლა", "Email · now")}</p>
        <p className="mt-1 text-[12px] font-bold">{t("სალონი ია: ხვალ გელოდებით", "Salon Ia: see you tomorrow")}</p>
        <p className="text-[11px] text-stone-600">{t("ხვალ 12:30 · მანიკური · ანა", "Tomorrow 12:30 · Manicure · Ana")}</p>
      </div>
      <div className={cn("absolute inset-0 bg-ivory p-3 text-stone-900", EASE, show(step >= 2, "translate-y-6"))}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">{t("შეხსენება", "Reminder")}</p>
        <p className="mt-1 text-sm font-bold">{t("სალონი ია: ხვალ გელოდებით", "Salon Ia: see you tomorrow")}</p>
        <div className="mt-3 space-y-1.5 rounded-xl bg-white p-3 text-[11px] shadow-sm">
          <p className="flex justify-between"><span className="text-stone-500">{t("დრო", "Time")}</span><b>{t("ხვალ 12:30", "Tomorrow 12:30")}</b></p>
          <p className="flex justify-between"><span className="text-stone-500">{t("სერვისი", "Service")}</span><b>{t("მანიკური", "Manicure")}</b></p>
          <p className="flex justify-between"><span className="text-stone-500">{t("სპეციალისტი", "Specialist")}</span><b>{t("ანა", "Ana")}</b></p>
          <p className="flex justify-between"><span className="text-stone-500">{t("კოდი", "Code")}</span><b className="tracking-widest text-rose-700">750 934</b></p>
        </div>
        <div className={cn("mt-3 grid grid-cols-2 gap-2", EASE, show(step >= 3))}>
          <span className="rounded-xl bg-rose-600 py-2 text-center text-[11px] font-semibold text-white">{t("გადატანა", "Reschedule")}</span>
          <span className="rounded-xl border border-stone-200 bg-white py-2 text-center text-[11px] font-semibold">{t("გაუქმება", "Cancel")}</span>
        </div>
        <p className={cn("mt-3 text-center text-[10px] text-stone-500", EASE, show(step >= 3))}>{t("კლიენტს დარეკვა არ სჭირდება", "No phone call needed")}</p>
      </div>
    </div>
  );
}

/* 4. The visit on the day: arrived, done, paid. */
function VisitScene({ step }: SceneProps) {
  const { t } = useLanguage();
  const status = step === 0 ? { label: t("დაგეგმილი", "Booked"), tone: "bg-rose-50 text-rose-700" }
    : step === 1 ? { label: t("მოვიდა", "Arrived"), tone: "bg-amber-50 text-amber-700" }
    : { label: step >= 3 ? t("გადახდილია", "Paid") : t("დასრულდა", "Done"), tone: step >= 3 ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700" };
  return (
    <div className="flex h-full flex-col bg-ivory p-3 text-stone-900">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white p-2.5 shadow-sm"><p className="text-[10px] text-stone-500">{t("ვიზიტები დღეს", "Visits today")}</p><p className="text-lg font-bold">7</p></div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm"><p className="text-[10px] text-stone-500">{t("გადახდილი დღეს", "Paid today")}</p>
          <p className="text-lg font-bold"><span className={cn("inline-block", EASE, step >= 3 && "text-emerald-700")}>{step >= 3 ? "355 ₾" : "310 ₾"}</span></p></div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-white p-2.5" style={{ borderLeft: `4px solid ${ROSE}` }}>
        <span className="w-10 text-center text-sm font-bold">12:30</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold">{t("ნინო ბერიძე", "Nino Beridze")}</span><span className="text-[10px] text-stone-500">{t("მანიკური · ანა", "Manicure · Ana")}</span></span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", EASE, status.tone)}>{status.label}</span>
      </div>
      <div className={cn("mt-2 grid grid-cols-2 gap-2", EASE, show(step <= 1))}>
        <span className={cn("flex items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-semibold", EASE, step === 1 ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white")}><UserCheck className="h-3.5 w-3.5" />{t("მოვიდა", "Arrived")}</span>
        <span className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 py-2 text-[11px] font-semibold text-white"><Wallet className="h-3.5 w-3.5" />{t("დასრულება", "Done")}</span>
      </div>
      <div className={cn("mt-2 space-y-1.5 rounded-xl bg-white p-3 text-[11px] shadow-sm", EASE, show(step >= 2, "translate-y-4"))}>
        <p className="flex justify-between"><span className="text-stone-500">{t("ფასი", "Price")}</span><b>40 ₾</b></p>
        <p className="flex justify-between"><span className="text-stone-500">{t("თიფი", "Tip")}</span><b>+5 ₾</b></p>
        <div className="grid grid-cols-3 gap-1 pt-1">
          {[t("ნაღდი", "Cash"), t("ბარათი", "Card"), t("ორივე", "Split")].map((method, index) => (
            <span key={method} className={cn("rounded-lg border py-1 text-center font-semibold", index === 1 ? "border-rose-600 bg-rose-600 text-white" : "border-stone-200")}>{method}</span>
          ))}
        </div>
        <p className="flex justify-between border-t border-stone-100 pt-1.5 text-[12px]"><span>{t("სულ", "Total")}</span><b>45 ₾</b></p>
      </div>
      <Toast visible={step >= 3}>{t("გადახდა მიღებულია · 45 ₾", "Payment received · 45 ₾")}</Toast>
    </div>
  );
}

/* 5. The client card remembers everything. */
function ClientsScene({ step }: SceneProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex h-full flex-col bg-ivory p-3 text-stone-900">
      <div className={cn("space-y-1.5", EASE, step >= 1 ? "opacity-0" : "opacity-100")}>
        {[
          { name: t("სალომე დ.", "Salome D."), badge: t("დაბრუნების დროა", "Due back"), tone: "bg-rose-50 text-rose-700" },
          { name: t("მარიამ ბ.", "Mariam B."), badge: "VIP", tone: "bg-rose-50 text-rose-700" },
          { name: t("ეკა ჯ.", "Eka J."), badge: t("საფრთხეშია", "At risk"), tone: "bg-amber-50 text-amber-700" },
          { name: t("ნატო კ.", "Nato K."), badge: t("ახალი", "New"), tone: "bg-rose-50 text-rose-700" },
        ].map((row) => (
          <div key={row.name} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-[11px] font-bold text-rose-700">{row.name.charAt(0)}</span>
            <span className="flex-1 text-[12px] font-semibold">{row.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", row.tone)}>{row.badge}</span>
          </div>
        ))}
      </div>
      <div className={cn("absolute inset-0 space-y-2 bg-ivory p-3", EASE, show(step >= 1, "translate-x-6"))}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 font-bold text-rose-700">{t("ს", "S")}</span>
          <div><p className="text-[13px] font-bold">{t("სალომე დოლიძე", "Salome Dolidze")}</p><p className="text-[10px] text-stone-500">+995 555 33 34 44</p></div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[[t("ვიზიტი", "Visits"), "6"], [t("დახარჯა", "Spent"), "540 ₾"], [t("ყოველ", "Every"), t("30 დღე", "30 days")]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white p-1.5 shadow-sm"><p className="text-[9px] text-stone-500">{label}</p><p className="text-[12px] font-bold">{value}</p></div>
          ))}
        </div>
        <div className={cn("rounded-xl border border-red-200 bg-red-50 p-2 text-[11px]", EASE, show(step >= 2))}>
          <p className="text-[9px] font-semibold uppercase text-red-700">{t("ალერგია", "Allergy")}</p><p>{t("ლატექსი", "Latex")}</p>
        </div>
        <div className={cn("rounded-xl border border-stone-200 bg-white p-2 text-[11px]", EASE, show(step >= 2))}>
          <p className="text-[9px] font-semibold uppercase text-rose-700">{t("ფორმულა", "Formula")}</p><p>7.1 + 6% 1:1, 35 {t("წთ", "min")}</p>
        </div>
        <div className={cn("flex items-center justify-between rounded-xl bg-rose-50 p-2 text-[11px]", EASE, show(step >= 3))}>
          <span className="font-semibold text-rose-800">{t("დაბრუნების დროა", "Due back")}</span>
          <span className="animate-pulse rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white">{t("ჯავშანი", "Book")}</span>
        </div>
      </div>
    </div>
  );
}

/* 6. The team joins by link; a master sees only their own day. */
function TeamScene({ step }: SceneProps) {
  const { t } = useLanguage();
  return (
    <div className="relative flex h-full flex-col bg-ivory p-3 text-stone-900">
      <div className={cn("space-y-2", EASE, step >= 2 ? "opacity-0" : "opacity-100")}>
        <p className="text-[12px] font-bold">{t("გუნდში მოწვევა", "Invite to the team")}</p>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-semibold text-white">{t("სპეციალისტი", "Specialist")}</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-semibold">{t("ადმინისტრატორი", "Admin")}</span>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-500">ana@gmail.com</div>
        <div className={cn("space-y-1.5 rounded-xl bg-white p-2.5 shadow-sm", EASE, show(step >= 1))}>
          <p className="truncate rounded-lg bg-stone-50 px-2 py-1.5 font-mono text-[9px] text-stone-600">moarge.com/invite/5Rye…</p>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
            <span className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 py-1"><Copy className="h-3 w-3" />{t("კოპირება", "Copy")}</span>
            <span className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 py-1"><MessageCircle className="h-3 w-3 text-emerald-600" />WhatsApp</span>
            <span className="flex items-center justify-center gap-1 rounded-lg border border-stone-200 py-1"><MessageCircle className="h-3 w-3 text-violet-600" />Viber</span>
          </div>
        </div>
      </div>
      <div className={cn("absolute inset-0 space-y-2 bg-ivory p-3", EASE, show(step >= 2, "translate-x-6"))}>
        <p className="text-[11px] text-stone-500">{t("ანას ტელეფონი", "Ana's phone")}</p>
        <p className="text-[13px] font-bold">{t("გამარჯობა, ანა", "Hello, Ana")}</p>
        {[["11:00", t("ეკა", "Eka")], ["12:30", t("ნინო", "Nino")], ["15:00", t("სალომე", "Salome")]].map(([time, name]) => (
          <div key={time} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm" style={{ borderLeft: `4px solid ${ROSE}` }}>
            <b className="w-10 text-center text-[12px]">{time}</b><span className="flex-1 text-[11px] font-semibold">{name}</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700">{t("ჩემი", "Mine")}</span>
          </div>
        ))}
        <p className={cn("rounded-xl bg-white p-2 text-[10px] text-stone-600", EASE, show(step >= 3))}>
          {t("სპეციალისტი ხედავს მხოლოდ თავის ვიზიტებს და კლიენტებს.", "A specialist sees only their own visits and clients.")}
        </p>
      </div>
    </div>
  );
}

/* 7. Earnings, commission and payouts. */
function EarningsScene({ step }: SceneProps) {
  const { t } = useLanguage();
  const bars = [38, 55, 42, 70, 64, 82, 48];
  return (
    <div className="flex h-full flex-col bg-ivory p-3 text-stone-900">
      <div className="grid grid-cols-3 gap-1.5">
        {[[t("გადახდილი", "Paid"), step >= 1 ? "11 940 ₾" : "0 ₾"], [t("ვიზიტი", "Visits"), step >= 1 ? "190" : "0"], [t("თიფი", "Tips"), step >= 1 ? "240 ₾" : "0 ₾"]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[9px] text-stone-500">{label}</p><p className="text-[13px] font-bold">{value}</p></div>
        ))}
      </div>
      <div className="mt-2 flex h-20 items-end gap-[3px] rounded-xl bg-white p-2 shadow-sm">
        {bars.map((height, index) => (
          <div key={index} className="flex-1 origin-bottom rounded-t-[3px] bg-rose-600 transition-transform duration-700 ease-out"
            style={{ height: `${height}%`, transform: step >= 1 ? "scaleY(1)" : "scaleY(0)", transitionDelay: `${index * 60}ms` }} />
        ))}
      </div>
      <div className={cn("mt-2 space-y-1.5", EASE, show(step >= 2))}>
        {[[t("ანა", "Ana"), ROSE, "40%", "2 579 ₾"], [t("თამარი", "Tamar"), VIOLET, "35%", "2 146 ₾"]].map(([name, color, rate, pay]) => (
          <div key={name} className="flex items-center gap-2 rounded-xl bg-white p-2 text-[11px] shadow-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex-1 font-semibold">{name}</span>
            <span className="text-stone-500">{rate}</span>
            <span className="font-bold">{pay}</span>
          </div>
        ))}
        <p className="text-[9px] text-stone-500">{t("გასაცემი = საკომისიო + თიფი", "Payout = commission + tips")}</p>
      </div>
      <span className={cn("mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold", EASE, step >= 3 ? "bg-emerald-600 text-white" : "border border-stone-200 bg-white text-stone-700", show(step >= 2))}>
        <Download className="h-3.5 w-3.5" />{t("გასაცემები Excel-ში", "Payouts to Excel")}
      </span>
    </div>
  );
}

/** The Today screen, used as the opening picture of the guide. */
function TodayScene({ step }: SceneProps) {
  const { t } = useLanguage();
  const rows = [["10:00", t("ნინო ბ.", "Nino B."), ROSE, t("დასრულდა", "Done")], ["11:30", t("მარიამ კ.", "Mariam K."), VIOLET, t("მოვიდა", "Arrived")], ["13:00", t("ეკა ჯ.", "Eka J."), ROSE, t("დაგეგმილი", "Booked")], ["15:30", t("სალომე დ.", "Salome D."), CYAN, t("დაგეგმილი", "Booked")]];
  return (
    <div className="flex h-full flex-col bg-ivory p-3 text-stone-900">
      <p className="text-[10px] font-semibold text-rose-600">{t("ხუთშაბათი, 12 ნოემბერი", "Thursday, 12 November")}</p>
      <p className="text-[14px] font-bold">{t("გამარჯობა, ნინო", "Hello, Nino")}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[9px] text-stone-500">{t("ვიზიტები დღეს", "Visits today")}</p><p className="text-[14px] font-bold">4</p></div>
        <div className="rounded-xl bg-white p-2 shadow-sm"><p className="text-[9px] text-stone-500">{t("სავარაუდო დღეს", "Expected today")}</p><p className="text-[14px] font-bold">310 ₾</p></div>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map(([time, name, color, status], index) => (
          <div key={time} className={cn("flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm", EASE, index === 2 && step >= 1 && "ring-2 ring-rose-300")} style={{ borderLeft: `4px solid ${color}` }}>
            <b className="w-10 text-center text-[11px]">{time}</b><span className="flex-1 text-[11px] font-semibold">{name}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold text-stone-700">{status}</span>
          </div>
        ))}
      </div>
      <div className={cn("mt-auto flex items-center gap-2 rounded-xl bg-rose-600 p-2.5 text-[11px] font-semibold text-white", EASE, show(step >= 2))}>
        <Sparkles className="h-4 w-4" />{t("შემდეგი: 13:00 ეკა", "Next: 13:00 Eka")}<Plus className="ml-auto h-4 w-4" />
      </div>
    </div>
  );
}

export const SCENES: Record<string, SceneInfo> = {
  booking: {
    id: "booking", frame: "phone", Scene: BookingScene,
    title: { ka: "კლიენტი თავად ეწერება", en: "Clients book themselves" },
    captions: [
      { ka: "კლიენტი ხსნის თქვენი სალონის ბმულს", en: "The client opens your salon's link" },
      { ka: "ირჩევს სერვისს და სპეციალისტს", en: "Picks a service and a specialist" },
      { ka: "ხედავს მხოლოდ თავისუფალ დროს", en: "Sees only free times" },
      { ka: "იღებს დადასტურებას და ჯავშნის კოდს", en: "Gets a confirmation and a booking code" },
    ],
  },
  calendar: {
    id: "calendar", frame: "tablet", Scene: CalendarScene,
    title: { ka: "ჯავშანი კალენდარში ჩნდება", en: "It lands in your calendar" },
    captions: [
      { ka: "ყველა სპეციალისტი ერთ ეკრანზე", en: "Every specialist on one screen" },
      { ka: "ახალი ონლაინ ჯავშანი მაშინვე ჩანს", en: "A new online booking shows at once" },
      { ka: "გადაიტანეთ რამდენიმე შეხებით", en: "Move it in a couple of taps" },
      { ka: "დაბლოკეთ შესვენება ან დასვენება", en: "Block a break or time off" },
    ],
  },
  reminder: {
    id: "reminder", frame: "phone", Scene: ReminderScene,
    title: { ka: "შეხსენება ავტომატურად", en: "Reminders go out on their own" },
    captions: [
      { ka: "ვიზიტამდე ერთი დღით ადრე", en: "One day before the visit" },
      { ka: "კლიენტი იღებს წერილს", en: "The client gets an email" },
      { ka: "დრო, სერვისი, სპეციალისტი და კოდი", en: "Time, service, specialist and code" },
      { ka: "გადატანა ან გაუქმება დარეკვის გარეშე", en: "Reschedule or cancel without a call" },
    ],
  },
  visit: {
    id: "visit", frame: "phone", Scene: VisitScene,
    title: { ka: "ვიზიტი და გადახდა", en: "The visit and payment" },
    captions: [
      { ka: "დღის განრიგი ერთ სიაში", en: "The day in one list" },
      { ka: "მოვიდა: ერთი შეხებით", en: "Arrived: one tap" },
      { ka: "დასრულება: ფასი, თიფი, ნაღდი ან ბარათი", en: "Done: price, tip, cash or card" },
      { ka: "დღის შემოსავალი თავად ითვლება", en: "The day's income adds up by itself" },
    ],
  },
  clients: {
    id: "clients", frame: "phone", Scene: ClientsScene,
    title: { ka: "კლიენტების ბაზა", en: "Your client base" },
    captions: [
      { ka: "ავტომატური სიები: დაბრუნების დროა, VIP, საფრთხეშია", en: "Automatic lists: due back, VIP, at risk" },
      { ka: "ბარათზე ვიზიტები, დახარჯული და ჩვეული პერიოდი", en: "Visits, spending and usual gap on the card" },
      { ka: "ალერგიები და ფერის ფორმულები", en: "Allergies and colour formulas" },
      { ka: "დაბრუნების დროა? ჩაწერეთ ერთი შეხებით", en: "Due back? Book with one tap" },
    ],
  },
  team: {
    id: "team", frame: "phone", Scene: TeamScene,
    title: { ka: "მთელი გუნდი შედის", en: "The whole team signs in" },
    captions: [
      { ka: "მოიწვიეთ სპეციალისტი ან ადმინისტრატორი", en: "Invite a specialist or an admin" },
      { ka: "გაუგზავნეთ ბმული Viber-ით ან WhatsApp-ით", en: "Send the link by Viber or WhatsApp" },
      { ka: "სპეციალისტი ხედავს თავის დღეს", en: "A specialist sees their own day" },
      { ka: "სხვისი კლიენტები დაცულია", en: "Other clients stay private" },
    ],
  },
  earnings: {
    id: "earnings", frame: "phone", Scene: EarningsScene,
    title: { ka: "შემოსავალი და საკომისიო", en: "Earnings and commission" },
    captions: [
      { ka: "აირჩიეთ პერიოდი", en: "Pick a period" },
      { ka: "გადახდილი, ვიზიტები და თიფი წინა პერიოდთან შედარებით", en: "Paid, visits and tips compared with before" },
      { ka: "თითოეული სპეციალისტის საკომისიო და გასაცემი", en: "Each specialist's commission and payout" },
      { ka: "ერთი ღილაკით Excel-ში", en: "To Excel with one button" },
    ],
  },
  today: {
    id: "today", frame: "phone", Scene: TodayScene,
    title: { ka: "დღეს", en: "Today" },
    captions: [
      { ka: "დილით ხედავთ მთელ დღეს", en: "In the morning you see the whole day" },
      { ka: "შეეხეთ ვიზიტს მოქმედებისთვის", en: "Tap a visit for actions" },
      { ka: "შემდეგი კლიენტი ყოველთვის ზემოთაა", en: "The next client is always on top" },
    ],
  },
};
