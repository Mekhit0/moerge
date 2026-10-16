"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Globe,
  Plus,
  Trash2,
  Sparkles,
  Send,
  KeyRound,
  ExternalLink,
  Clock,
  MapPin,
  Phone,
  LayoutTemplate,
  Lock,
  Copy,
  Check,
} from "lucide-react";
import {
  CustomBookingService,
  DEFAULT_CUSTOM_SERVICES,
  DEFAULT_EMAIL_BODY_TEMPLATE,
  DEFAULT_EMAIL_SUBJECT,
  SalonSettings,
  TreatmentType,
  SERVICE_PRESET_TEMPLATES,
  ServiceTemplatePreset,
} from "@/lib/types";
import { renderReminderEmail } from "@/lib/email-template";
import {
  GEORGIAN_DEFAULT_EMAIL_BODY,
  GEORGIAN_DEFAULT_EMAIL_SUBJECT,
  TREATMENT_LABELS_I18N,
  getTreatmentLabel,
  useLanguage,
} from "@/lib/i18n";

interface SettingsManagerProps {
  initialSettings: SalonSettings & {
    has_custom_resend_key?: boolean;
    salon_slug?: string;
  };
  resendConfigured: boolean;
  webhookSecretConfigured: boolean;
}

const COMMON_TIMEZONES = [
  "Asia/Tbilisi",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "UTC",
];

