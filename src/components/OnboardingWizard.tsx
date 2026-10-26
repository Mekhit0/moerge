"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { BILLING_CONFIG } from "@/lib/billing-plans";

type ServiceDraft = {
  id: string;
  name: string;
  priceGel: number;
  durationMinutes: number;
  category: string;
};

type StaffDraft = {
  id: string;
  name: string;
  serviceIds: string[];
  workingDays: number[];
  openTime: string;
  closeTime: string;
};

const templates: Record<"salon" | "aesthetic", ServiceDraft[]> = {
  salon: [
    { id: "haircut", name: "თმის შეჭრა", priceGel: 35, durationMinutes: 45, category: "hair" },
    { id: "manicure", name: "მანიკური", priceGel: 40, durationMinutes: 60, category: "nails" },
    { id: "facial-care", name: "სახის მოვლა", priceGel: 70, durationMinutes: 60, category: "skin" },
    { id: "consultation", name: "კონსულტაცია", priceGel: 0, durationMinutes: 30, category: "consultation" },
  ],
  aesthetic: [
    { id: "skin-consultation", name: "კანის კონსულტაცია", priceGel: 0, durationMinutes: 30, category: "consultation" },
    { id: "facial-cleaning", name: "სახის წმენდა", priceGel: 90, durationMinutes: 75, category: "facial" },
    { id: "laser", name: "ლაზერული პროცედურა", priceGel: 80, durationMinutes: 45, category: "laser" },
    { id: "massage", name: "მასაჟი", priceGel: 100, durationMinutes: 60, category: "massage" },
  ],
};

const weekdays = [
  ["ორშაბათი", "Monday"], ["სამშაბათი", "Tuesday"], ["ოთხშაბათი", "Wednesday"],
  ["ხუთშაბათი", "Thursday"], ["პარასკევი", "Friday"], ["შაბათი", "Saturday"], ["კვირა", "Sunday"],
];

const MAX_TRIAL_STAFF = BILLING_CONFIG.plans.business.staffIncluded;

