"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n";

type ServiceDraft = { name_ka: string; name_en: string; price_gel: number; duration_minutes: number; category: string };
const templates: Record<"salon" | "aesthetic", ServiceDraft[]> = {
  salon: [
    { name_ka: "თმის შეჭრა", name_en: "Haircut", price_gel: 35, duration_minutes: 45, category: "hair" },
    { name_ka: "მანიკური", name_en: "Manicure", price_gel: 40, duration_minutes: 60, category: "nails" },
    { name_ka: "სახის მოვლა", name_en: "Facial care", price_gel: 70, duration_minutes: 60, category: "skin" },
    { name_ka: "კონსულტაცია", name_en: "Consultation", price_gel: 0, duration_minutes: 30, category: "consultation" },
  ],
  aesthetic: [
    { name_ka: "კანის კონსულტაცია", name_en: "Skin consultation", price_gel: 0, duration_minutes: 30, category: "consultation" },
    { name_ka: "სახის წმენდა", name_en: "Facial treatment", price_gel: 90, duration_minutes: 75, category: "facial" },
    { name_ka: "ლაზერული პროცედურა", name_en: "Laser treatment", price_gel: 80, duration_minutes: 45, category: "laser" },
    { name_ka: "მასაჟი", name_en: "Massage", price_gel: 100, duration_minutes: 60, category: "massage" },
  ],
};
const weekdays = [
  ["ორშაბათი", "Monday"], ["სამშაბათი", "Tuesday"], ["ოთხშაბათი", "Wednesday"],
  ["ხუთშაბათი", "Thursday"], ["პარასკევი", "Friday"], ["შაბათი", "Saturday"], ["კვირა", "Sunday"],
];

