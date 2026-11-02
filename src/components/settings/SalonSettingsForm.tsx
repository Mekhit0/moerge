"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Mail, Send } from "lucide-react";
import { GEORGIAN_DEFAULT_EMAIL_BODY, GEORGIAN_DEFAULT_EMAIL_SUBJECT, useLanguage } from "@/lib/i18n";
import { DEFAULT_EMAIL_BODY_TEMPLATE, DEFAULT_EMAIL_SUBJECT, type SalonSettings } from "@/lib/types";
import { renderReminderEmail } from "@/lib/email-template";
import { isPlaceholderReplyEmail, isValidEmailAddress } from "@/lib/validation";
import { appUrl } from "@/lib/app-url";
import { Alert, Button, Card, CardHeader, Chip, ChipRow, Field, Input, Sheet, Textarea, cn, useToast } from "@/components/ui";

const BRAND_COLORS = ["#e11d48", "#db2777", "#c026d3", "#7c3aed", "#0284c7", "#059669", "#d97706", "#18181b"];
const SLOT_STEPS = [15, 30, 45, 60, 90];
const CANCEL_DEADLINES = [0, 2, 6, 12, 24, 48];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAGS = ["{{client_name}}", "{{salon_name}}", "{{booking_link}}"];

interface Form {
  salon_name: string;
  salon_slug: string;
  salon_address: string;
  salon_phone: string;
  brand_color: string;
  booking_title: string;
  booking_subtitle: string;
  working_hours_start: string;
  working_hours_end: string;
  slot_interval_minutes: number;
  booking_cancel_deadline_hours: number;
  auto_reminders_enabled: boolean;
  reminder_interval_days: number;
  send_booking_confirmation_email: boolean;
  sms_reminder_24h: boolean;
  sms_reminder_2h: boolean;
  sms_booking_confirmation: boolean;
  sender_display_name: string;
  verified_sender_email: string;
  email_subject: string;
  email_body_template: string;
  dry_run_mode: boolean;
  test_recipient_email: string;
}

function fromSettings(settings: SalonSettings & { salon_slug?: string }): Form {
  return {
    salon_name: settings.salon_name ?? "",
    salon_slug: settings.salon_slug ?? "",
    salon_address: settings.salon_address ?? "",
    salon_phone: settings.salon_phone ?? "",
    brand_color: settings.brand_color || "#e11d48",
    booking_title: settings.booking_title ?? "",
    booking_subtitle: settings.booking_subtitle ?? "",
    working_hours_start: (settings.working_hours_start ?? "10:00").slice(0, 5),
    working_hours_end: (settings.working_hours_end ?? "20:00").slice(0, 5),
    slot_interval_minutes: settings.slot_interval_minutes ?? 30,
    booking_cancel_deadline_hours: settings.booking_cancel_deadline_hours ?? 24,
    auto_reminders_enabled: settings.auto_reminders_enabled ?? true,
    reminder_interval_days: settings.reminder_interval_days ?? 21,
    send_booking_confirmation_email: settings.send_booking_confirmation_email ?? true,
    sms_reminder_24h: settings.sms_reminder_24h ?? true,
    sms_reminder_2h: settings.sms_reminder_2h ?? false,
    sms_booking_confirmation: settings.sms_booking_confirmation ?? false,
    sender_display_name: settings.sender_display_name ?? settings.salon_name ?? "",
    verified_sender_email: isPlaceholderReplyEmail(settings.verified_sender_email) ? "" : settings.verified_sender_email ?? "",
    email_subject: settings.email_subject || GEORGIAN_DEFAULT_EMAIL_SUBJECT,
    email_body_template: settings.email_body_template || GEORGIAN_DEFAULT_EMAIL_BODY,
    dry_run_mode: settings.dry_run_mode ?? false,
    test_recipient_email: settings.test_recipient_email ?? "",
  };
}

const FIELD_LABELS: Record<string, { ka: string; en: string }> = {
  salon_name: { ka: "სალონის სახელი", en: "Salon name" },
  salon_slug: { ka: "ჯავშნის ბმული", en: "Booking link" },
  sender_display_name: { ka: "გამგზავნის სახელი", en: "Sender name" },
  verified_sender_email: { ka: "პასუხების ელ-ფოსტა", en: "Reply email" },
  email_subject: { ka: "წერილის სათაური", en: "Email subject" },
  email_body_template: { ka: "წერილის ტექსტი", en: "Email text" },
  test_recipient_email: { ka: "სატესტო ელ-ფოსტა", en: "Test email" },
  reminder_interval_days: { ka: "შეხსენების დღეები", en: "Reminder days" },
};

