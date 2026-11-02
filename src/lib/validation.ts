import { z } from "zod";
import {
  DEFAULT_CUSTOM_SERVICES,
  EPILATION_TREATMENT_TYPES,
  TreatmentType,
} from "./types";

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  if (normalized.includes("..")) return false;
  return EMAIL_REGEX.test(normalized);
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isPublicBookingDateAllowed(dateStr: string): boolean {
  if (!isValidCalendarDate(dateStr)) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const maxDate = new Date(`${today}T00:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + 90);
  return dateStr >= today && dateStr <= maxDate.toISOString().slice(0, 10);
}

export function isEpilationTreatment(type: TreatmentType): boolean {
  return (EPILATION_TREATMENT_TYPES as readonly string[]).includes(type);
}

export const clientInputSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "სახელი მინიმუმ 2 სიმბოლოა. / The name must be at least 2 characters.")
    .max(120, "სახელი ძალიან გრძელია. / The name is too long."),
  email: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => !v || isValidEmailAddress(v), "შეამოწმეთ ელ-ფოსტა. / Please enter a valid email address.")
    .optional()
    .nullable()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .min(5, "შეიყვანეთ მობილურის ნომერი. / Enter a mobile number.")
    .max(40, "ნომერი ძალიან გრძელია. / The number is too long.")
    .refine((v) => normalizeGeorgianPhone(v) !== null, "შეიყვანეთ ქართული მობილური, მაგ: 5XX XX XX XX. / Enter a Georgian mobile number such as 5XX XX XX XX.")
    .transform((v) => normalizeGeorgianPhone(v)!),
  notes: z
    .string()
    .trim()
    .max(1000, "შენიშვნა ძალიან გრძელია. / The note is too long.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email_consent: z.boolean().optional().default(false),
  sms_consent: z.boolean().optional().default(false),
  /** Offers and come-back SMS. Separate from reminders, never assumed. */
  sms_marketing_consent: z.boolean().optional().default(false),
  preferred_language: z.enum(["ka", "en"]).optional().default("ka"),
  birthday: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (DATE_REGEX.test(v) && isValidCalendarDate(v) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "შეამოწმეთ დაბადების თარიღი. / Check the birthday."),
  preferred_staff_id: z.string().uuid().optional().nullable().transform((v) => v ?? null),
});

/** Reply addresses new salons start with; client replies sent there are lost. */
export function isPlaceholderReplyEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase() ?? "";
  return value === "" || value === "onboarding@resend.dev" || value.endsWith("@example.com");
}

/** Six-digit code a client uses with their phone number to find their booking. */
export const bookingLookupSchema = z.object({
  code: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => /^[0-9]{6}$/.test(v), "Enter the 6-digit booking code."),
  phone: z.string().trim().min(5).max(40).refine((v) => normalizeGeorgianPhone(v) !== null, "Enter a Georgian mobile number such as +995 5XX XX XX XX."),
});

export function normalizeGeorgianPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("5")) digits = `995${digits}`;
  else if (digits.length === 13 && digits.startsWith("00995")) digits = digits.slice(2);
  if (digits.length !== 12 || !digits.startsWith("9955")) return null;
  return `+${digits}`;
}

export const appointmentInputSchema = z.object({
  client_id: z.string().uuid("Please select a valid client."),
  treatment_date: z
    .string()
    .trim()
    .refine(isValidCalendarDate, "Treatment date must be a valid YYYY-MM-DD date."),
  treatment_time: z
    .string()
    .trim()
    .default("10:00")
    .refine((v) => TIME_REGEX.test(v), "Treatment time must be in HH:MM format."),
  treatment_type: z.string().trim().min(1, "Service / Treatment type is required"),
  status: z
    .enum(["scheduled", "arrived", "completed", "no_show", "missed", "canceled"])
    .default("scheduled"),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  service_id: z.string().trim().optional().nullable(),
  service_name: z.string().trim().optional().nullable(),
  price_gel: z.coerce.number().min(0).max(10000).optional().nullable(),
  duration_minutes: z.coerce.number().int().min(5).max(480).optional().nullable(),
  is_epilation: z.boolean().optional(),
});

export const customBookingServiceSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1).default("custom"),
  category: z.string().trim().max(80).optional().default("general"),
  name_ka: z.string().trim().min(1, "სერვისის დასახელება სავალდებულოა").max(150),
  name_en: z.string().trim().max(150).optional().default(""),
  desc_ka: z.string().trim().max(500).optional().default(""),
  desc_en: z.string().trim().max(500).optional().default(""),
  price_gel: z.coerce.number().min(0).max(10000).default(0),
  duration_minutes: z.coerce.number().int().min(5).max(480).default(45),
  is_epilation: z.boolean().default(false),
  reminder_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
  enabled: z.boolean().default(true),
});

export const salonSettingsSchema = z
  .object({
    salon_name: z
      .string()
      .trim()
      .min(2, "Salon name must be at least 2 characters.")
      .max(120, "Salon name cannot exceed 120 characters."),
    salon_slug: z
      .string()
      .trim()
      .min(2, "Salon slug must be at least 2 characters.")
      .max(60, "Salon slug cannot exceed 60 characters.")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must only contain lowercase letters, numbers, and hyphens (e.g. 'my-salon')"
      )
      .optional(),
    sender_display_name: z
      .string()
      .trim()
      .min(2, "Sender display name must be at least 2 characters.")
      .max(120, "Sender display name cannot exceed 120 characters."),
    verified_sender_email: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine(
        isValidEmailAddress,
        "Verified sender email must be a valid email address."
      ),
    timezone: z
      .string()
      .trim()
      .default("Asia/Tbilisi")
      .refine(
        isValidTimeZone,
        "Please select a valid IANA time zone (e.g., Asia/Tbilisi)."
      ),
    reminder_interval_days: z.coerce
      .number()
      .int()
      .min(1, "Reminder interval must be at least 1 day.")
      .max(365, "Reminder interval cannot exceed 365 days.")
      .default(21),
    email_subject: z
      .string()
      .trim()
      .min(3, "Email subject cannot be empty.")
      .max(200, "Email subject cannot exceed 200 characters."),
    email_body_template: z
      .string()
      .trim()
      .min(20, "Email message template must be at least 20 characters.")
      .max(5000, "Email message template cannot exceed 5000 characters.")
      .refine(
        (val) =>
          val.includes("{{booking_link}}") || val.includes("{{client_name}}"),
        "Template should include at least {{client_name}} or {{booking_link}} placeholder."
      ),
    booking_url: z
      .string()
      .trim()
      .optional()
      .nullable()
      .or(z.literal("")),
    brand_color: z
      .string()
      .trim()
      .regex(
        /^#[0-9A-Fa-f]{6}$/,
        "Brand color must be a valid hex color (e.g., #e11d48)."
      )
      .default("#e11d48"),
    auto_reminders_enabled: z.boolean().default(false),
    dry_run_mode: z.boolean().default(false),
    test_recipient_email: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
      .refine(
        (v) => v === null || isValidEmailAddress(v),
        "Test recipient email must be empty or a valid email address."
      ),
    booking_title: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default("ონლაინ ჩაწერა სალონში"),
    booking_subtitle: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default(
        "აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო."
      ),
    salon_address: z
      .string()
      .trim()
      .max(250)
      .optional()
      .default(""),
    salon_phone: z
      .string()
      .trim()
      .max(60)
      .optional()
      .default(""),
    working_hours_start: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Working start time must be HH:MM")
      .optional()
      .default("10:00"),
    working_hours_end: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Working end time must be HH:MM")
      .optional()
      .default("20:00"),
    slot_interval_minutes: z.coerce
      .number()
      .int()
      .min(15)
      .max(180)
      .optional()
      .default(60),
    booking_cancel_deadline_hours: z.coerce
      .number()
      .int()
      .min(0)
      .max(720)
      .optional()
      .default(24),
    deposit_required: z.boolean().optional().default(false),
    deposit_amount_gel: z.coerce.number().positive().max(10000).optional().nullable(),
    deposit_percentage: z.coerce.number().int().min(1).max(100).optional().nullable(),
    send_booking_confirmation_email: z.boolean().optional().default(false),
    sms_reminder_24h: z.boolean().optional(),
    sms_reminder_2h: z.boolean().optional(),
    sms_booking_confirmation: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasFixed = data.deposit_amount_gel !== undefined && data.deposit_amount_gel !== null;
    const hasPercent = data.deposit_percentage !== undefined && data.deposit_percentage !== null;
    if ((data.deposit_required && hasFixed === hasPercent) || (!data.deposit_required && (hasFixed || hasPercent))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deposit_required"], message: "Choose either a fixed deposit or a percentage deposit." });
    }
  });

export const publicBookingInputSchema = z.object({
  website: z.string().max(160).optional().default(""),
  salon_slug: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  full_name: z
    .string()
    .trim()
    .min(2, "Please enter your full name (at least 2 characters).")
    .max(120, "Full name cannot exceed 120 characters."),
  email: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => !v || isValidEmailAddress(v), "Please enter a valid email address.")
    .optional()
    .nullable()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .min(5, "Please enter a valid Georgian mobile phone number.")
    .max(40, "Phone number cannot exceed 40 characters.")
    .refine((v) => normalizeGeorgianPhone(v) !== null, "Enter a Georgian mobile number such as +995 5XX XX XX XX.")
    .transform((v) => normalizeGeorgianPhone(v)!),
  treatment_date: z
    .string()
    .trim()
    .refine(isPublicBookingDateAllowed, "Choose a date from today through the next 90 days."),
  treatment_time: z
    .string()
    .trim()
    .default("10:00")
    .refine((v) => TIME_REGEX.test(v), "Please select a valid appointment time."),
  treatment_type: z.string().trim().min(1, "Please select a service."),
  service_id: z.string().trim().min(1, "Please select an available service."),
  staff_id: z.string().uuid().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email_consent: z.boolean().optional().default(false),
  sms_consent: z.boolean().optional().default(false),
  /** Offers and come-back SMS. Separate from reminders, never assumed. */
  sms_marketing_consent: z.boolean().optional().default(false),
  preferred_language: z.enum(["ka", "en"]).optional().default("ka"),
}).superRefine((data, ctx) => {
  if (data.treatment_type !== data.service_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["service_id"], message: "Service id mismatch." });
  }
});