export default function OnboardingWizard({ initialName, initialPhone = "", initialAddress = "", slug }: {
  initialName: string; initialPhone?: string; initialAddress?: string; slug: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [salonType, setSalonType] = useState<"salon" | "aesthetic">("salon");
  const [salonName, setSalonName] = useState(initialName);
  const [salonPhone, setSalonPhone] = useState(initialPhone);
  const [salonAddress, setSalonAddress] = useState(initialAddress);
  const [services, setServices] = useState<ServiceDraft[]>(() => templates.salon.map((service) => ({ ...service })));
  const [staffMembers, setStaffMembers] = useState<StaffDraft[]>([{ id: "specialist-1", name: "", serviceIds: [], workingDays: [1, 2, 3, 4, 5, 6], openTime: "10:00", closeTime: "19:00" }]);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30);
  const [bookingUrl, setBookingUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bookingUrl) return;
    void QRCode.toDataURL(bookingUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#292524", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [bookingUrl]);

  function setTemplate(type: "salon" | "aesthetic") {
    setSalonType(type);
    setServices(templates[type].map((service) => ({ ...service })));
    setStaffMembers((current) => current.map((staff) => ({ ...staff, serviceIds: [] })));
    setError(null);
  }

  function updateService(index: number, key: "name" | "priceGel" | "durationMinutes", value: string) {
    setServices((current) => current.map((service, serviceIndex) => {
      if (serviceIndex !== index) return service;
      return { ...service, [key]: key === "name" ? value : Number(value) };
    }));
  }

  function updateStaffName(id: string, value: string) {
    setStaffMembers((current) => current.map((staff) => staff.id === id ? { ...staff, name: value } : staff));
  }

  function updateStaff(id: string, update: Partial<StaffDraft>) {
    setStaffMembers((current) => current.map((staff) => staff.id === id ? { ...staff, ...update } : staff));
  }

  function continueToNextStep() {
    setError(null);

    if (step === 0) {
      if (salonName.trim().length < 2) {
        setError(t("სალონის სახელი მინიმუმ 2 სიმბოლო უნდა იყოს.", "Enter a salon name with at least 2 characters."));
        return;
      }
      if (salonPhone.replace(/\D/g, "").length < 7) {
        setError(t("მიუთითეთ სწორი საკონტაქტო ტელეფონი.", "Enter a valid contact phone number."));
        return;
      }
    }

    if (step === 1) {
      if (services.length === 0) {
        setError(t("დაამატეთ მინიმუმ ერთი სერვისი.", "Add at least one service."));
        return;
      }
      if (services.some((service) => service.name.trim().length < 2)) {
        setError(t("თითოეულ სერვისს მიუთითეთ სახელი.", "Enter a name for each service."));
        return;
      }
      if (services.some((service) => !Number.isFinite(service.priceGel) || service.priceGel < 0 || service.priceGel > 10000)) {
        setError(t("შეამოწმეთ სერვისების ფასები.", "Check the service prices."));
        return;
      }
      if (services.some((service) => !Number.isInteger(service.durationMinutes) || service.durationMinutes < 5 || service.durationMinutes > 720)) {
        setError(t("სერვისის ხანგრძლივობა უნდა იყოს 5-დან 720 წუთამდე.", "Service duration must be between 5 and 720 minutes."));
        return;
      }
      const serviceNames = services.map((service) => service.name.trim().toLocaleLowerCase());
      if (new Set(serviceNames).size !== serviceNames.length) {
        setError(t("სერვისის სახელები არ უნდა მეორდებოდეს.", "Service names must be unique."));
        return;
      }
    }

    setStep((current) => current + 1);
  }

  async function finishSetup() {
    setError(null);
    const cleanedStaff = staffMembers.map((staff) => ({ ...staff, name: staff.name.trim() }));
    if (cleanedStaff.length === 0) {
      setError(t("დაამატეთ მინიმუმ ერთი სპეციალისტი.", "Add at least one specialist."));
      return;
    }
    if (cleanedStaff.some((staff) => staff.name.length < 2)) {
      setError(t("სპეციალისტის სახელი მინიმუმ 2 სიმბოლო უნდა იყოს.", "Specialist names must be at least 2 characters."));
      return;
    }
    if (cleanedStaff.length > MAX_TRIAL_STAFF) {
      setError(t(`საცდელ გეგმაში მაქსიმუმ ${MAX_TRIAL_STAFF} სპეციალისტის დამატებაა შესაძლებელი.`, `The trial plan includes up to ${MAX_TRIAL_STAFF} specialists.`));
      return;
    }
    if (new Set(cleanedStaff.map((staff) => staff.name.toLocaleLowerCase())).size !== cleanedStaff.length) {
      setError(t("სპეციალისტის სახელები არ უნდა მეორდებოდეს.", "Specialist names must be unique."));
      return;
    }
    if (cleanedStaff.some((staff) => staff.serviceIds.length === 0)) {
      setError(t("თითოეულ სპეციალისტს მინიმუმ ერთი სერვისი მიუთითეთ.", "Assign at least one service to each specialist."));
      return;
    }
    if (cleanedStaff.some((staff) => staff.workingDays.length === 0)) {
      setError(t("თითოეულ სპეციალისტს მინიმუმ ერთი სამუშაო დღე მიუთითეთ.", "Select at least one working day for each specialist."));
      return;
    }
    if (cleanedStaff.some((staff) => staff.closeTime <= staff.openTime)) {
      setError(t("თითოეული სპეციალისტისთვის დახურვის დრო გახსნის დროზე გვიან უნდა იყოს.", "For each specialist, closing time must be after opening time."));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonName,
          salonPhone,
          salonAddress,
          services: services.map((service) => ({
            name_ka: service.name.trim(),
            price_gel: service.priceGel,
            duration_minutes: service.durationMinutes,
            category: service.category,
          })),
          staff: cleanedStaff.map((staff) => ({
            full_name: staff.name,
            serviceIndexes: staff.serviceIds.map((id) => services.findIndex((service) => service.id === id)),
            workingDays: staff.workingDays,
            openTime: staff.openTime,
            closeTime: staff.closeTime,
          })),
          slotIntervalMinutes,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? t("მონაცემების შენახვა ვერ მოხერხდა. სცადეთ ხელახლა.", "Could not save setup. Please try again."));
        return;
      }
      setBookingUrl(new URL(result.bookingUrl, window.location.origin).toString());
      setStep(3);
    } catch {
      setError(t("ქსელური შეცდომა. შეამოწმეთ კავშირი და სცადეთ ხელახლა.", "Network error. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100";
  const steps = [t("სალონი", "Salon"), t("სერვისები", "Services"), t("გუნდი და გრაფიკი", "Team & hours")];

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:py-14">
      <header className="mb-7 text-center">
        <div className="text-xs font-extrabold uppercase tracking-widest text-rose-600">moarge</div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("მოვამზადოთ თქვენი სალონი", "Set up your salon")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("შეავსეთ ძირითადი ინფორმაცია. დეტალების შეცვლა მოგვიანებითაც შეგიძლიათ.", "Add the essentials. You can update these details later.")}</p>
      </header>

      {step < 3 && <nav className="mb-6 grid grid-cols-3 gap-2" aria-label={t("მომზადების ეტაპები", "Setup steps")}>
        {steps.map((label, index) => <div key={label} aria-current={step === index ? "step" : undefined} className="space-y-2">
          <div className={`h-1.5 rounded-full ${index <= step ? "bg-rose-600" : "bg-stone-200"}`} />
          <p className={`text-center text-[11px] font-medium ${index === step ? "text-rose-700" : "text-stone-400"}`}>{index + 1}. {label}</p>
        </div>)}
      </nav>}

      <section className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm sm:p-8">
        {step === 0 && <div className="space-y-5">
        <div>
            <h2 className="text-lg font-bold">{t("სალონის ინფორმაცია", "Salon information")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("ეს ინფორმაცია ჯავშნის გვერდზეც გამოჩნდება.", "This information will also appear on your booking page.")}</p>
          </div>
          <label className="block text-sm font-medium">{t("სალონის სახელი", "Salon name")} *
            <input required maxLength={120} autoComplete="organization" className={field} value={salonName} onChange={(event) => setSalonName(event.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">{t("საკონტაქტო ტელეფონი", "Contact phone")} *
              <input required type="tel" autoComplete="tel" className={field} value={salonPhone} onChange={(event) => setSalonPhone(event.target.value)} placeholder="+995 5XX XX XX XX" />
            </label>
            <div className="text-sm font-medium">
              <span>{t("დროის სარტყელი", "Time zone")}</span>
              <div className="mt-1 flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700" aria-label={t("საქართველო, დროის სარტყელი Asia/Tbilisi", "Georgia, time zone Asia/Tbilisi")}>
                <span aria-hidden="true">🇬🇪</span><span>{t("საქართველო", "Georgia")}</span><span className="text-stone-400">(Asia/Tbilisi)</span>
              </div>
            </div>
          </div>
          <label className="block text-sm font-medium">{t("მისამართი", "Address")} <span className="font-normal text-stone-400">({t("არასავალდებულო", "optional")})</span>
            <input maxLength={240} autoComplete="street-address" className={field} value={salonAddress} onChange={(event) => setSalonAddress(event.target.value)} placeholder={t("ქალაქი, ქუჩა და ნომერი", "City, street and number")} />
          </label>
        </div>}

        {step === 1 && <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold">{t("სერვისები და ფასები", "Services and prices")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("სერვისის სახელი ერთხელ შეიყვანეთ. moarge ამ სახელს ორივე ენაზე გამოიყენებს.", "Enter each service name once. moarge will use that name in both languages.")}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("სერვისების შაბლონი", "Service template")}>
            <button type="button" aria-pressed={salonType === "salon"} onClick={() => setTemplate("salon")} className={`rounded-xl border px-4 py-2 text-sm font-medium ${salonType === "salon" ? "border-rose-400 bg-rose-50 text-rose-800" : "border-stone-200 text-stone-600"}`}>{t("სილამაზის სალონი", "Beauty salon")}</button>
            <button type="button" aria-pressed={salonType === "aesthetic"} onClick={() => setTemplate("aesthetic")} className={`rounded-xl border px-4 py-2 text-sm font-medium ${salonType === "aesthetic" ? "border-rose-400 bg-rose-50 text-rose-800" : "border-stone-200 text-stone-600"}`}>{t("ესთეტიკური ცენტრი", "Aesthetic center")}</button>
          </div>

          <div className="space-y-3">
            {services.map((service, index) => <fieldset key={service.id} className="rounded-2xl border border-stone-200 p-4">
              <legend className="px-1 text-xs font-semibold text-stone-500">{t("სერვისი", "Service")} {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_150px_auto] sm:items-end">
                <label className="text-xs font-medium text-stone-600">{t("სახელი ქართულად", "Name in Georgian")} *
                  <input required maxLength={100} className={field} value={service.name} onChange={(event) => updateService(index, "name", event.target.value)} placeholder={t("მაგალითად, მანიკური", "For example, manicure")} />
                </label>
                <label className="text-xs font-medium text-stone-600">{t("ფასი (₾)", "Price (GEL)")} *
                  <input required type="number" min="0" max="10000" step="0.01" className={field} value={service.priceGel} onChange={(event) => updateService(index, "priceGel", event.target.value)} />
                </label>
                <label className="text-xs font-medium text-stone-600">{t("ხანგრძლივობა (წუთი)", "Duration (minutes)")} *
                  <input required type="number" min="5" max="720" step="5" className={field} value={service.durationMinutes} onChange={(event) => updateService(index, "durationMinutes", event.target.value)} />
                </label>
                <button type="button" disabled={services.length === 1} onClick={() => {
                  setServices((current) => current.filter((_, serviceIndex) => serviceIndex !== index));
                  setStaffMembers((current) => current.map((staff) => ({ ...staff, serviceIds: staff.serviceIds.filter((id) => id !== service.id) })));
                }} aria-label={t(`${service.name || "სერვისი"} წაშლა`, `Remove ${service.name || "service"}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-3 text-stone-500 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </fieldset>)}
          </div>
          <button type="button" disabled={services.length >= 30} onClick={() => setServices((current) => [...current, { id: globalThis.crypto.randomUUID(), name: "", priceGel: 0, durationMinutes: 30, category: "general" }])} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" />{t("სერვისის დამატება", "Add service")}
          </button>
        </div>}

        {step === 2 && <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold">{t("სპეციალისტები, სერვისები და გრაფიკი", "Specialists, services and schedules")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("თითოეულ სპეციალისტთან მონიშნეთ მის მიერ შესრულებული სერვისები, სამუშაო დღეები და საათები.", "For each specialist, choose their services, working days and hours.")}</p>
          </div>
          <div className="space-y-3">
            {staffMembers.map((staff, index) => <fieldset key={staff.id} className="space-y-4 rounded-2xl border border-stone-200 p-4">
              <legend className="px-1 text-xs font-semibold text-stone-500">{t("სპეციალისტი", "Specialist")} {index + 1}</legend>
              <div className="flex gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-stone-600">{t("სახელი და გვარი", "Full name")} *
                  <input required minLength={2} maxLength={120} autoComplete="off" className={field} value={staff.name} onChange={(event) => updateStaffName(staff.id, event.target.value)} placeholder={t("მაგალითად, ნინო ბერიძე", "For example, Alex Smith")} />
                </label>
                <button type="button" disabled={staffMembers.length === 1} onClick={() => setStaffMembers((current) => current.filter((member) => member.id !== staff.id))} aria-label={t(`${staff.name || `სპეციალისტი ${index + 1}`} წაშლა`, `Remove ${staff.name || `specialist ${index + 1}`}`)} className="mt-4 inline-flex min-h-11 items-center justify-center self-end rounded-xl border border-stone-200 px-3 text-stone-500 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-stone-600">{t("რომელ სერვისებს ასრულებს?", "Which services can they perform?")} *</legend>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => {
                    const checked = staff.serviceIds.includes(service.id);
                    return <label key={service.id} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${checked ? "border-rose-300 bg-rose-50 text-rose-800" : "border-stone-200 text-stone-600"}`}>
                      <input className="mr-1.5 accent-rose-600" type="checkbox" checked={checked} onChange={() => updateStaff(staff.id, { serviceIds: checked ? staff.serviceIds.filter((id) => id !== service.id) : [...staff.serviceIds, service.id] })} />
                      {service.name || t("უსახელო სერვისი", "Unnamed service")}
                    </label>;
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-stone-600">{t("სამუშაო დღეები", "Working days")} *</legend>
                <div className="flex flex-wrap gap-2">
                  {weekdays.map(([ka, en], dayIndex) => {
                    const day = (dayIndex + 1) % 7;
                    const checked = staff.workingDays.includes(day);
                    return <label key={en} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs ${checked ? "border-rose-300 bg-rose-50" : "border-stone-200"}`}>
                      <input className="mr-1.5 accent-rose-600" type="checkbox" checked={checked} onChange={() => updateStaff(staff.id, { workingDays: checked ? staff.workingDays.filter((item) => item !== day) : [...staff.workingDays, day] })} />{t(ka, en)}
                    </label>;
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-stone-600">{t("სამუშაოს დაწყება", "Starts at")}
                  <input type="time" className={field} value={staff.openTime} onChange={(event) => updateStaff(staff.id, { openTime: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-stone-600">{t("სამუშაოს დასრულება", "Ends at")}
                  <input type="time" className={field} value={staff.closeTime} onChange={(event) => updateStaff(staff.id, { closeTime: event.target.value })} />
                </label>
              </div>
            </fieldset>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={staffMembers.length >= MAX_TRIAL_STAFF} onClick={() => setStaffMembers((current) => [...current, { id: globalThis.crypto.randomUUID(), name: "", serviceIds: [], workingDays: [1, 2, 3, 4, 5, 6], openTime: "10:00", closeTime: "19:00" }])} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" />{t("სპეციალისტის დამატება", "Add specialist")}
            </button>
            <span className="text-xs text-stone-500">{t(`საცდელ გეგმაში მაქსიმუმ ${MAX_TRIAL_STAFF} სპეციალისტია.`, `Up to ${MAX_TRIAL_STAFF} specialists on the trial plan.`)}</span>
          </div>

          <label className="block text-sm font-medium">{t("ჯავშნის ინტერვალი", "Booking interval")}
              <select className={field} value={slotIntervalMinutes} onChange={(event) => setSlotIntervalMinutes(Number(event.target.value))}>
                <option value={15}>15 {t("წუთი", "minutes")}</option>
                <option value={30}>30 {t("წუთი", "minutes")}</option>
                <option value={60}>60 {t("წუთი", "minutes")}</option>
              </select>
          </label>
        </div>}

        {step === 3 && <div className="space-y-5 text-center">
          <div className="text-4xl text-emerald-600" aria-hidden="true">✓</div>
          <h2 className="text-xl font-bold">{t("სალონი მზად არის", "Your salon is ready")}</h2>
          <p className="text-sm text-stone-600">{t("გაუზიარეთ ეს ბმული კლიენტებს ონლაინ ჩასაწერად.", "Share this link with clients so they can book online.")}</p>
          <a className="block break-all rounded-xl bg-stone-50 p-3 text-sm text-rose-700 underline" href={bookingUrl}>{bookingUrl}</a>
          {qrDataUrl && <Image className="mx-auto h-52 w-52 rounded-xl border border-stone-100 p-2" src={qrDataUrl} alt={t("ონლაინ ჯავშნის QR კოდი", "Online booking QR code")} width={208} height={208} unoptimized />}
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(bookingUrl); }} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white">{t("ბმულის კოპირება", "Copy booking link")}</button>
          <div><button type="button" onClick={() => router.push("/dashboard")} className="rounded-xl border border-stone-200 px-5 py-3 text-sm font-semibold">{t("პანელზე გადასვლა", "Go to dashboard")}</button></div>
        </div>}

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {step < 3 && <div className="mt-7 flex justify-between gap-3 border-t border-stone-100 pt-5">
          <button type="button" disabled={step === 0 || saving} onClick={() => { setError(null); setStep((current) => current - 1); }} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm disabled:invisible">{t("უკან", "Back")}</button>
          {step < 2
            ? <button type="button" onClick={continueToNextStep} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white">{t("გაგრძელება", "Continue")}</button>
            : <button type="button" disabled={saving} onClick={finishSetup} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("ინახება...", "Saving...") : t("დასრულება", "Finish setup")}</button>}
        </div>}
      </section>
    </main>
  );
}