/**
 * Salon settings on one calm page: the salon, online booking, email reminders and a closed
 * "Advanced" part. Nothing saves until "Save"; the save bar only shows when something changed.
 */
export default function SalonSettingsForm({ initial, sms, emailConfigured, deposit, children }: {
  initial: SalonSettings & { salon_slug?: string };
  /** This month's SMS: what is left of the package's SMS, the package size and bought SMS. smsLive is false before 1 December. */
  sms: { includedLeft: number; included: number; bought: number; smsLive: boolean };
  emailConfigured: boolean;
  /** Kept as stored: deposits are not offered in the app yet. */
  deposit: { deposit_required: boolean; deposit_amount_gel: number | null; deposit_percentage: number | null };
  /** Shown inside "Advanced", e.g. the change log. */
  children?: React.ReactNode;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<Form>(() => fromSettings(initial));
  const [form, setForm] = useState<Form>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const bookingUrl = appUrl(`/book?salon=${encodeURIComponent(saved.salon_slug || "salon")}`);

  // The save bar takes the bottom of the screen; the floating feedback button steps aside meanwhile.
  useEffect(() => {
    if (!dirty) return;
    document.body.dataset.saveBar = "1";
    return () => { delete document.body.dataset.saveBar; };
  }, [dirty]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function problem(): string | null {
    if (form.salon_name.trim().length < 2) return t("ჩაწერეთ სალონის სახელი.", "Enter the salon name.");
    if (form.salon_slug && !SLUG.test(form.salon_slug)) return t("ბმულში გამოიყენეთ ლათინური პატარა ასოები, ციფრები და ტირე.", "Use lowercase Latin letters, numbers and hyphens in the link.");
    if (form.working_hours_end <= form.working_hours_start) return t("დახურვის საათი გახსნის შემდეგ უნდა იყოს.", "Closing time must be after opening time.");
    if (form.auto_reminders_enabled && !isValidEmailAddress(form.verified_sender_email.trim())) {
      return t("შეხსენებებისთვის მიუთითეთ ელ-ფოსტა, სადაც კლიენტების პასუხები მოვა.", "For reminders, enter the email where client replies should arrive.");
    }
    if (form.sender_display_name.trim().length < 2) return t("ჩაწერეთ გამგზავნის სახელი.", "Enter the sender name.");
    if (!/\{\{\s*(client_name|booking_link)\s*\}\}/.test(form.email_body_template)) {
      return t("წერილის ტექსტში დატოვეთ {{client_name}} ან {{booking_link}}.", "Keep {{client_name}} or {{booking_link}} in the email text.");
    }
    if (form.dry_run_mode && form.test_recipient_email && !isValidEmailAddress(form.test_recipient_email.trim())) {
      return t("შეამოწმეთ სატესტო ელ-ფოსტა.", "Check the test email.");
    }
    return null;
  }

  async function save() {
    const found = problem();
    // The save bar is at the bottom; the message also pops up there, not only at the top of the page.
    if (found) { setError(found); toast.error(found); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salon_name: form.salon_name.trim(),
          salon_slug: form.salon_slug.trim() || undefined,
          sender_display_name: form.sender_display_name.trim(),
          // The database still needs an address when reminders are off; keep the stored one then.
          verified_sender_email: form.verified_sender_email.trim() || initial.verified_sender_email,
          test_recipient_email: form.test_recipient_email.trim() || null,
          timezone: "Asia/Tbilisi",
          ...deposit,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const field = data.details ? Object.keys(data.details)[0] : null;
        const label = field && FIELD_LABELS[field];
        const message = typeof data.error === "string" && data.error !== "Validation failed" ? data.error.split(" / ")[lang === "en" ? 1 : 0] ?? data.error : null;
        const text = label ? t(`შეამოწმეთ: ${label.ka}.`, `Check: ${label.en}.`) : message || t("შენახვა ვერ მოხერხდა.", "Could not save.");
        setError(text);
        toast.error(text);
        return;
      }
      const next = { ...form, salon_slug: data.settings?.salon_slug ?? form.salon_slug };
      setSaved(next);
      setForm(next);
      toast.success(t("შენახულია.", "Saved."));
      router.refresh();
    } catch {
      setError(t("ქსელური შეცდომა. სცადეთ თავიდან.", "Network error. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("ვერ დაკოპირდა.", "Could not copy."));
    }
  }

  return (
    <div className={cn("space-y-5", dirty && "pb-24")}>
      <header>
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("სალონის პარამეტრები", "Salon settings")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("სახელი, ონლაინ ჯავშანი და შეხსენებები.", "Name, online booking and reminders.")}</p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader title={t("სალონი", "Salon")} description={t("ჩანს ჯავშნის გვერდზე და წერილებში.", "Shown on the booking page and in emails.")} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("სალონის სახელი", "Salon name")}>
            {(props) => <Input {...props} value={form.salon_name} onChange={(event) => set("salon_name", event.target.value)} maxLength={120} />}
          </Field>
          <Field label={t("ტელეფონი", "Phone")} optionalLabel={t("(არასავალდებულო)", "(optional)")}>
            {(props) => <Input {...props} type="tel" inputMode="tel" value={form.salon_phone} onChange={(event) => set("salon_phone", event.target.value)} maxLength={60} />}
          </Field>
          <Field label={t("მისამართი", "Address")} optionalLabel={t("(არასავალდებულო)", "(optional)")} className="md:col-span-2">
            {(props) => <Input {...props} value={form.salon_address} onChange={(event) => set("salon_address", event.target.value)} maxLength={250} />}
          </Field>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-stone-700">{t("ჯავშნის გვერდის ფერი", "Booking page color")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_COLORS.map((color) => (
              <button key={color} type="button" onClick={() => set("brand_color", color)} aria-label={color} aria-pressed={form.brand_color === color}
                className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 transition", form.brand_color === color && "ring-2 ring-stone-900")}
                style={{ backgroundColor: color }}>
                {form.brand_color === color && <Check className="h-5 w-5 text-white" />}
              </button>
            ))}
            <label className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 px-3 text-sm text-stone-600">
              <input type="color" value={form.brand_color} onChange={(event) => set("brand_color", event.target.value)} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={t("სხვა ფერი", "Other color")} />
              {t("სხვა", "Other")}
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("ონლაინ ჯავშანი", "Online booking")} description={t("როგორ ჯავშნიან კლიენტები თავად.", "How clients book by themselves.")} />
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-stone-700">{t("ჯავშნის ბმული", "Booking link")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-h-12 min-w-0 flex-1 items-center rounded-xl border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-brand/30">
                <span className="shrink-0 pl-4 text-sm text-stone-400">{appUrl("/book?salon=").replace(/^https?:\/\//, "")}</span>
                <input value={form.salon_slug} onChange={(event) => set("salon_slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-base text-stone-900 focus:outline-none" aria-label={t("ჯავშნის ბმული", "Booking link")} maxLength={60} />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-brand" />} onClick={() => void copyLink()}>
                  {copied ? t("დაკოპირდა", "Copied") : t("კოპირება", "Copy")}
                </Button>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 hover:border-rose-300 hover:bg-brand-soft">
                  <ExternalLink className="h-4 w-4 text-brand" />{t("ნახვა", "Open")}
                </a>
              </div>
            </div>
            {form.salon_slug !== saved.salon_slug && <p className="mt-1.5 text-xs text-amber-700">{t("შენახვის შემდეგ ძველი ბმული აღარ იმუშავებს.", "After saving, the old link stops working.")}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
            <Field label={t("იხსნება", "Opens")}>{(props) => <Input {...props} type="time" step={900} value={form.working_hours_start} onChange={(event) => set("working_hours_start", event.target.value)} />}</Field>
            <Field label={t("იკეტება", "Closes")}>{(props) => <Input {...props} type="time" step={900} value={form.working_hours_end} onChange={(event) => set("working_hours_end", event.target.value)} />}</Field>
          </div>
          <p className="-mt-3 text-xs text-stone-500">{t("სპეციალისტების საათები ცალკეა: პარამეტრები › სამუშაო საათები.", "Each specialist's hours are separate: Settings › Working hours.")}</p>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("დროის ნაბიჯი ჯავშნისას", "Time step when booking")}</p>
            <ChipRow>{SLOT_STEPS.map((step) => <Chip key={step} selected={form.slot_interval_minutes === step} onClick={() => set("slot_interval_minutes", step)}>{t(`${step} წთ`, `${step} min`)}</Chip>)}</ChipRow>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("კლიენტს შეუძლია გააუქმოს", "Clients can cancel up to")}</p>
            <ChipRow>{CANCEL_DEADLINES.map((hours) => (
              <Chip key={hours} selected={form.booking_cancel_deadline_hours === hours} onClick={() => set("booking_cancel_deadline_hours", hours)}>
                {hours === 0 ? t("ნებისმიერ დროს", "Any time") : t(`${hours} სთ-ით ადრე`, `${hours} h before`)}
              </Chip>
            ))}</ChipRow>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Field label={t("გვერდის სათაური", "Page heading")}>{(props) => <Input {...props} value={form.booking_title} onChange={(event) => set("booking_title", event.target.value)} maxLength={200} />}</Field>
            <Field label={t("მოკლე ტექსტი კლიენტებისთვის", "Short text for clients")}>{(props) => <Textarea {...props} value={form.booking_subtitle} onChange={(event) => set("booking_subtitle", event.target.value)} maxLength={500} className="min-h-20" />}</Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("SMS შეხსენებები", "SMS reminders")} description={t("კლიენტი იღებს მოკლე SMS-ს ჯავშნის კოდით. ერთი SMS ჩვეულებრივ ერთი შეტყობინებაა.", "Clients get a short SMS with the booking code. One message is usually one SMS.")} />
        {!sms.smsLive
          ? <Alert tone="info" className="mb-4">{t("SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე. ბიზნესში თვეში 1 000 SMS შედის. არჩევანი შეინახება.", "SMS reminders start on 1 December, on paid plans. Business includes 1,000 SMS a month. Your choices are saved.")}{" "}<Link href="/pricing" className="font-semibold underline">{t("ფასები", "Prices")}</Link></Alert>
          : sms.included === 0 && sms.bought === 0 && <Alert tone="info" className="mb-4">{t("SMS შეხსენებები ფასიან პაკეტშია. ბიზნესში თვეში 1 000 SMS შედის.", "SMS reminders come with paid plans. Business includes 1,000 SMS a month.")}{" "}<Link href="/pricing" className="font-semibold underline">{t("ფასები", "Prices")}</Link></Alert>}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">{t("ამ თვეში დარჩა", "Left this month")}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">{sms.includedLeft}<span className="text-sm font-normal text-stone-400"> / {sms.included}</span></p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">{t("ნაყიდი SMS", "Bought SMS")}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-stone-900">{sms.bought}</p>
          </div>
        </div>
        <div className="space-y-4">
          {([
            ["sms_reminder_24h", t("ვიზიტამდე ერთი დღით ადრე", "A day before the visit"), t("ყველაზე სასარგებლო: კლიენტს ახსოვს და დროულად მოდის.", "The most useful one: clients remember and come on time.")],
            ["sms_reminder_2h", t("ვიზიტამდე ორი საათით ადრე", "Two hours before the visit"), t("მეორე შეხსენება იმავე დღეს. დამატებითი SMS.", "A second reminder on the day. One more SMS.")],
            ["sms_booking_confirmation", t("დადასტურება ჯავშნისას", "Confirmation when booking"), t("SMS ჯავშნის კოდით, ჩაწერისთანავე.", "An SMS with the booking code right after booking.")],
          ] as const).map(([key, title, hint]) => (
            <label key={key} className="flex min-h-11 items-center justify-between gap-4">
              <span><span className="block font-semibold text-stone-900">{title}</span><span className="text-sm text-stone-500">{hint}</span></span>
              <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={form[key]} onChange={(event) => set(key, event.target.checked)} />
            </label>
          ))}
          <p className="text-sm text-stone-500">{t("SMS მიდის მხოლოდ იმ კლიენტებთან, ვინც ჯავშნისას SMS შეხსენება აირჩია.", "SMS only go to clients who chose SMS reminders when booking.")}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("ელ-ფოსტით შეხსენებები", "Email reminders")} description={t("კლიენტს ახსენებს, რომ დროა ისევ მოვიდეს.", "Reminds clients it is time to come back.")} />
        {!emailConfigured && <Alert tone="warning" className="mb-4">{t("წერილების გაგზავნა ჯერ არ არის ჩართული. პარამეტრები შეინახება და ჩაირთვება მზადყოფნისას.", "Email sending is not set up yet. Settings are saved and start working once it is.")}</Alert>}
        <div className="space-y-5">
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span><span className="block font-semibold text-stone-900">{t("ავტომატური შეხსენებები", "Automatic reminders")}</span>
              <span className="text-sm text-stone-500">{t("ვიზიტის შემდეგ, მითითებულ დღეებში.", "After a visit, after the set number of days.")}</span></span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={form.auto_reminders_enabled} onChange={(event) => set("auto_reminders_enabled", event.target.checked)} />
          </label>

          {form.auto_reminders_enabled && <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t("რამდენი დღის შემდეგ", "After how many days")} hint={t("თუ სერვისს თავისი ვადა აქვს, ის მოქმედებს.", "A service's own period wins if it has one.")}>
              {(props) => <Input {...props} type="number" inputMode="numeric" min={1} max={365} value={form.reminder_interval_days} onChange={(event) => set("reminder_interval_days", Math.max(1, Math.min(365, Number(event.target.value) || 1)))} />}
            </Field>
            <Field label={t("სად მოვიდეს კლიენტების პასუხები", "Where client replies arrive")} error={!isValidEmailAddress(form.verified_sender_email.trim()) ? t("აუცილებელია შეხსენებებისთვის", "Needed for reminders") : null}>
              {(props) => <Input {...props} type="email" inputMode="email" value={form.verified_sender_email} onChange={(event) => set("verified_sender_email", event.target.value)} placeholder="salon@gmail.com" />}
            </Field>
            <Field label={t("გამგზავნის სახელი", "Sender name")} className="md:col-span-2">
              {(props) => <Input {...props} value={form.sender_display_name} onChange={(event) => set("sender_display_name", event.target.value)} maxLength={120} />}
            </Field>
          </div>}

          <label className="flex min-h-11 items-center justify-between gap-4">
            <span><span className="block font-semibold text-stone-900">{t("დადასტურება ონლაინ ჯავშნისას", "Confirmation for online bookings")}</span>
              <span className="text-sm text-stone-500">{t("წერილი ჯავშნის კოდით, თუ კლიენტმა ელ-ფოსტა მიუთითა.", "An email with the booking code when the client gave an email.")}</span></span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={form.send_booking_confirmation_email} onChange={(event) => set("send_booking_confirmation_email", event.target.checked)} />
          </label>

          <Button variant="secondary" icon={<Mail className="h-4 w-4 text-brand" />} onClick={() => setEmailOpen(true)}>{t("წერილის ტექსტი და ნიმუში", "Email text and preview")}</Button>
        </div>
      </Card>

      <details className="group rounded-2xl border border-stone-200/80 bg-white shadow-xs">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-stone-900">
          {t("დამატებითი", "Advanced")}<span className="text-sm font-normal text-stone-400 group-open:hidden">{t("გახსნა", "Open")}</span>
        </summary>
        <div className="space-y-5 border-t border-stone-100 p-5">
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span><span className="block font-semibold text-stone-900">{t("სატესტო რეჟიმი", "Test mode")}</span>
              <span className="text-sm text-stone-500">{t("შეხსენებები კლიენტებს არ გაეგზავნება. გამოსადეგია მოსინჯვისთვის.", "Reminders are not sent to clients. Useful while trying things out.")}</span></span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={form.dry_run_mode} onChange={(event) => set("dry_run_mode", event.target.checked)} />
          </label>
          {form.dry_run_mode && <Field label={t("სატესტო ელ-ფოსტა", "Test email")} optionalLabel={t("(არასავალდებულო)", "(optional)")} hint={t("თუ მიუთითებთ, წერილები აქ მოვა.", "If set, emails arrive here instead.")}>
            {(props) => <Input {...props} type="email" value={form.test_recipient_email} onChange={(event) => set("test_recipient_email", event.target.value)} />}
          </Field>}
          {children}
        </div>
      </details>

      <EmailSheet open={emailOpen} form={form} bookingUrl={bookingUrl} onClose={() => setEmailOpen(false)}
        onChange={(subject, body) => setForm((current) => ({ ...current, email_subject: subject, email_body_template: body }))} />

      {dirty && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-700">{t("გაქვთ შეუნახავი ცვლილებები", "You have unsaved changes")}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setForm(saved); setError(null); }}>{t("გაუქმება", "Discard")}</Button>
              <Button loading={saving} onClick={() => void save()}>{t("შენახვა", "Save")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Edit the reminder email with insertable tags, see it as the client will, and send a test. */
function EmailSheet({ open, form, bookingUrl, onClose, onChange }: {
  open: boolean;
  form: Form;
  bookingUrl: string;
  onClose: () => void;
  onChange: (subject: string, body: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [testTo, setTestTo] = useState(form.verified_sender_email);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(() => renderReminderEmail({
    clientName: lang === "ka" ? "ნინო ბერიძე" : "Nino Beridze",
    salonName: form.salon_name || "Salon",
    bookingUrl,
    subjectTemplate: form.email_subject,
    bodyTemplate: form.email_body_template,
    brandColor: form.brand_color,
    unsubscribeUrl: appUrl("/unsubscribe?token=preview"),
  }), [lang, form.salon_name, bookingUrl, form.email_subject, form.email_body_template, form.brand_color]);

  function insertTag(tag: string) {
    const area = textareaRef.current;
    const body = form.email_body_template;
    const at = area ? area.selectionStart : body.length;
    onChange(form.email_subject, `${body.slice(0, at)}${tag}${body.slice(area ? area.selectionEnd : at)}`);
  }

  async function sendTest() {
    if (!isValidEmailAddress(testTo.trim())) { setResult({ ok: false, text: t("შეამოწმეთ ელ-ფოსტა.", "Check the email.") }); return; }
    setSending(true);
    setResult(null);
    const response = await fetch("/api/settings/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_email: testTo.trim(), sender_display_name: form.sender_display_name, salon_name: form.salon_name, email_subject: form.email_subject, email_body_template: form.email_body_template }),
    }).catch(() => null);
    setSending(false);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) { setResult({ ok: false, text: String(data.error ?? t("ვერ გაიგზავნა.", "Could not send.")) }); return; }
    setResult({ ok: true, text: data.mode === "live_resend" ? t(`გაიგზავნა: ${data.recipient}`, `Sent to ${data.recipient}`) : t("სატესტო რეჟიმი ჩართულია, წერილი არ გაიგზავნა.", "Test mode is on, so nothing was sent.") });
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("შეხსენების წერილი", "Reminder email")} footer={<Button size="lg" block onClick={onClose}>{t("მზადაა", "Done")}</Button>}>
      <div className="space-y-5">
        <ChipRow>
          <Chip selected={view === "edit"} onClick={() => setView("edit")}>{t("ტექსტი", "Text")}</Chip>
          <Chip selected={view === "preview"} onClick={() => setView("preview")}>{t("როგორ ჩანს", "How it looks")}</Chip>
        </ChipRow>
        {view === "edit" ? <>
          <Field label={t("სათაური", "Subject")}>{(props) => <Input {...props} value={form.email_subject} onChange={(event) => onChange(event.target.value, form.email_body_template)} maxLength={200} />}</Field>
          <div>
            <label htmlFor="reminder-body" className="mb-1.5 block text-sm font-semibold text-stone-700">{t("ტექსტი", "Text")}</label>
            <Textarea id="reminder-body" ref={textareaRef} value={form.email_body_template} onChange={(event) => onChange(form.email_subject, event.target.value)} maxLength={5000} className="min-h-56" />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              {t("ჩასმა:", "Insert:")}
              {TAGS.map((tag) => <button key={tag} type="button" onClick={() => insertTag(tag)} className="min-h-9 rounded-lg border border-stone-200 px-2 font-mono text-stone-700 hover:bg-brand-soft">{tag}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onChange(GEORGIAN_DEFAULT_EMAIL_SUBJECT, GEORGIAN_DEFAULT_EMAIL_BODY)}>{t("ქართული ნიმუში", "Georgian sample")}</Button>
            <Button variant="ghost" onClick={() => onChange(DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY_TEMPLATE)}>{t("ინგლისური ნიმუში", "English sample")}</Button>
          </div>
        </> : <>
          <p className="text-sm text-stone-600"><span className="text-stone-400">{t("სათაური:", "Subject:")}</span> <strong>{preview.subject}</strong></p>
          <iframe title={t("წერილის ნიმუში", "Email preview")} srcDoc={preview.html} sandbox="" className="h-[420px] w-full rounded-2xl border border-stone-200 bg-white" />
        </>}
        <div className="rounded-2xl bg-stone-50 p-4">
          <p className="mb-2 text-sm font-semibold text-stone-700">{t("სატესტო წერილი", "Send a test")}</p>
          <div className="flex gap-2">
            <Input type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@gmail.com" aria-label={t("სატესტო ელ-ფოსტა", "Test email")} />
            <Button loading={sending} icon={<Send className="h-4 w-4" />} onClick={() => void sendTest()}>{t("გაგზავნა", "Send")}</Button>
          </div>
          {result && <p className={cn("mt-2 text-sm", result.ok ? "text-emerald-700" : "text-red-700")}>{result.text}</p>}
        </div>
      </div>
    </Sheet>
  );
}
