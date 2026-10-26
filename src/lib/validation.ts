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
    .min(2, "Client full name must be at least 2 characters.")
    .max(120, "Client full name cannot exceed 120 characters."),
  email: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine(isValidEmailAddress, "Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number cannot exceed 40 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email_consent: z.boolean().optional().default(true),
});

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
    .enum(["scheduled", "completed", "missed", "canceled"])
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
    auto_reminders_enabled: z.boolean().default(true),
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
        "აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში."
      ),
    salon_address: z
      .string()
      .trim()
      .max(250)
      .optional()
      .default("თბილისი, ი. ჭავჭავაძის გამზ. 34"),
    salon_phone: z
      .string()
      .trim()
      .max(60)
      .optional()
      .default("+995 555 00 21 21"),
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
    custom_services: z
      .array(customBookingServiceSchema)
      .optional()
      .default([]),
    send_booking_confirmation_email: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.auto_reminders_enabled) {
      if (
        !data.verified_sender_email ||
        data.verified_sender_email.endsWith("@example.com")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["verified_sender_email"],
          message:
            "Cannot enable automatic reminders with a placeholder @example.com sender address. Use onboarding@resend.dev or your verified domain email.",
        });
      }
    }
  });

export const publicBookingInputSchema = z.object({
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
    .refine(isValidEmailAddress, "Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number cannot exceed 40 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
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
  notes: z
    .string()
    .trim()
    .max(1000, "Notes cannot exceed 1000 characters.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email_consent: z.boolean().optional().default(true),
  turnstile_token: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  token: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
}).superRefine((data, ctx) => {
  if (data.treatment_type !== data.service_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["service_id"], message: "Service id mismatch." });
  }
});