const WORK_HOUR_OPTIONS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export default function SettingsManager({
  initialSettings,
  resendConfigured,
  webhookSecretConfigured,
}: SettingsManagerProps) {
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [salonName, setSalonName] = useState(initialSettings.salon_name);
  const [senderDisplayName, setSenderDisplayName] = useState(
    initialSettings.sender_display_name
  );
  const [verifiedSenderEmail, setVerifiedSenderEmail] = useState(
    initialSettings.verified_sender_email
  );
  const [timezone, setTimezone] = useState(
    initialSettings.timezone || "Asia/Tbilisi"
  );
  const [reminderIntervalDays, setReminderIntervalDays] = useState(
    initialSettings.reminder_interval_days || 21
  );
  const [emailSubject, setEmailSubject] = useState(
    initialSettings.email_subject || DEFAULT_EMAIL_SUBJECT
  );
  const [emailBodyTemplate, setEmailBodyTemplate] = useState(
    initialSettings.email_body_template || DEFAULT_EMAIL_BODY_TEMPLATE
  );
  const [bookingUrl, setBookingUrl] = useState(initialSettings.booking_url);
  const [brandColor, setBrandColor] = useState(
    initialSettings.brand_color || "#e11d48"
  );
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(
    initialSettings.auto_reminders_enabled
  );
  const [dryRunMode, setDryRunMode] = useState(initialSettings.dry_run_mode);
  const [testRecipientEmail, setTestRecipientEmail] = useState(
    initialSettings.test_recipient_email ?? ""
  );

  // Online Booking Customizer State
  const [bookingTitle, setBookingTitle] = useState(
    initialSettings.booking_title ||
      "დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online"
  );
  const [bookingSubtitle, setBookingSubtitle] = useState(
    initialSettings.booking_subtitle ||
      "აირჩიეთ სასურველი პროცედურა, შეამოწმეთ თავისუფალი საათები რეალურ დროში და მიიღეთ ავტომატური 21-დღიანი შეხსენება."
  );
  const [salonAddress, setSalonAddress] = useState(
    initialSettings.salon_address || "თბილისი, ჭავჭავაძის გამზ. 34"
  );
  const [salonPhone, setSalonPhone] = useState(
    initialSettings.salon_phone || "+995 555 00 11 22"
  );
  const [workingHoursStart, setWorkingHoursStart] = useState(
    initialSettings.working_hours_start || "10:00"
  );
  const [workingHoursEnd, setWorkingHoursEnd] = useState(
    initialSettings.working_hours_end || "20:00"
  );
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(
    initialSettings.slot_interval_minutes || 60
  );
  const [customServices, setCustomServices] = useState<CustomBookingService[]>(
    Array.isArray(initialSettings.custom_services)
      ? initialSettings.custom_services
      : []
  );

  // Resend API & Booking Confirmation State
  const [resendApiKey, setResendApiKey] = useState(
    initialSettings.resend_api_key ?? ""
  );
  const [sendBookingConfirmationEmail, setSendBookingConfirmationEmail] =
    useState(initialSettings.send_booking_confirmation_email ?? true);

  // Live Test Email State
  const [liveTestEmailTo, setLiveTestEmailTo] = useState(
    initialSettings.test_recipient_email || ""
  );
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isResendActive = Boolean(
    resendConfigured ||
      (resendApiKey && resendApiKey.trim().length > 5) ||
      initialSettings.has_custom_resend_key
  );

  const [copiedBookingUrl, setCopiedBookingUrl] = useState(false);

  const effectiveBookingUrl = useMemo(() => {
    const slug =
      initialSettings.salon_slug ||
      (initialSettings.booking_url?.includes("salon=")
        ? initialSettings.booking_url.split("salon=")[1]?.split("&")[0]
        : "lumiere-studio");

    if (typeof window !== "undefined") {
      return `${window.location.origin}/book?salon=${slug}`;
    }
    return (
      initialSettings.booking_url ||
      `https://moerge.vercel.app/book?salon=${slug}`
    );
  }, [initialSettings.salon_slug, initialSettings.booking_url]);

  function handleCopyBookingUrl() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveBookingUrl);
      setCopiedBookingUrl(true);
      setTimeout(() => setCopiedBookingUrl(false), 2000);
    }
  }

  const livePreview = useMemo(() => {
    return renderReminderEmail({
      clientName: lang === "ka" ? "ნინო ბერიძე" : "Sophia Beaumont",
      salonName: salonName || "MOERGE Epilation & Beauty Studio",
      bookingUrl: effectiveBookingUrl,
      subjectTemplate: emailSubject,
      bodyTemplate: emailBodyTemplate,
      brandColor,
      unsubscribeUrl: "https://moerge.ge/unsubscribe?token=demo-token",
    });
  }, [lang, salonName, effectiveBookingUrl, emailSubject, emailBodyTemplate, brandColor]);

  function handleResetDefaultTemplate() {
    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
    setEmailBodyTemplate(DEFAULT_EMAIL_BODY_TEMPLATE);
    setReminderIntervalDays(21);
  }

  function handleLoadGeorgianTemplate() {
    setEmailSubject(GEORGIAN_DEFAULT_EMAIL_SUBJECT);
    setEmailBodyTemplate(GEORGIAN_DEFAULT_EMAIL_BODY);
    setReminderIntervalDays(21);
  }

  function handleUpdateService(
    index: number,
    patch: Partial<CustomBookingService>
  ) {
    setCustomServices((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function handleAddService() {
    const newId = `service_${Date.now()}`;
    setCustomServices((prev) => [
      ...prev,
      {
        id: newId,
        type: "laser_epilation",
        name_ka: "ახალი პროცედურა",
        name_en: "New Treatment",
        desc_ka: "პროცედურის მოკლე აღწერა",
        desc_en: "Short treatment description",
        duration_minutes: 45,
        price_gel: 50,
        is_epilation: true,
        enabled: true,
      },
    ]);
  }

  function handleRemoveService(index: number) {
    setCustomServices((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearAllServices() {
    setCustomServices([]);
  }

  function handleApplyPresetTemplate(preset: ServiceTemplatePreset) {
    // Replace with cloned preset services and generate clean unique IDs
    const cloned = preset.services.map((s, i) => ({
      ...s,
      id: `${preset.id}_${i}_${Date.now()}`,
    }));
    setCustomServices(cloned);
  }

  async function handleSendLiveTestEmail() {
    if (!liveTestEmailTo.trim()) {
      setTestEmailResult({
        ok: false,
        message: t(
          "გთხოვთ შეიყვანოთ მიმღების ელ-ფოსტა ტესტირებისთვის.",
          "Please enter a recipient email address to test."
        ),
      });
      return;
    }

    setSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: liveTestEmailTo.trim(),
          resend_api_key: resendApiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestEmailResult({
          ok: false,
          message:
            data.error ||
            t("ტესტ წერილის გაგზავნა ვერ მოხერხდა.", "Failed to send test email."),
        });
      } else {
        setTestEmailResult({
          ok: true,
          message:
            data.mode === "live_resend"
              ? t(
                  `Resend-ით წარმატებით გაიგზავნა (${data.recipient})! Message ID: ${data.providerMessageId}`,
                  `Sent live via Resend to ${data.recipient}! Message ID: ${data.providerMessageId}`
                )
              : t(
                  `სატესტო სიმულაცია შესრულდა (${data.recipient}). რეალური გაგზავნისთვის მიუთითეთ Resend API Key.`,
                  `Dry-run simulation completed for ${data.recipient}. Add a Resend API Key for live delivery.`
                ),
        });
      }
    } catch {
      setTestEmailResult({
        ok: false,
        message: t("ქსელური შეცდომა ტესტირებისას.", "Network error during test."),
      });
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    // Sync service `value` with `name_ka` so appointment records have clean Georgian/English labels
    const normalizedServices = customServices.map((s) => ({
      ...s,
      is_epilation: s.type.includes("epilation") ? s.is_epilation : false,
      price_gel: Number(s.price_gel) || 0,
      duration_minutes: Number(s.duration_minutes) || 30,
    }));

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_name: salonName,
          sender_display_name: senderDisplayName,
          verified_sender_email: verifiedSenderEmail,
          timezone,
          reminder_interval_days: Number(reminderIntervalDays),
          email_subject: emailSubject,
          email_body_template: emailBodyTemplate,
          booking_url: effectiveBookingUrl,
          brand_color: brandColor,
          auto_reminders_enabled: autoRemindersEnabled,
          dry_run_mode: dryRunMode,
          test_recipient_email: testRecipientEmail.trim() || null,
          booking_title: bookingTitle,
          booking_subtitle: bookingSubtitle,
          salon_address: salonAddress,
          salon_phone: salonPhone,
          working_hours_start: workingHoursStart,
          working_hours_end: workingHoursEnd,
          slot_interval_minutes: Number(slotIntervalMinutes),
          resend_api_key: resendApiKey.trim() || null,
          send_booking_confirmation_email: sendBookingConfirmationEmail,
          custom_services: normalizedServices,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text:
            data.error ||
            t(
              "პარამეტრების შენახვა ვერ მოხერხდა.",
              "Failed to save salon settings."
            ),
        });
        setSaving(false);
        return;
      }

      setToast({
        type: "success",
        text: t(
          "სალონის პარამეტრები, ონლაინ ჯავშნის გვერდი და Resend კონფიგურაცია წარმატებით შეინახა!",
          "Salon settings, custom booking page, and Resend configuration saved!"
        ),
      });
      router.refresh();
    } catch {
      setToast({
        type: "error",
        text: t(
          "ქსელური შეცდომა პარამეტრების შენახვისას.",
          "Network error while saving settings."
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-rose-600 mb-1">
            <span>MOERGE</span>
            <span className="text-stone-300">•</span>
            <span>{t("პარამეტრების მართვა", "Settings Console")}</span>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-rose-600" />
            {salonName
              ? `${salonName} — ${t("პარამეტრები და ონლაინ ჯავშანი", "Salon Settings & Booking")}`
              : t("სალონის პარამეტრები და ონლაინ ჯავშანი", "Salon Settings & Online Booking")}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {t(
              "მართეთ თქვენი სალონის ონლაინ ჩაწერის გვერდი (/book), სერვისები და ფასები (₾), საქართველოს დროის სარტყელი და Resend ელ-ფოსტის სისტემა.",
              "Customize your salon's online booking page (/book), services & GEL pricing, Georgia time zone, and Resend email integration."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/book"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("ჯავშნის გვერდის ნახვა (/book)", "View Booking Page (/book)")}
          </Link>
          <span
            className={`px-3 py-2 rounded-xl font-semibold border ${
              isResendActive
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            Resend API:{" "}
            {isResendActive
              ? t("მიბმულია (Active)", "Connected")
              : t("სატესტო რეჟიმი", "Dry-Run Mode")}
          </span>
          <span
            className={`px-3 py-2 rounded-xl font-semibold border ${
              webhookSecretConfigured
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-stone-100 border-stone-200 text-stone-600"
            }`}
          >
            TZ: {timezone}
          </span>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Form (7 cols) */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-7 bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8 space-y-8"
        >
          {/* SECTION 1: Salon Identity */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {t(
                  "1. სალონის მონაცემები და საქართველოს დროის სარტყელი",
                  "1. Salon Identity & Time Zone"
                )}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t(
                  "ნაგულისხმევად არჩეულია თბილისის დრო (Asia/Tbilisi, GMT+4). შეგიძლიათ გამოიყენოთ onboarding@resend.dev სწრაფი ტესტირებისთვის ან თქვენი დომენი.",
                  "Defaults to Georgia Standard Time (Asia/Tbilisi, GMT+4). Use onboarding@resend.dev for quick testing or your verified domain."
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("სალონის დასახელება *", "Salon Name *")}
                </label>
                <input
                  type="text"
                  required
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("გამგზავნის სახელი *", "Sender Display Name *")}
                </label>
                <input
                  type="text"
                  required
                  value={senderDisplayName}
                  onChange={(e) => setSenderDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "გამგზავნის ელ-ფოსტა (Resend) *",
                    "Verified Sender Email Address *"
                  )}
                </label>
                <input
                  type="email"
                  required
                  value={verifiedSenderEmail}
                  onChange={(e) => setVerifiedSenderEmail(e.target.value)}
                  placeholder="onboarding@resend.dev"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setVerifiedSenderEmail("onboarding@resend.dev")
                    }
                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    {t(
                      "გამოიყენეთ onboarding@resend.dev (Resend ტესტისთვის)",
                      "Use onboarding@resend.dev (Resend Sandbox)"
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    {t("ონლაინ ჩაწერის ბმული (Booking URL)", "Online Booking URL")}
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    {t("ავტო-გენერირებული • Read-Only", "Auto-generated • Read-Only")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      readOnly
                      value={effectiveBookingUrl}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/90 text-stone-700 font-mono text-xs select-all cursor-default focus:outline-none focus:ring-0"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyBookingUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 shadow-xs cursor-pointer transition shrink-0"
                    title={t("ბმულის კოპირება", "Copy Booking Link")}
                  >
                    {copiedBookingUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">
                          {t("დაკოპირდა!", "Copied!")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span>{t("კოპირება", "Copy")}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={effectiveBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-700 shadow-xs cursor-pointer transition shrink-0"
                    title={t("გვერდის გახსნა", "Open Booking Page")}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
                    <span>{t("გახსნა", "Open")}</span>
                  </a>
                </div>

                <p className="mt-1 text-[11px] text-stone-400">
                  {t(
                    "ბმული გენერირდება ავტომატურად თქვენი სალონის უნიკალური იდენტიფიკატორის მიხედვით. ხელით შეცვლა დაბლოკილია.",
                    "Link is automatically generated from your salon's unique identifier. Manual edits are restricted."
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("დროის სარტყელი *", "Salon Time Zone *")}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white font-medium"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz === "Asia/Tbilisi"
                        ? "🇬🇪 Asia/Tbilisi (საქართველო GMT+4)"
                        : tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("შეხსენების ციკლი (დღე) *", "Reminder Cycle (Days) *")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={reminderIntervalDays}
                  onChange={(e) =>
                    setReminderIntervalDays(Number(e.target.value))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("ბრენდის ფერი", "Brand Accent Color")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-12 rounded-xl border border-stone-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Online Booking Page Customizer */}
          <div className="pt-6 border-t border-stone-100 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-rose-600" />
                  {t(
                    "2. ონლაინ ჯავშნის გვერდის კონსტრუქტორი (/book)",
                    "2. Online Booking Page Customizer (/book)"
                  )}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t(
                    "შეცვალეთ სათაური, მისამართი, სამუშაო საათები და სერვისების კატალოგი ფასებით (₾). ცვლილებები მომენტალურად აისახება /book გვერდზე.",
                    "Customize headline, address, working hours, and your treatment catalog with GEL prices. Changes apply immediately to /book."
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("ჯავშნის გვერდის მთავარი სათაური", "Booking Page Headline")}
                </label>
                <input
                  type="text"
                  value={bookingTitle}
                  onChange={(e) => setBookingTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "ჯავშნის გვერდის აღწერა / ქვესათაური",
                    "Booking Page Subtitle"
                  )}
                </label>
                <textarea
                  rows={2}
                  value={bookingSubtitle}
                  onChange={(e) => setBookingSubtitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                  {t("სალონის მისამართი", "Salon Address")}
                </label>
                <input
                  type="text"
                  value={salonAddress}
                  onChange={(e) => setSalonAddress(e.target.value)}
                  placeholder="თბილისი, ჭავჭავაძის გამზ. 34"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  <Phone className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                  {t("სალონის ტელეფონი", "Salon Contact Phone")}
                </label>
                <input
                  type="text"
                  value={salonPhone}
                  onChange={(e) => setSalonPhone(e.target.value)}
                  placeholder="+995 555 00 11 22"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
              </div>
            </div>

            {/* Working Hours & Slot Interval */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                  {t("გახსნის საათი", "Opening Time")}
                </label>
                <select
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white font-semibold"
                >
                  {WORK_HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                  {t("დახურვის საათი", "Closing Time")}
                </label>
                <select
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white font-semibold"
                >
                  {WORK_HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("სლოტების ინტერვალი", "Slot Step Interval")}
                </label>
                <select
                  value={slotIntervalMinutes}
                  onChange={(e) =>
                    setSlotIntervalMinutes(Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white font-semibold"
                >
                  <option value={30}>{t("ყოველ 30 წუთში", "Every 30 min")}</option>
                  <option value={45}>{t("ყოველ 45 წუთში", "Every 45 min")}</option>
                  <option value={60}>{t("ყოველ 60 წუთში (1 სთ)", "Every 60 min")}</option>
                  <option value={90}>{t("ყოველ 90 წუთში", "Every 90 min")}</option>
                </select>
              </div>
            </div>

            {/* Custom Services & Template Presets */}
            <div className="space-y-4">
              {/* Presets Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/70 via-stone-50 to-white border border-rose-100/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-rose-600" />
                      {t("სერვისების მზა შაბლონები (1-დაწკაპებით)", "Ready-made Service Presets (1-Click)")}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {t(
                        "აირჩიეთ მზა თემფლეითი თქვენი სალონის სპეციფიკის მიხედვით ან შექმენით სერვისები თავიდან.",
                        "Apply a curated preset tailored to your salon type, or craft services from scratch."
                      )}
                    </p>
                  </div>

                  {customServices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllServices}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 hover:border-red-300 bg-white hover:bg-red-50 text-stone-600 hover:text-red-700 text-[11px] font-semibold transition cursor-pointer self-start sm:self-auto"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                      {t("ყველას გასუფთავება", "Clear All")}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SERVICE_PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPresetTemplate(preset)}
                      className="p-3 rounded-xl border border-rose-100 hover:border-rose-300 bg-white hover:bg-rose-50/40 text-left transition cursor-pointer shadow-2xs group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs text-stone-800 group-hover:text-rose-700 transition">
                            {lang === "ka" ? preset.title_ka : preset.title_en}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-100">
                            {lang === "ka" ? preset.badge_ka : preset.badge_en}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed">
                          {lang === "ka" ? preset.desc_ka : preset.desc_en}
                        </p>
                      </div>
                      <div className="mt-2 text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        {t(`${preset.services.length} სერვისის ჩატვირთვა`, `Load ${preset.services.length} services`)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Header */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2">
                    {t(
                      "სერვისების და ფასების კატალოგი (₾ GEL)",
                      "Services & Pricing Catalog (₾ GEL)"
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 font-bold text-stone-600">
                      {customServices.length}
                    </span>
                  </label>
                  <p className="text-[11px] text-stone-500">
                    {t(
                      "აქ განსაზღვრული სერვისები პირდაპირ გამოჩნდება ადმინის ჯავშნების ფანჯარაში და ონლაინ /book ბმულზე.",
                      "Services listed here appear directly in the admin booking modal and on your public /book page."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddService}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("სერვისის დამატება", "Add Service")}
                </button>
              </div>

              {/* Service List or Empty State */}
              {customServices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60">
                  <LayoutTemplate className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-stone-800">
                    {t("სერვისების სია ცარიელია", "No services configured")}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                    {t(
                      "აირჩიეთ ერთ-ერთი მზა შაბლონი ზემოთ ან დაამატეთ თქვენი ინდივიდუალური სერვისები.",
                      "Choose one of the presets above or start adding custom services for your salon."
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-xs hover:bg-rose-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("პირველი სერვისის დამატება", "Add First Service")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {customServices.map((srv, idx) => (
                    <div
                      key={srv.id || idx}
                      className={`p-4 rounded-2xl border transition ${
                        srv.enabled
                          ? "bg-white border-stone-200"
                          : "bg-stone-50 border-stone-200 opacity-60"
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-semibold uppercase text-stone-400 mb-0.5">
                            {t("დასახელება (ქართ.) *", "Name (Georgian) *")}
                          </label>
                          <input
                            type="text"
                            required
                            value={srv.name_ka}
                            onChange={(e) =>
                              handleUpdateService(idx, {
                                name_ka: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-semibold uppercase text-stone-400 mb-0.5">
                            {t("დასახელება (ინგლ.) *", "Name (English) *")}
                          </label>
                          <input
                            type="text"
                            required
                            value={srv.name_en}
                            onChange={(e) =>
                              handleUpdateService(idx, {
                                name_en: e.target.value,
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold uppercase text-stone-400 mb-0.5">
                            {t("ფასი (₾)", "Price (₾)")}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={srv.price_gel}
                            onChange={(e) =>
                              handleUpdateService(idx, {
                                price_gel: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-rose-700"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold uppercase text-stone-400 mb-0.5">
                            {t("დრო (წთ)", "Minutes")}
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={480}
                            step={5}
                            value={srv.duration_minutes}
                            onChange={(e) =>
                              handleUpdateService(idx, {
                                duration_minutes: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                        <input
                          type="text"
                          placeholder={t("აღწერა ქართულად", "Georgian description")}
                          value={srv.desc_ka}
                          onChange={(e) =>
                            handleUpdateService(idx, { desc_ka: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600"
                        />
                        <input
                          type="text"
                          placeholder={t("აღწერა ინგლისურად", "English description")}
                          value={srv.desc_en}
                          onChange={(e) =>
                            handleUpdateService(idx, { desc_en: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2.5 border-t border-stone-100 text-xs">
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={srv.enabled}
                              onChange={(e) =>
                                handleUpdateService(idx, {
                                  enabled: e.target.checked,
                                })
                              }
                              className="rounded border-stone-300 text-rose-600"
                            />
                            <span className="font-medium text-stone-700">
                              {t("ჩართულია /book-ზე", "Visible on /book")}
                            </span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={srv.is_epilation}
                              onChange={(e) =>
                                handleUpdateService(idx, {
                                  is_epilation: e.target.checked,
                                })
                              }
                              className="rounded border-stone-300 text-rose-600"
                            />
                            <span
                              className={`font-semibold flex items-center gap-1 ${
                                srv.is_epilation ? "text-rose-700" : "text-stone-500"
                              }`}
                            >
                              <Sparkles className="w-3 h-3 text-rose-500" />
                              {t("21-დღიანი ციკლი", "21-Day Cycle")}
                            </span>
                          </label>

                          <label className="inline-flex items-center gap-1.5">
                            <span className="font-medium text-stone-500">
                              {t("კატეგორია:", "Category:")}
                            </span>
                            <select
                              value={srv.type}
                              onChange={(e) => {
                                const nextType = e.target.value as TreatmentType;
                                handleUpdateService(idx, {
                                  type: nextType,
                                  is_epilation:
                                    nextType.includes("epilation") || srv.is_epilation,
                                });
                              }}
                              className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-xs"
                            >
                              {(
                                Object.keys(TREATMENT_LABELS_I18N.ka) as TreatmentType[]
                              ).map((k) => (
                                <option key={k} value={k}>
                                  {getTreatmentLabel(k, lang)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveService(idx)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title={t("სერვისის წაშლა", "Delete service")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("წაშლა", "Remove")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Resend Direct Integration & Live Test */}
          <div className="pt-6 border-t border-stone-100 space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-rose-600" />
                {t(
                  "3. Resend ელ-ფოსტის ინტეგრაცია და ცოცხალი ტესტი",
                  "3. Resend Email Integration & Live Test"
                )}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t(
                  "ჩაწერეთ თქვენი Resend API გასაღები (re_...), რათა რეალურად გაიგზავნოს როგორც 21-დღიანი შეხსენებები, ასევე ონლაინ ჯავშნის დასტურები.",
                  "Paste your Resend API Key (re_...) to dispatch live 21-day epilation reminders and instant booking confirmations."
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                {t("Resend API Key (re_...)", "Resend API Key (re_...)")}
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_123456789_abcdefghijklmnop..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="mt-1 text-[11px] text-stone-400">
                {t(
                  "შეგიძლიათ აიღოთ უფასო გასაღები resend.com-ზე. თუ დომენი ჯერ არ დაგიდასტურებიათ, გამგზავნის ელ-ფოსტაში მიუთითეთ onboarding@resend.dev.",
                  "Get a free API key at resend.com. If you haven't verified a custom domain yet, set Sender Email to onboarding@resend.dev."
                )}
              </p>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sendBookingConfirmationEmail}
                onChange={(e) =>
                  setSendBookingConfirmationEmail(e.target.checked)
                }
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              <div className="text-xs">
                <div className="font-bold text-stone-900">
                  {t(
                    "ონლაინ ჯავშნისას მომენტალური დამადასტურებელი ელ-ფოსტის გაგზავნა",
                    "Send Instant Booking Confirmation Email via Resend"
                  )}
                </div>
                <div className="text-stone-600 mt-0.5">
                  {t(
                    "როცა კლიენტი /book გვერდზე ჩაეწერება, Resend-ით მაშინვე მიუვა ჯავშნის დეტალები.",
                    "When a client books on /book, immediately email them their appointment confirmation via Resend."
                  )}
                </div>
              </div>
            </label>

            {/* Live Test Email Box */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-3">
              <div className="text-xs font-bold text-stone-900">
                {t(
                  "Resend კავშირის შემოწმება (ტესტ წერილის გაგზავნა)",
                  "Verify Resend Connection (Send Live Test Email)"
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={liveTestEmailTo}
                  onChange={(e) => setLiveTestEmailTo(e.target.value)}
                  placeholder={t(
                    "შეიყვანეთ თქვენი ელ-ფოსტა ტესტისთვის...",
                    "Enter your email address to receive test..."
                  )}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleSendLiveTestEmail}
                  disabled={sendingTestEmail}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingTestEmail
                    ? t("იგზავნება...", "Sending...")
                    : t("ტესტ წერილის გაგზავნა", "Send Test Email")}
                </button>
              </div>
              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    testEmailResult.ok
                      ? "bg-emerald-100/80 text-emerald-900 border border-emerald-300"
                      : "bg-red-100/80 text-red-900 border border-red-300"
                  }`}
                >
                  {testEmailResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                  )}
                  <span>{testEmailResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: Email Template Section */}
          <div className="pt-6 border-t border-stone-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {t(
                    "4. 21-დღიანი ელ-ფოსტის შაბლონი",
                    "4. Customizable 21-Day Email Template"
                  )}
                </h3>
                <p className="text-xs text-stone-500">
                  {t("დინამიკური ველები:", "Available placeholders:")}{" "}
                  <code className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">
                    {"{{client_name}}"}
                  </code>
                  ,{" "}
                  <code className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">
                    {"{{booking_link}}"}
                  </code>
                  ,{" "}
                  <code className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">
                    {"{{salon_name}}"}
                  </code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadGeorgianTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t("ქართული შაბლონი", "Georgian Template")}
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaultTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("ინგლისური შაბლონი", "English Default")}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                {t("წერილის სათაური (Subject) *", "Email Subject *")}
              </label>
              <input
                type="text"
                required
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                {t("წერილის ტექსტი (Body) *", "Email Body Message *")}
              </label>
              <textarea
                rows={9}
                required
                value={emailBodyTemplate}
                onChange={(e) => setEmailBodyTemplate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* SECTION 5: Automation & Safe Testing Controls */}
          <div className="pt-6 border-t border-stone-100 space-y-3">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              {t(
                "5. ავტომატიზაცია და უსაფრთხო სატესტო რეჟიმი",
                "5. Automation & Safe Development Mode"
              )}
            </h3>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRemindersEnabled}
                onChange={(e) => setAutoRemindersEnabled(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              <div className="text-xs">
                <div className="font-bold text-stone-900">
                  {t(
                    "ავტომატური 21-დღიანი ელ-ფოსტის შეხსენებების ჩართვა",
                    "Enable Automatic 21-Day Email Reminders"
                  )}
                </div>
                <div className="text-stone-600 mt-0.5">
                  {t(
                    "ჩართვის შემთხვევაში სისტემა ავტომატურად გააგზავნის ყველა მოახლოებულ შეხსენებას.",
                    "When enabled, the scheduled background worker automatically dispatches due reminders."
                  )}
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                dryRunMode
                  ? "bg-amber-50/60 border-amber-200"
                  : "bg-emerald-50/60 border-emerald-200"
              }`}
            >
              <input
                type="checkbox"
                checked={dryRunMode}
                onChange={(e) => setDryRunMode(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              <div className="text-xs">
                <div className="font-bold flex items-center gap-2">
                  <span className={dryRunMode ? "text-amber-950" : "text-emerald-950"}>
                    {t(
                      "სატესტო რეჟიმი (Dry-Run სიმულაცია)",
                      "Test Mode (Dry-Run Simulation)"
                    )}
                  </span>
                  {!dryRunMode && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 uppercase tracking-wider">
                      ● {t("Production Live აქტიურია", "Production Live Active")}
                    </span>
                  )}
                </div>
                <div className={`mt-0.5 ${dryRunMode ? "text-amber-800" : "text-emerald-800"}`}>
                  {dryRunMode
                    ? t(
                        "ჩართულია სატესტო რეჟიმი: შეხსენებები დადასტურდება სიმულაციით რეალური ელ-ფოსტის გაგზავნის გარეშე.",
                        "Test mode active: reminders are simulated without dispatching live emails."
                      )
                    : t(
                        "Production Live რეჟიმი აქტიურია: რეალური წერილები იგზავნება Resend-ის გავლით პირდაპირ კლიენტის ელ-ფოსტაზე.",
                        "Production Live mode active: real reminder and confirmation emails are dispatched directly via Resend to clients."
                      )}
                </div>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                {t(
                  "სატესტო მიმღების ელ-ფოსტა (არასავალდებულო)",
                  "Test Recipient Email Override (Optional)"
                )}
              </label>
              <input
                type="email"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                placeholder="qa-inbox@yourdomain.com"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-400">
                {t(
                  "მითითების შემთხვევაში ყველა გამავალი წერილი გადამისამართდება ამ სატესტო ელ-ფოსტაზე.",
                  "If set, all outgoing reminder emails are redirected to this test inbox instead of the client's real address."
                )}
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-rose-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving
                ? t("ინახება...", "Validating & Saving...")
                : t("ყველა პარამეტრის შენახვა", "Save All Salon Settings")}
            </button>
          </div>
        </form>

        {/* Live Mobile-Friendly Email Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-rose-600" />
                <h3 className="text-base font-bold text-stone-900">
                  {t("წერილის ცოცხალი ნიმუში", "Live Email Preview")}
                </h3>
              </div>
              <div className="flex items-center bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewMode("html")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    previewMode === "html"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-stone-600"
                  }`}
                >
                  HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("text")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    previewMode === "text"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-stone-600"
                  }`}
                >
                  {t("ტექსტი", "Plain Text")}
                </button>
              </div>
            </div>

            <div className="mb-3 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs space-y-1">
              <div>
                <span className="text-stone-400">{t("გამგზავნი:", "From:")}</span>{" "}
                <strong>{senderDisplayName}</strong> &lt;{verifiedSenderEmail}&gt;
              </div>
              <div>
                <span className="text-stone-400">
                  {t("სათაური:", "Subject:")}
                </span>{" "}
                <strong>{livePreview.subject}</strong>
              </div>
            </div>

            {previewMode === "html" ? (
              <div className="rounded-2xl border border-stone-200 overflow-hidden bg-[#fdf8f6]">
                <iframe
                  title="Email HTML Preview"
                  srcDoc={livePreview.html}
                  className="w-full h-[540px] border-0"
                />
              </div>
            ) : (
              <pre className="p-4 rounded-2xl bg-stone-900 text-stone-100 text-xs font-mono whitespace-pre-wrap leading-relaxed h-[540px] overflow-y-auto">
                {livePreview.text}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