export default function OnboardingWizard({ initialName, initialPhone = "", initialAddress = "", timezone = "Asia/Tbilisi", slug }: {
  initialName: string; initialPhone?: string; initialAddress?: string; timezone?: string; slug: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [salonType, setSalonType] = useState<"salon" | "aesthetic">("salon");
  const [salonName, setSalonName] = useState(initialName);
  const [salonPhone, setSalonPhone] = useState(initialPhone);
  const [salonAddress, setSalonAddress] = useState(initialAddress);
  const [timezoneValue, setTimezoneValue] = useState(timezone);
  const [services, setServices] = useState<ServiceDraft[]>(templates.salon);
  const [staffText, setStaffText] = useState("");
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5, 6]);
  const [openTime, setOpenTime] = useState("10:00");
  const [closeTime, setCloseTime] = useState("19:00");
  const [bookingUrl, setBookingUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const staffNames = useMemo(() => staffText.split("\n").map((name) => name.trim()).filter(Boolean), [staffText]);

  useEffect(() => {
    if (!bookingUrl) return;
    void QRCode.toDataURL(bookingUrl, { width: 240, margin: 2, color: { dark: "#292524", light: "#ffffff" } }).then(setQrDataUrl);
  }, [bookingUrl]);

  function setTemplate(type: "salon" | "aesthetic") {
    setSalonType(type);
    setServices(templates[type].map((service) => ({ ...service })));
  }

  function updateService(index: number, key: "name_ka" | "name_en" | "price_gel", value: string) {
    setServices((current) => current.map((service, serviceIndex) => serviceIndex === index
      ? { ...service, [key]: key === "price_gel" ? Number(value) : value } : service));
  }

  async function finishSetup() {
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonName, salonPhone, salonAddress, timezone: timezoneValue, services, staffNames,
          workingDays, openTime, closeTime }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? t("მონაცემების შენახვა ვერ მოხერხდა.", "Could not save setup.")); return; }
      setBookingUrl(new URL(result.bookingUrl, window.location.origin).toString());
      setStep(3);
      router.refresh();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ ხელახლა.", "Network error. Please try again."));
    } finally { setSaving(false); }
  }

  const field = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500";
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:py-14">
      <header className="mb-7 text-center">
        <div className="text-xs font-extrabold uppercase tracking-widest text-rose-600">moarge</div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("მოვამზადოთ თქვენი სალონი", "Set up your salon")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("რამდენიმე ნაბიჯი და მზად იქნებით პირველი ჯავშნისთვის.", "A few quick steps to get ready for your first booking.")}</p>
      </header>
      <div className="mb-6 grid grid-cols-4 gap-2" aria-label={t("მიმდინარეობა", "Progress")}>
        {[0, 1, 2, 3].map((item) => <div key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-rose-600" : "bg-stone-200"}`} />)}
      </div>
      <section className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm sm:p-8">
        {step === 0 && <div className="space-y-4">
          <h2 className="text-lg font-bold">{t("1. სალონის ინფორმაცია", "1. Salon information")}</h2>
          <label className="block text-sm">{t("სალონის სახელი", "Salon name")}<input className={field} value={salonName} onChange={(event) => setSalonName(event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">{t("ტელეფონი", "Phone")}<input className={field} value={salonPhone} onChange={(event) => setSalonPhone(event.target.value)} placeholder="+995 5XX XX XX XX" /></label>
            <label className="block text-sm">{t("დროის სარტყელი", "Time zone")}<input className={field} value={timezoneValue} onChange={(event) => setTimezoneValue(event.target.value)} /></label>
          </div>
          <label className="block text-sm">{t("მისამართი (არასავალდებულო)", "Address (optional)")}<input className={field} value={salonAddress} onChange={(event) => setSalonAddress(event.target.value)} /></label>
        </div>}
        {step === 1 && <div className="space-y-4">
          <h2 className="text-lg font-bold">{t("2. აირჩიეთ სერვისები", "2. Choose your services")}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTemplate("salon")} className={`rounded-xl border px-4 py-2 text-sm ${salonType === "salon" ? "border-rose-600 bg-rose-50" : "border-stone-200"}`}>{t("სალონი", "Salon")}</button>
            <button type="button" onClick={() => setTemplate("aesthetic")} className={`rounded-xl border px-4 py-2 text-sm ${salonType === "aesthetic" ? "border-rose-600 bg-rose-50" : "border-stone-200"}`}>{t("ესთეტიკა", "Aesthetic")}</button>
          </div>
          <div className="space-y-3">{services.map((service, index) => <div key={`${service.category}-${index}`} className="grid gap-2 rounded-2xl border border-stone-100 p-3 sm:grid-cols-[1fr_1fr_100px]">
            <label className="text-xs">{t("სახელი ქართულად", "Name in Georgian")}<input className={field} value={service.name_ka} onChange={(event) => updateService(index, "name_ka", event.target.value)} /></label>
            <label className="text-xs">{t("სახელი ინგლისურად", "Name in English")}<input className={field} value={service.name_en} onChange={(event) => updateService(index, "name_en", event.target.value)} /></label>
            <label className="text-xs">{t("ფასი ₾", "Price GEL")}<input type="number" min="0" className={field} value={service.price_gel} onChange={(event) => updateService(index, "price_gel", event.target.value)} /></label>
          </div>)}</div>
          <button type="button" onClick={() => setServices((current) => [...current, { name_ka: "ახალი სერვისი", name_en: "New service", price_gel: 0, duration_minutes: 45, category: "general" }])} className="text-sm font-semibold text-rose-700">+ {t("სერვისის დამატება", "Add a service")}</button>
        </div>}
        {step === 2 && <div className="space-y-4">
          <h2 className="text-lg font-bold">{t("3. გუნდი და სამუშაო საათები", "3. Staff and working hours")}</h2>
          <label className="block text-sm">{t("სპეციალისტების სახელები, თითო ხაზზე ერთი", "Staff names, one per line")}<textarea className={`${field} min-h-24`} value={staffText} onChange={(event) => setStaffText(event.target.value)} placeholder={t("მაგალითად: ნინო", "For example: Alex")} /></label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-sm">{t("იღება", "Opens")}<input type="time" className={field} value={openTime} onChange={(event) => setOpenTime(event.target.value)} /></label>
            <label className="text-sm">{t("იკეტება", "Closes")}<input type="time" className={field} value={closeTime} onChange={(event) => setCloseTime(event.target.value)} /></label>
          </div>
          <fieldset><legend className="mb-2 text-sm font-medium">{t("სამუშაო დღეები", "Working days")}</legend><div className="flex flex-wrap gap-2">{weekdays.map(([ka, en], index) => <label key={en} className={`rounded-xl border px-3 py-2 text-xs ${workingDays.includes((index + 1) % 7) ? "border-rose-300 bg-rose-50" : "border-stone-200"}`}><input className="mr-1.5 accent-rose-600" type="checkbox" checked={workingDays.includes((index + 1) % 7)} onChange={() => setWorkingDays((current) => current.includes((index + 1) % 7) ? current.filter((day) => day !== (index + 1) % 7) : [...current, (index + 1) % 7])} />{t(ka, en)}</label>)}</div></fieldset>
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{t("ეს საათები გუნდის ყველა წევრს მიენიჭება. მათი შეცვლა მოგვიანებითაც შეგიძლიათ.", "These hours will be applied to every staff member. You can change them later.")}</p>
        </div>}
        {step === 3 && <div className="space-y-5 text-center">
          <div className="text-4xl">✓</div>
          <h2 className="text-xl font-bold">{t("სალონი მზად არის", "Your salon is ready")}</h2>
          <p className="text-sm text-stone-600">{t("გაუზიარეთ ეს ბმული კლიენტებს ონლაინ ჩასაწერად.", "Share this link with clients so they can book online.")}</p>
          <a className="block break-all rounded-xl bg-stone-50 p-3 text-sm text-rose-700 underline" href={bookingUrl}>{bookingUrl}</a>
          {qrDataUrl && <Image className="mx-auto h-52 w-52 rounded-xl border border-stone-100 p-2" src={qrDataUrl} alt={t("ონლაინ ჯავშნის QR კოდი", "Online booking QR code")} width={208} height={208} unoptimized />}
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(bookingUrl); }} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white">{t("ბმულის კოპირება", "Copy booking link")}</button>
          <div><button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold">{t("პანელზე გადასვლა", "Go to dashboard")}</button></div>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {step < 3 && <div className="mt-7 flex justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm disabled:invisible">{t("უკან", "Back")}</button>
          {step < 2 ? <button type="button" onClick={() => setStep((current) => current + 1)} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white">{t("გაგრძელება", "Continue")}</button>
            : <button type="button" disabled={saving || !staffNames.length || !workingDays.length} onClick={finishSetup} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("ინახება...", "Saving...") : t("დასრულება", "Finish setup")}</button>}
        </div>}
      </section>
    </main>
  );
}

