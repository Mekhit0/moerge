"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Users,
  MapPin,
  Phone,
  LayoutTemplate,
  Copy,
  Check,
  Scissors,
  Calendar,
  Mail,
  ChevronRight,
  HelpCircle,
  Layers,
  Palette,
  Bell,
  Sliders,
} from "lucide-react";
import { appUrl } from "@/lib/app-url";
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

const WORK_HOUR_OPTIONS = [
  "07:00",
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
  "23:00",
];

const COMMON_SERVICE_CATEGORIES = [
  { id: "epilation", label_ka: "ეპილაცია / დეპილაცია", label_en: "Epilation & Waxing" },
  { id: "hair", label_ka: "თმის მოვლა და სტილი", label_en: "Hair Care & Styling" },
  { id: "nails", label_ka: "მანიკიური და პედიკიური", label_en: "Nails & Pedicure" },
  { id: "facial", label_ka: "კოსმეტოლოგია და სახე", label_en: "Facial & Cosmetology" },
  { id: "massage", label_ka: "მასაჟი და სპა", label_en: "Massage & Body Spa" },
  { id: "brows", label_ka: "წარბები და წამწამები", label_en: "Brows & Lashes" },
  { id: "barber", label_ka: "ბარბერშოპი / მამაკაცის", label_en: "Barbershop" },
  { id: "general", label_ka: "ზოგადი / სხვა", label_en: "General / Other" },
];

const PRESET_BRAND_COLORS = [
  "#e11d48", // Rose 600
  "#be123c", // Rose 700
  "#d97706", // Amber 600 (Gold)
  "#059669", // Emerald 600
  "#0284c7", // Sky 600
  "#7c3aed", // Violet 600
  "#18181b", // Zinc 900 (Black luxury)
];

type SettingsTab = "profile" | "services" | "schedule" | "notifications";

