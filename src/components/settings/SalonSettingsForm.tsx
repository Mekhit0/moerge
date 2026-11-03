"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import { GEORGIAN_DEFAULT_EMAIL_BODY, GEORGIAN_DEFAULT_EMAIL_SUBJECT, useLanguage } from "@/lib/i18n";
import type { SalonSettings } from "@/lib/types";
import { isPlaceholderReplyEmail } from "@/lib/validation";
import { appUrl } from "@/lib/app-url";
import { Alert, Button, Card, CardHeader, Chip, ChipRow, Field, Input, Textarea, cn, useToast } from "@/components/ui";

const BRAND_COLORS = ["#e11d48", "#db2777", "#c026d3", "#7c3aed", "#0284c7", "#059669", "#d97706", "#18181b"];
const SLOT_STEPS = [15, 30, 45, 60, 90];
const CANCEL_DEADLINES = [0, 2, 6, 12, 24, 48];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
 * Salon settings on one calm page: the salon, online booking and a closed
 * "Advanced" part. Nothing saves until "Save"; the save bar only shows when something changed.
 */
export default function SalonSettingsForm({ initial, deposit, children }: {
  initial: SalonSettings & { salon_slug?: string };
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
        <p className="mt-1 text-sm text-stone-500">{t("სახელი და ონლაინ ჯავშანი. SMS შეხსენებები ცალკე გვერდზეა.", "Name and online booking. SMS reminders have their own page.")}</p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <CardHeader title={t("სალონი", "Salon")} description={t("ჩანს ჯავშნის გვერდზე და SMS-ში.", "Shown on the booking page and in SMS.")} />
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
            <p className="mt-2 text-xs text-stone-500">{t(`რა ინტერვალით ხედავს კლიენტი თავისუფალ დროებს ონლაინ: მაგ. 30 წთ-ზე 10:00, 10:30, 11:00. კალენდარში თქვენ ნებისმიერ 15 წუთზე წერთ.`, `How far apart clients see free times online: with 30 min, 10:00, 10:30, 11:00. In the calendar you can book any quarter hour.`)}</p>
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

      <details className="group rounded-2xl border border-stone-200/80 bg-white shadow-xs">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 font-semibold text-stone-900">
          {t("დამატებითი", "Advanced")}<span className="text-sm font-normal text-stone-400 group-open:hidden">{t("გახსნა", "Open")}</span>
        </summary>
        <div className="space-y-5 border-t border-stone-100 p-5">
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span><span className="block font-semibold text-stone-900">{t("სატესტო რეჟიმი", "Test mode")}</span>
              <span className="text-sm text-stone-500">{t("SMS კლიენტებს არ გაეგზავნება. გამოსადეგია მოსინჯვისთვის.", "SMS are not sent to clients. Useful while trying things out.")}</span></span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={form.dry_run_mode} onChange={(event) => set("dry_run_mode", event.target.checked)} />
          </label>
          {children}
        </div>
      </details>

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
