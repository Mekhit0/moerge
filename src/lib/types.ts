export type SubscriptionTier = "starter" | "professional" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type SalonRole = "owner" | "admin" | "staff";

export type TreatmentType =
  | "epilation"
  | "laser_epilation"
  | "wax_epilation"
  | "sugaring_epilation"
  | "facial"
  | "massage"
  | "manicure"
  | "consultation";

export type AppointmentStatus = "scheduled" | "completed" | "missed" | "canceled";

export type ReminderStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "canceled";

export type EmailEventType =
  | "scheduled"
  | "processing"
  | "api_accepted"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "retry_scheduled"
  | "canceled"
  | "dry_run_simulated";

export interface CustomBookingService {
  id: string;
  type: TreatmentType;
  name_ka: string;
  name_en: string;
  desc_ka: string;
  desc_en: string;
  price_gel: number;
  duration_minutes: number;
  is_epilation: boolean;
  enabled: boolean;
}

export interface Salon {
  id: string;
  name: string;
  slug: string;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface SalonMembership {
  id: string;
  salon_id: string;
  user_id: string;
  role: SalonRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalonSettings {
  id: string;
  salon_id: string;
  salon_name: string;
  sender_display_name: string;
  verified_sender_email: string;
  timezone: string;
  reminder_interval_days: number;
  email_subject: string;
  email_body_template: string;
  booking_url: string;
  brand_color: string;
  auto_reminders_enabled: boolean;
  dry_run_mode: boolean;
  test_recipient_email: string | null;
  booking_title?: string;
  booking_subtitle?: string;
  salon_address?: string;
  salon_phone?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  slot_interval_minutes?: number;
  custom_services?: CustomBookingService[];
  resend_api_key?: string | null;
  send_booking_confirmation_email?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  salon_id: string;
  full_name: string;
  email: string;
  normalized_email?: string;
  phone: string | null;
  notes: string | null;
  email_consent: boolean;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
  is_archived: boolean;
  archived_at: string | null;
  last_completed_epilation_date: string | null;
  next_expected_appointment_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  salon_id: string;
  client_id: string;
  treatment_date: string; // YYYY-MM-DD
  treatment_time: string; // HH:mm:ss
  treatment_type: TreatmentType;
  is_epilation: boolean;
  status: AppointmentStatus;
  completed_at: string | null;
  next_expected_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, "id" | "full_name" | "email" | "phone" | "is_archived" | "email_consent">;
  reminders?: Reminder[];
}

export interface Reminder {
  id: string;
  salon_id: string;
  client_id: string;
  appointment_id: string;
  scheduled_for_date: string; // YYYY-MM-DD
  scheduled_send_at: string; // ISO timestamp
  actual_sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  status: ReminderStatus;
  idempotency_key: string;
  provider_message_id: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  failure_reason: string | null;
  is_permanent_failure: boolean;
  processing_locked_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  client?: Pick<Client, "id" | "full_name" | "email" | "is_archived" | "email_consent">;
  appointment?: Pick<Appointment, "id" | "treatment_date" | "treatment_time" | "treatment_type" | "status">;
}

export interface EmailLog {
  id: string;
  salon_id: string;
  reminder_id: string;
  client_id: string;
  appointment_id: string;
  recipient_email: string;
  subject: string;
  event_type: EmailEventType;
  provider_message_id: string | null;
  idempotency_key: string;
  attempt_number: number;
  status_code: number | null;
  error_message: string | null;
  is_dry_run: boolean;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export const EPILATION_TREATMENT_TYPES: readonly TreatmentType[] = [
  "epilation",
  "laser_epilation",
  "wax_epilation",
  "sugaring_epilation",
] as const;

export const TREATMENT_LABELS: Record<TreatmentType, string> = {
  epilation: "Classic Epilation",
  laser_epilation: "Diode Laser Epilation",
  wax_epilation: "Warm Wax Epilation",
  sugaring_epilation: "Organic Sugaring Epilation",
  facial: "Signature Facial",
  massage: "Body Massage",
  manicure: "Manicure & Nail Care",
  consultation: "Skin Consultation",
};

export const DEFAULT_CUSTOM_SERVICES: CustomBookingService[] = [
  {
    id: "svc_laser_full",
    type: "laser_epilation",
    name_ka: "დიოდური ლაზერული ეპილაცია (მთლიანი სხეული)",
    name_en: "Diode Laser Epilation (Full Body)",
    desc_ka:
      "უახლესი თაობის მოყინვის მეთოდით, უმტკივნეულო პროცედურა. მოქმედებს 21-დღიანი შეხსენება.",
    desc_en:
      "Medical-grade cooling diode laser hair removal. Includes 21-day care cycle reminder.",
    price_gel: 95,
    duration_minutes: 45,
    is_epilation: true,
    enabled: true,
  },
  {
    id: "svc_laser_zones",
    type: "epilation",
    name_ka: "ლაზერული ეპილაცია (ცალკეული ზონები)",
    name_en: "Laser Epilation (Selected Zones)",
    desc_ka:
      "სახე, იღლია, ბიკინი ან ფეხები — სწრაფი და ეფექტური სეანსი. 21-დღიანი ციკლი.",
    desc_en:
      "Targeted zone epilation session with soothing post-care balm. 21-day cycle.",
    price_gel: 45,
    duration_minutes: 30,
    is_epilation: true,
    enabled: true,
  },
  {
    id: "svc_sugaring",
    type: "sugaring_epilation",
    name_ka: "შუგარინგი (ბიო-ეპილაცია)",
    name_en: "Organic Sugaring Epilation",
    desc_ka:
      "ნაზი ორგანული შაქრის პასტით ეპილაცია მგრძნობიარე კანისთვის. 21-დღიანი ციკლი.",
    desc_en:
      "Gentle organic sugar paste epilation for sensitive skin. 21-day cycle.",
    price_gel: 50,
    duration_minutes: 40,
    is_epilation: true,
    enabled: true,
  },
  {
    id: "svc_wax",
    type: "wax_epilation",
    name_ka: "ცვილით ეპილაცია (პრემიუმ ცვილი)",
    name_en: "Luxury Warm Wax Epilation",
    desc_ka:
      "დაბალტემპერატურული ვარდის ცვილით სწრაფი ეპილაცია. 21-დღიანი ციკლი.",
    desc_en: "Low-temperature rose-resin wax epilation. 21-day cycle.",
    price_gel: 40,
    duration_minutes: 35,
    is_epilation: true,
    enabled: true,
  },
  {
    id: "svc_facial",
    type: "facial",
    name_ka: "სახის კანის ღრმა წმენდა და დატენიანება",
    name_en: "Hydrating Facial & Skin Renewal",
    desc_ka: "ულტრაბგერითი წმენდა და ბარიერის აღმდგენი ნიღაბი.",
    desc_en: "Deep ultrasonic cleansing & skin barrier renewal.",
    price_gel: 110,
    duration_minutes: 60,
    is_epilation: false,
    enabled: true,
  },
  {
    id: "svc_consultation",
    type: "consultation",
    name_ka: "უფასო კონსულტაცია და სატესტო იმპულსი",
    name_en: "Free Skin Consultation & Patch Test",
    desc_ka: "კანის ტიპის შეფასება და ლაზერის სატესტო სინჯი.",
    desc_en: "Complimentary skin assessment & laser patch test.",
    price_gel: 0,
    duration_minutes: 20,
    is_epilation: false,
    enabled: true,
  },
];

export const DEFAULT_EMAIL_SUBJECT = "It's time to book your next epilation appointment!";

export const DEFAULT_EMAIL_BODY_TEMPLATE = `Hi {{client_name}},

It's been 21 days since your last epilation appointment, and we'd love to welcome you back!

It's a great time to plan your next visit.

Ready to book your next appointment?

{{booking_link}}

Thank you for choosing {{salon_name}}. We look forward to seeing you again!

Best regards,
{{salon_name}} Team`;