export default function SettingsManager({
  initialSettings,
  resendConfigured,
  webhookSecretConfigured,
}: SettingsManagerProps) {
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Tab 1: Profile & Identity
  const [salonName, setSalonName] = useState(initialSettings.salon_name);
  const [salonSlug, setSalonSlug] = useState(initialSettings.salon_slug || "");
  const [salonAddress, setSalonAddress] = useState(
    initialSettings.salon_address || "თბილისი, ჭავჭავაძის გამზ. 34"
  );
  const [salonPhone, setSalonPhone] = useState(
    initialSettings.salon_phone || "+995 555 00 11 22"
  );
  const [brandColor, setBrandColor] = useState(
    initialSettings.brand_color || "#e11d48"
  );
  const timezone = "Asia/Tbilisi";

  // Tab 2: Services & Catalog
  const [customServices, setCustomServices] = useState<CustomBookingService[]>(
    Array.isArray(initialSettings.custom_services) &&
      initialSettings.custom_services.length > 0
      ? initialSettings.custom_services
      : DEFAULT_CUSTOM_SERVICES
  );
  const [serviceCategoryFilter, setServiceCategoryFilter] =
    useState<string>("all");
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  // Tab 3: Schedule & Online Booking (/book)
  const [bookingTitle, setBookingTitle] = useState(
    initialSettings.booking_title || "ონლაინ ჩაწერა სალონში"
  );
  const [bookingSubtitle, setBookingSubtitle] = useState(
    initialSettings.booking_subtitle ||
      "აირჩიეთ სასურველი პროცედურა და დრო — ჯავშანი მყისიერად აისახება სალონის განრიგში."
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
  const [bookingCancelDeadlineHours, setBookingCancelDeadlineHours] = useState(
    initialSettings.booking_cancel_deadline_hours ?? 24
  );
  const [depositRequired, setDepositRequired] = useState(initialSettings.deposit_required ?? false);
  const [depositMode, setDepositMode] = useState<"fixed" | "percentage">(initialSettings.deposit_percentage ? "percentage" : "fixed");
  const [depositAmount, setDepositAmount] = useState(initialSettings.deposit_amount_gel ?? 20);
  const [depositPercentage, setDepositPercentage] = useState(initialSettings.deposit_percentage ?? 20);
  const [sendBookingConfirmationEmail, setSendBookingConfirmationEmail] =
    useState(initialSettings.send_booking_confirmation_email ?? true);

  // Tab 4: Notifications & Email
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(
    initialSettings.auto_reminders_enabled
  );
  const [reminderIntervalDays, setReminderIntervalDays] = useState(
    initialSettings.reminder_interval_days || 21
  );
  const [senderDisplayName, setSenderDisplayName] = useState(
    initialSettings.sender_display_name
  );
  const [verifiedSenderEmail, setVerifiedSenderEmail] = useState(
    initialSettings.verified_sender_email
  );
  const [emailSubject, setEmailSubject] = useState(
    initialSettings.email_subject || DEFAULT_EMAIL_SUBJECT
  );
  const [emailBodyTemplate, setEmailBodyTemplate] = useState(
    initialSettings.email_body_template || DEFAULT_EMAIL_BODY_TEMPLATE
  );
  const [dryRunMode, setDryRunMode] = useState(initialSettings.dry_run_mode);
  const [testRecipientEmail, setTestRecipientEmail] = useState(
    initialSettings.test_recipient_email ?? ""
  );

  // Live Test Email State
  const [liveTestEmailTo, setLiveTestEmailTo] = useState(
    initialSettings.test_recipient_email || ""
  );
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Preview Mode Modal/Drawer
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"html" | "text">("html");

  // Save & Toast State
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedBookingUrl, setCopiedBookingUrl] = useState(false);

  // Calculate live booking URL based on current slug
  const effectiveBookingUrl = useMemo(() => {
    const slug = salonSlug.trim() || initialSettings.salon_slug || "salon";
    return appUrl(`/book?salon=${encodeURIComponent(slug)}`);
  }, [salonSlug, initialSettings.salon_slug]);

  function handleCopyBookingUrl() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveBookingUrl);
      setCopiedBookingUrl(true);
      setTimeout(() => setCopiedBookingUrl(false), 2000);
    }
  }

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveSettings();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const livePreview = useMemo(() => {
    return renderReminderEmail({
      clientName: lang === "ka" ? "ნინო ბერიძე" : "Sophia Beaumont",
      salonName: salonName || "My Salon",
      bookingUrl: effectiveBookingUrl,
      subjectTemplate: emailSubject,
      bodyTemplate: emailBodyTemplate,
      brandColor,
      unsubscribeUrl: appUrl("/unsubscribe?token=demo-token"),
    });
  }, [lang, salonName, effectiveBookingUrl, emailSubject, emailBodyTemplate, brandColor]);

  // Service Management Functions
  function handleAddService() {
    const newId = `svc_${Date.now()}`;
    setCustomServices((prev) => [
      {
        id: newId,
        type: "custom",
        category: "general",
        name_ka: "ახალი პროცედურა",
        name_en: "",
        desc_ka: "",
        desc_en: "",
        price_gel: 40,
        duration_minutes: 45,
        is_epilation: true,
        reminder_days: reminderIntervalDays || 21,
        enabled: true,
      },
      ...prev,
    ]);
  }

  function handleUpdateService(
    index: number,
    patch: Partial<CustomBookingService>
  ) {
    setCustomServices((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function handleRemoveService(index: number) {
    setCustomServices((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleApplyPreset(preset: ServiceTemplatePreset) {
    const cloned = preset.services.map((s, i) => ({
      ...s,
      id: `${preset.id}_${i}_${Date.now()}`,
      category: s.category || preset.id,
      name_en: s.name_en || s.name_ka,
      reminder_days: s.reminder_days ?? (s.is_epilation ? 21 : null),
    }));
    setCustomServices(cloned);
    setShowPresetsModal(false);
    setToast({
      type: "success",
      text: t(
        `მზა შაბლონი "${lang === "ka" ? preset.title_ka : preset.title_en}" ჩაიტვირთა (${cloned.length} სერვისი)!`,
        `Loaded preset "${preset.title_en}" (${cloned.length} services)!`
      ),
    });
  }

  // Filtered Services
  const visibleServices = useMemo(() => {
    if (serviceCategoryFilter === "all") return customServices;
    return customServices.filter(
      (s) =>
        (s.category || "general").toLowerCase() ===
        serviceCategoryFilter.toLowerCase()
    );
  }, [customServices, serviceCategoryFilter]);

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
          sender_display_name: senderDisplayName,
          salon_name: salonName,
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
                  `სატესტო წერილი გაიგზავნა: ${data.recipient}`,
                  `Test email sent to ${data.recipient}`
                )
              : t(
                  `სატესტო რეჟიმი ჩართულია, ამიტომ წერილი რეალურად არ გაიგზავნა (${data.recipient}).`,
                  `Test mode is on, so no email was actually sent (${data.recipient}).`
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

  async function handleSaveSettings() {
    setSaving(true);
    setToast(null);

    // Normalize services for maximum flexibility
    const normalizedServices = customServices.map((s) => ({
      ...s,
      name_en: s.name_en?.trim() ? s.name_en.trim() : s.name_ka.trim(),
      desc_ka: s.desc_ka || "",
      desc_en: s.desc_en || "",
      category: s.category || "general",
      price_gel: Number(s.price_gel) || 0,
      duration_minutes: Number(s.duration_minutes) || 30,
      is_epilation: Boolean(s.is_epilation),
      reminder_days:
        s.is_epilation && s.reminder_days !== undefined
          ? Number(s.reminder_days)
          : null,
      enabled: s.enabled !== false,
    }));

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_name: salonName.trim(),
          salon_slug: salonSlug.trim() ? salonSlug.trim().toLowerCase() : undefined,
          sender_display_name: senderDisplayName.trim(),
          verified_sender_email: verifiedSenderEmail.trim(),
          timezone,
          reminder_interval_days: Number(reminderIntervalDays) || 21,
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
          booking_cancel_deadline_hours: Number(bookingCancelDeadlineHours),
          deposit_required: depositRequired,
          deposit_amount_gel: depositRequired && depositMode === "fixed" ? Number(depositAmount) : null,
          deposit_percentage: depositRequired && depositMode === "percentage" ? Number(depositPercentage) : null,
          send_booking_confirmation_email: sendBookingConfirmationEmail,
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

      if (data.settings?.salon_slug) {
        setSalonSlug(data.settings.salon_slug);
      }

      setToast({
        type: "success",
        text: t(
          "სალონის ყველა პარამეტრი, სერვისების კატალოგი და ონლაინ ჯავშნის გვერდი წარმატებით განახლდა!",
          "Salon settings and booking page saved successfully!"
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
    <div className="space-y-6 pb-28">
      {/* Top Banner & Header */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-rose-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-rose-600 mb-1">
            <span>moarge</span>
            <span className="text-stone-300">•</span>
            <span>{t("პარამეტრების ცენტრი", "Settings Center")}</span>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-rose-600" />
            <span>{salonName || t("სალონის პარამეტრები", "Salon Settings")}</span>
          </h2>
          <p className="mt-1 text-sm text-stone-500 max-w-2xl">
            {t(
              "მართეთ სალონის პროფილი, სერვისების თავისუფალი კატალოგი (₾), სამუშაო განრიგი და კლიენტების ავტომატური შეხსენებები ერთ სივრცეში.",
              "Manage salon profile, custom services & GEL prices, working schedule, and automated client reminders in one intuitive place."
            )}
          </p>
        </div>

        {/* Quick Actions Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={effectiveBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
            <span>{t("ჯავშნის გვერდის ნახვა", "Open booking page")}</span>
          </a>

          <button
            type="button"
            onClick={handleCopyBookingUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition cursor-pointer"
            title={t("ბმულის კოპირება", "Copy link")}
          >
            {copiedBookingUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">{t("დაკოპირდა!", "Copied!")}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-500" />
                <span>{t("ბმულის კოპირება", "Copy link")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-red-50 border-red-200 text-red-950"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{toast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-bold underline cursor-pointer px-2 py-1"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      {/* TAB NAVIGATION PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-stone-200">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "profile"
              ? "bg-stone-900 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <LayoutTemplate className="w-4 h-4 text-rose-500" />
          <span>{t("სალონის ინფორმაცია", "Salon details")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "notifications"
              ? "bg-stone-900 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Mail className="w-4 h-4 text-rose-500" />
          <span>{t("შეხსენების წერილის ტექსტი", "Reminder email text")}</span>
        </button>
      </div>

      {/* TAB 1: SALON PROFILE */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {t("სალონის პროფილი და ბრენდინგი", "Salon Profile & Public Identity")}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                "აქ მითითებული მონაცემები გამოჩნდება კლიენტებისთვის ონლაინ ჯავშნის გვერდზე და შეხსენების წერილებში.",
                "These details are presented to your clients on the online booking page and in reminder messages."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("სალონის დასახელება *", "Salon Name *")}
              </label>
              <input
                type="text"
                required
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="მაგ. Beauty Lounge"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5 flex items-center justify-between">
                <span>{t("ჯავშნის ბმულის ბოლო ნაწილი *", "End of your booking link *")}</span>
                <span className="text-[11px] font-normal text-rose-600 lowercase">
                  /book?salon={salonSlug || "your-salon"}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={salonSlug}
                  onChange={(e) =>
                    setSalonSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  placeholder="მაგ. natali, beauty-bar, glam-tbilisi"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                {t(
                  "სრული თავისუფლება: შეგიძლიათ შეცვალოთ თქვენი სალონის ბმული ნებისმიერ დროს (მხოლოდ პატარა ლათინური ასოები, ციფრები და დეფისი).",
                  "Choose your branded link. Only lowercase alphanumeric characters and hyphens allowed."
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                {t("მისამართი / ლოკაცია", "Salon Address")}
              </label>
              <input
                type="text"
                value={salonAddress}
                onChange={(e) => setSalonAddress(e.target.value)}
                placeholder="მაგ. თბილისი, ჭავჭავაძის გამზ. 34"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Phone className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                {t("საკონტაქტო ტელეფონი", "Contact Phone")}
              </label>
              <input
                type="text"
                value={salonPhone}
                onChange={(e) => setSalonPhone(e.target.value)}
                placeholder="+995 555 00 11 22"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Palette className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                {t("ბრენდის აქცენტის ფერი", "Brand Accent Color")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-11 w-14 rounded-xl border border-stone-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-32 px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-mono"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_BRAND_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBrandColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                        brandColor.toLowerCase() === color.toLowerCase()
                          ? "border-stone-900 scale-110 shadow-sm"
                          : "border-white hover:scale-105"
                      }`}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Globe className="w-3.5 h-3.5 inline mr-1 text-rose-500" />
                {t("დროის სარტყელი", "Time Zone")}
              </label>
              <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700">
                <span aria-hidden="true">🇬🇪</span>
                <span>{t("საქართველო", "Georgia")}</span>
                <span className="text-stone-400">Asia/Tbilisi · UTC+4</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICES & PRICING — THE FREEDOM TAB */}
      {activeTab === "services" && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          {/* Header & Preset Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-100">
            <div>
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-rose-600" />
                <span>{t("სერვისების და ფასების კატალოგი", "Services & Pricing Catalog")}</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t(
                  "სრული თავისუფლება: დაამატეთ ნებისმიერი ტიპის სერვისი, მიუთითეთ ფასი (₾), ხანგრძლივობა და ინდივიდუალური შეხსენების ციკლი. ინგლისური სახელის შეყვანა არასავალდებულოა.",
                  "Full freedom: Add any beauty or medical service, set GEL pricing, duration, and tailored reminder cycle per procedure."
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPresetsModal(!showPresetsModal)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-rose-200 hover:border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                <span>{t("მზა სერვისები", "Ready-made services")}</span>
              </button>

              <button
                type="button"
                onClick={handleAddService}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t("ახალი სერვისი", "Add Service")}</span>
              </button>
            </div>
          </div>

          {/* PRESETS ACCORDION/CARD */}
          {showPresetsModal && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-50 via-stone-50 to-white border border-rose-200/90 shadow-sm space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    <span>{t("აირჩიეთ მზა თემფლეითი 1-დაწკაპებით", "Load Ready-made Template (1-Click)")}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {t(
                      "თემფლეითის არჩევისას ჩაიტვირთება წინასწარ გამზადებული სერვისები ფასებით და შეხსენების ციკლებით.",
                      "Applying a preset replaces your catalog with curated services tailored to your specialty."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresetsModal(false)}
                  className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer font-bold px-2 py-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {SERVICE_PRESET_TEMPLATES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-3.5 rounded-2xl border border-rose-100 hover:border-rose-400 bg-white hover:bg-rose-50/50 text-left transition cursor-pointer shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-stone-900 group-hover:text-rose-700 transition">
                          {lang === "ka" ? preset.title_ka : preset.title_en}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-100">
                          {lang === "ka" ? preset.badge_ka : preset.badge_en}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                        {lang === "ka" ? preset.desc_ka : preset.desc_en}
                      </p>
                    </div>
                    <div className="mt-3 text-[11px] font-bold text-rose-600 flex items-center gap-1 group-hover:underline">
                      <Plus className="w-3.5 h-3.5" />
                      {t(`ჩატვირთვა (${preset.services.length} სერვისი)`, `Load ${preset.services.length} items`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CATEGORY FILTER BUTTONS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setServiceCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                serviceCategoryFilter === "all"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {t("ყველა სერვისი", "All Services")} ({customServices.length})
            </button>
            {COMMON_SERVICE_CATEGORIES.map((cat) => {
              const count = customServices.filter(
                (s) => (s.category || "general").toLowerCase() === cat.id
              ).length;
              if (count === 0 && serviceCategoryFilter !== cat.id) return null;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setServiceCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                    serviceCategoryFilter === cat.id
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {lang === "ka" ? cat.label_ka : cat.label_en} ({count})
                </button>
              );
            })}
          </div>

          {/* SERVICE CARDS LIST */}
          {visibleServices.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50">
              <Scissors className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-stone-800">
                {t("სერვისები არ არის დამატებული", "No services configured")}
              </h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {t(
                  "დაამატეთ თქვენი სალონის სერვისები ხელით ან გამოიყენეთ მზა თემფლეითი.",
                  "Add your salon services or choose a preset template above."
                )}
              </p>
              <button
                type="button"
                onClick={handleAddService}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("პირველი სერვისის დამატება", "Add First Service")}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {customServices.map((srv, idx) => {
                if (
                  serviceCategoryFilter !== "all" &&
                  (srv.category || "general").toLowerCase() !==
                    serviceCategoryFilter.toLowerCase()
                ) {
                  return null;
                }

                return (
                  <div
                    key={srv.id || idx}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      srv.enabled
                        ? "bg-white border-stone-200 shadow-2xs hover:border-rose-300"
                        : "bg-stone-50/80 border-stone-200 opacity-60"
                    }`}
                  >
                    {/* Top Row: Title, Price, Duration, Delete */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {/* Name Georgian (Primary) */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          {t("სერვისის სახელი (ქართ.) *", "Service Name (Georgian) *")}
                        </label>
                        <input
                          type="text"
                          required
                          value={srv.name_ka}
                          onChange={(e) =>
                            handleUpdateService(idx, { name_ka: e.target.value })
                          }
                          placeholder="მაგ. დიოდური ეპილაცია (მთლიანი სხეული)"
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>

                      {/* Name English (Optional) */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                          {t("სახელი (ინგლ., არასავალდებულო)", "Name (English, optional)")}
                        </label>
                        <input
                          type="text"
                          value={srv.name_en || ""}
                          onChange={(e) =>
                            handleUpdateService(idx, { name_en: e.target.value })
                          }
                          placeholder={srv.name_ka || "Optional"}
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>

                      {/* Price in GEL */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          {t("ფასი (₾ GEL)", "Price (₾)")}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={srv.price_gel}
                            onChange={(e) =>
                              handleUpdateService(idx, {
                                price_gel: Number(e.target.value),
                              })
                            }
                            className="w-full pl-3.5 pr-7 py-2 rounded-xl border border-stone-200 text-xs font-black text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <span className="absolute right-2.5 top-2 text-xs font-bold text-stone-400 pointer-events-none">
                            ₾
                          </span>
                        </div>
                      </div>

                      {/* Duration in Minutes */}
                      <div className="sm:col-span-2 flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                            {t("დრო (წთ)", "Duration")}
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
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveService(idx)}
                          className="mt-4 p-2 rounded-xl text-stone-300 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title={t("წაშლა", "Delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Second Row: Category & Reminder Cycle & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-3 pt-3 border-t border-stone-100 items-center text-xs">
                      {/* Category Selector */}
                      <div className="sm:col-span-4 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-stone-500 shrink-0">
                          {t("კატეგორია:", "Category:")}
                        </span>
                        <select
                          value={srv.category || "general"}
                          onChange={(e) =>
                            handleUpdateService(idx, { category: e.target.value })
                          }
                          className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium w-full"
                        >
                          {COMMON_SERVICE_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {lang === "ka" ? c.label_ka : c.label_en}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Reminder Cycle - True Freedom */}
                      <div className="sm:col-span-5 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1 shrink-0">
                          <Bell className="w-3.5 h-3.5 text-rose-600" />
                          {t("შეხსენება:", "Reminder:")}
                        </span>
                        <select
                          value={
                            !srv.is_epilation
                              ? "none"
                              : srv.reminder_days === null || srv.reminder_days === undefined
                              ? "default"
                              : String(srv.reminder_days)
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "none") {
                              handleUpdateService(idx, {
                                is_epilation: false,
                                reminder_days: null,
                              });
                            } else if (val === "default") {
                              handleUpdateService(idx, {
                                is_epilation: true,
                                reminder_days: null,
                              });
                            } else {
                              handleUpdateService(idx, {
                                is_epilation: true,
                                reminder_days: Number(val),
                              });
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 text-xs font-semibold text-rose-950 w-full"
                        >
                          <option value="default">
                            {t(`სალონის ნაგულისხმევი (${reminderIntervalDays} დღე)`, `Salon default (${reminderIntervalDays} days)`)}
                          </option>
                          <option value="14">{t("14 დღეში (ფრჩხილები/წარბები)", "Every 14 days")}</option>
                          <option value="21">{t("21 დღეში (სტანდარტული მოვლა)", "Every 21 days")}</option>
                          <option value="30">{t("30 დღეში (ლაზერი/კოსმეტოლოგია)", "Every 30 days")}</option>
                          <option value="45">{t("45 დღეში (თმის შეღებვა)", "Every 45 days")}</option>
                          <option value="60">{t("60 დღეში (2 თვე)", "Every 60 days")}</option>
                          <option value="none">{t("შეხსენების გარეშე", "No Reminder")}</option>
                        </select>
                      </div>

                      {/* Toggle Enabled on /book */}
                      <div className="sm:col-span-3 flex justify-end">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={srv.enabled}
                            onChange={(e) =>
                              handleUpdateService(idx, { enabled: e.target.checked })
                            }
                            className="rounded border-stone-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                          />
                          <span
                            className={`text-xs font-bold ${
                              srv.enabled ? "text-stone-800" : "text-stone-400"
                            }`}
                          >
                            {srv.enabled
                              ? t("ჩანს ჯავშნის გვერდზე", "Shown on booking page")
                              : t("დამალულია", "Hidden")}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCHEDULE & ONLINE BOOKING */}
      {activeTab === "schedule" && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {t("სამუშაო განრიგი და ონლაინ ჯავშნის პარამეტრები", "Schedule & Booking Configuration")}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                "განსაზღვრეთ სამუშაო საათები და ინტერვალები. სისტემა ავტომატურად დაიცავს განრიგს გადაფარვებისგან.",
                "Set open/close hours and booking step. The engine automatically prevents overlapping appointments."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5 rounded-2xl bg-stone-50 border border-stone-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                {t("გახსნის საათი", "Opening Time")}
              </label>
              <select
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white font-bold text-stone-900"
              >
                {WORK_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("გაუქმების ბოლო ვადა (საათი)", "Cancellation deadline (hours)")}
              </label>
              <input type="number" min={0} max={720} value={bookingCancelDeadlineHours}
                onChange={(e) => setBookingCancelDeadlineHours(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white font-bold text-stone-900" />
              <p className="mt-1 text-[11px] text-stone-500">
                {t("ამ ვადის შემდეგ კლიენტი ჯავშანს ვეღარ გააუქმებს ან გადაიტანს.", "Clients cannot cancel or reschedule after this deadline.")}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                {t("დახურვის საათი", "Closing Time")}
              </label>
              <select
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white font-bold text-stone-900"
              >
                {WORK_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                <Sliders className="w-3.5 h-3.5 inline mr-1 text-rose-600" />
                {t("სლოტების ნაბიჯი (ინტერვალი)", "Slot Step Interval")}
              </label>
              <select
                value={slotIntervalMinutes}
                onChange={(e) => setSlotIntervalMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm bg-white font-bold text-stone-900"
              >
                <option value={15}>{t("ყოველ 15 წუთში", "Every 15 min")}</option>
                <option value={30}>{t("ყოველ 30 წუთში", "Every 30 min")}</option>
                <option value={45}>{t("ყოველ 45 წუთში", "Every 45 min")}</option>
                <option value={60}>{t("ყოველ 60 წუთში (1 სთ)", "Every 60 min (1 hour)")}</option>
                <option value={90}>{t("ყოველ 90 წუთში (1.5 სთ)", "Every 90 min")}</option>
              </select>
            </div>
          </div>

          <section className="rounded-2xl border border-rose-100 bg-white p-5">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={depositRequired} onChange={(event) => setDepositRequired(event.target.checked)} className="mt-1 accent-rose-600" />
              <span><strong className="block text-sm">{t("მოითხოვეთ წინასწარი დეპოზიტი", "Require a booking deposit")}</strong><span className="mt-1 block text-xs text-stone-500">{t("დეპოზიტის პარამეტრი ინახება, გადახდისთვის საჭიროა ჩართული პროვაიდერი.", "Deposit preference is saved; payment processing requires an enabled payment provider.")}</span></span>
            </label>
            {depositRequired && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs">{t("დეპოზიტის ტიპი", "Deposit type")}<select value={depositMode} onChange={(event) => setDepositMode(event.target.value as "fixed" | "percentage")} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"><option value="fixed">{t("ფიქსირებული თანხა", "Fixed amount")}</option><option value="percentage">{t("სერვისის პროცენტი", "Percent of service price")}</option></select></label>
              {depositMode === "fixed" ? <label className="text-xs">{t("თანხა ₾", "Amount GEL")}<input type="number" min="1" max="10000" step="0.01" value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></label>
                : <label className="text-xs">{t("პროცენტი", "Percentage")}<input type="number" min="1" max="100" value={depositPercentage} onChange={(event) => setDepositPercentage(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></label>}
            </div>}
          </section>

          {/* Booking Page Content */}
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-bold text-stone-900">
              {t("ჯავშნის გვერდის ტექსტები", "Booking page text")}
            </h4>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("მთავარი სათაური", "Main heading")}
              </label>
              <input
                type="text"
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                placeholder="მაგ. ონლაინ ჩაწერა სალონში"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("ქვესათაური / ინსტრუქცია კლიენტებისთვის", "Booking Page Subtitle")}
              </label>
              <textarea
                rows={2}
                value={bookingSubtitle}
                onChange={(e) => setBookingSubtitle(e.target.value)}
                placeholder="მაგ. აირჩიეთ სასურველი პროცედურა და დრო..."
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm leading-relaxed"
              />
            </div>

            <label className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50/60 border border-rose-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sendBookingConfirmationEmail}
                onChange={(e) => setSendBookingConfirmationEmail(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-bold text-stone-900">
                  {t(
                    "ონლაინ ჯავშნისას მომენტალური დამადასტურებელი ელ-ფოსტის გაგზავნა კლიენტზე",
                    "Send Instant Confirmation Email on New Booking"
                  )}
                </div>
                <div className="text-stone-600 mt-0.5 leading-relaxed">
                  {t(
                    "როდესაც კლიენტი წარმატებით დაჯავშნის ვიზიტს, სისტემა მაშინვე გაუგზავნის დადასტურების წერილს თარიღით, დროით და სალონის მისამართით.",
                    "Clients immediately receive an email with their date, time, and address upon booking."
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS & EMAIL */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                {t("შეტყობინებების ავტომატიზაცია და ელ-ფოსტის სისტემა", "Reminders & Email Dispatch")}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {t(
                  "მართეთ შეხსენებების შაბლონები, დროული მიწოდება და შეამოწმეთ ცოცხალი სატესტო მეილით.",
                  "Customize notification templates, delivery channels, and verify with 1-click test emails."
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEmailPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Eye className="w-4 h-4 text-rose-400" />
              <span>{t("წერილის ცოცხალი ნიმუში", "Preview Live Email")}</span>
            </button>
          </div>

          {/* Master Switch & Interval */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50/50 border border-rose-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRemindersEnabled}
                onChange={(e) => setAutoRemindersEnabled(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-bold text-stone-900">
                  {t(
                    "ავტომატური შეხსენებების ჩართვა (Master Switch)",
                    "Enable Automatic Care Reminders"
                  )}
                </div>
                <div className="text-stone-600 mt-0.5">
                  {t(
                    "ვიზიტის დასრულების შემდეგ სისტემა დანიშნულ დროს ავტომატურად გაუგზავნის კლიენტს დაბრუნების შეხსენებას.",
                    "Automatically dispatches follow-up emails after completed appointments."
                  )}
                </div>
              </div>
            </label>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-0.5">
                  {t(
                    "პროცედურის გამეორების ციკლი (შეხსენება მიდის 1 დღით ადრე)",
                    "Procedure Cycle (Reminder sent 1 day before)"
                  )}
                </label>
                <p className="text-[11px] text-stone-500">
                  {t(
                    `მაგ. ${reminderIntervalDays} დღის არჩევისას, კლიენტს შეხსენების მეილი მიუვა ${Math.max(1, Number(reminderIntervalDays) - 1)}-ე დღეს.`,
                    `e.g. with ${reminderIntervalDays} days, reminder is sent on day ${Math.max(1, Number(reminderIntervalDays) - 1)}.`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={reminderIntervalDays}
                  onChange={(e) => setReminderIntervalDays(Number(e.target.value))}
                  className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm font-bold text-center bg-white"
                />
                <span className="text-xs font-semibold text-stone-600">{t("დღე", "days")}</span>
              </div>
            </div>
          </div>

          {/* Sender Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("გამგზავნის სახელი (წერილში)", "Sender Display Name")}
              </label>
              <input
                type="text"
                required
                value={senderDisplayName}
                onChange={(e) => setSenderDisplayName(e.target.value)}
                placeholder="მაგ. Beauty Lounge"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                {t("სად მოვიდეს კლიენტების პასუხები", "Where client replies arrive")}
              </label>
              <input
                type="email"
                required
                value={verifiedSenderEmail}
                onChange={(e) => setVerifiedSenderEmail(e.target.value)}
                placeholder="salon@gmail.com"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="mt-1.5 text-xs text-stone-500">
                {t(
                  "წერილები იგზავნება moarge-დან. თუ კლიენტი პასუხს დაწერს, ის ამ მისამართზე მოვა.",
                  "Emails are sent by moarge. If a client replies, the reply arrives at this address."
                )}
              </p>
            </div>
          </div>

          {/* Email Template Editor */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                {t("წერილის შაბლონის რედაქტორი", "Email Message Template")}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailSubject(GEORGIAN_DEFAULT_EMAIL_SUBJECT);
                    setEmailBodyTemplate(GEORGIAN_DEFAULT_EMAIL_BODY);
                  }}
                  className="px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  {t("ქართული შაბლონი", "Georgian Template")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
                    setEmailBodyTemplate(DEFAULT_EMAIL_BODY_TEMPLATE);
                  }}
                  className="px-2.5 py-1 rounded-xl border border-stone-200 text-[11px] font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  {t("ინგლისური შაბლონი", "English Default")}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                {t("წერილის სათაური (Subject):", "Email Subject:")}
              </label>
              <input
                type="text"
                required
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-stone-500">
                  {t("წერილის ტექსტი:", "Email Body:")}
                </label>
                <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
                  <span>{t("დააწკაპეთ ჩასასმელად:", "Insert tag:")}</span>
                  {["{{client_name}}", "{{salon_name}}", "{{booking_link}}"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEmailBodyTemplate((prev) => prev + " " + tag)}
                      className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-rose-100 text-rose-700 font-mono text-[10px] cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={7}
                required
                value={emailBodyTemplate}
                onChange={(e) => setEmailBodyTemplate(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-xs sm:text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          {/* Live 1-Click Test Box */}
          <div className="pt-4 border-t border-stone-100 space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5">
              <div className="text-xs font-bold text-stone-900 flex items-center justify-between">
                <span>{t("შეამოწმეთ შეხსენების გაგზავნა რეალურ დროში:", "Test live email delivery:")}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={liveTestEmailTo}
                  onChange={(e) => setLiveTestEmailTo(e.target.value)}
                  placeholder={t("შეიყვანეთ თქვენი ელ-ფოსტის მისამართი...", "Enter your test email...")}
                  className="flex-1 px-4 py-2 rounded-xl border border-stone-200 bg-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleSendLiveTestEmail}
                  disabled={sendingTestEmail}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {sendingTestEmail
                      ? t("იგზავნება...", "Sending...")
                      : t("ტესტ წერილის გაგზავნა", "Send Test Email")}
                  </span>
                </button>
              </div>
              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    testEmailResult.ok
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : "bg-red-100 text-red-900 border border-red-300"
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
        </div>
      )}

      {/* EMAIL PREVIEW MODAL */}
      {showEmailPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-stone-900 text-base">
                  {t("შეტყობინების ცოცხალი ნიმუში", "Live Reminder Email Preview")}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-stone-100 p-0.5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFormat("html")}
                    className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                      previewFormat === "html"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-stone-600"
                    }`}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFormat("text")}
                    className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                      previewFormat === "text"
                        ? "bg-white text-rose-700 shadow-xs"
                        : "text-stone-600"
                    }`}
                  >
                    {t("ტექსტი", "Plain Text")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-800 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-b border-stone-200 text-xs space-y-1">
              <div>
                <span className="text-stone-400">{t("გამგზავნი:", "From:")}</span>{" "}
                <strong>{senderDisplayName}</strong> &lt;{verifiedSenderEmail}&gt;
              </div>
              <div>
                <span className="text-stone-400">{t("სათაური:", "Subject:")}</span>{" "}
                <strong>{livePreview.subject}</strong>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-ivory">
              {previewFormat === "html" ? (
                <iframe
                  title="Live Email"
                  srcDoc={livePreview.html}
                  className="w-full h-[480px] rounded-2xl border border-rose-100 shadow-xs bg-white"
                />
              ) : (
                <pre className="p-5 rounded-2xl bg-stone-900 text-stone-100 text-xs font-mono whitespace-pre-wrap leading-relaxed h-[480px] overflow-y-auto">
                  {livePreview.text}
                </pre>
              )}
            </div>

            <div className="p-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEmailPreviewModal(false)}
                className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"
              >
                {t("დახურვა", "Close Preview")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL FLOATING / STICKY SAVE BAR */}
      <div className="fixed bottom-16 left-0 right-0 lg:bottom-0 lg:left-64 z-20 bg-white/95 backdrop-blur-md border-t border-stone-200 py-3.5 px-4 sm:px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <p className="hidden text-sm text-stone-500 sm:block">
            {t("ცვლილებები შეინახება ღილაკზე დაჭერის შემდეგ.", "Changes are saved when you press the button.")}
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/25 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? t("ინახება...", "Saving Settings...")
                  : t("ყველა პარამეტრის შენახვა", "Save Salon Settings")}
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-rose-700/60 rounded">
                ⌘S
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
