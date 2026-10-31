export type SubscriptionTier = "starter" | "professional" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type SalonRole = "owner" | "admin" | "staff";

export type StandardTreatmentType =
  | "epilation"
  | "laser_epilation"
  | "wax_epilation"
  | "sugaring_epilation"
  | "facial"
  | "massage"
  | "manicure"
  | "consultation";

export type TreatmentType = StandardTreatmentType | (string & {});

export type AppointmentStatus = "scheduled" | "arrived" | "completed" | "no_show" | "missed" | "canceled";

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
  category?: string;
  name_ka: string;
  name_en: string;
  desc_ka: string;
  desc_en: string;
  price_gel: number;
  duration_minutes: number;
  is_epilation: boolean;
  reminder_days?: number | null;
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
  booking_cancel_deadline_hours?: number;
  custom_services?: CustomBookingService[];
  send_booking_confirmation_email?: boolean;
  onboarding_completed_at?: string | null;
  deposit_required?: boolean;
  deposit_amount_gel?: number | null;
  deposit_percentage?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  salon_id: string;
  full_name: string;
  email: string | null;
  normalized_email?: string;
  normalized_phone?: string | null;
  phone: string | null;
  notes: string | null;
  tags?: string[];
  email_consent: boolean;
  unsubscribed_at: string | null;
  sms_consent: boolean;
  sms_unsubscribed_at: string | null;
  preferred_language: "ka" | "en";
  unsubscribe_token: string;
  is_archived: boolean;
  is_blocked?: boolean;
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
  service_id?: string | null;
  service_name?: string | null;
  price_gel?: number | null;
  duration_minutes?: number | null;
  staff_id?: string;
  resource_id?: string | null;
  starts_at?: string;
  ends_at?: string;
  price_snapshot?: number | null;
  duration_snapshot_minutes?: number | null;
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

export interface ServiceTemplatePreset {
  id: string;
  title_ka: string;
  title_en: string;
  desc_ka: string;
  desc_en: string;
  badge_ka: string;
  badge_en: string;
  services: CustomBookingService[];
}

export const SERVICE_PRESET_TEMPLATES: ServiceTemplatePreset[] = [
  {
    id: "laser_clinic",
    title_ka: "ლაზერული ეპილაციის კლინიკა",
    title_en: "Laser Epilation Clinic",
    desc_ka: "დიოდური და ალექსანდრიტის ლაზერული ეპილაცია + 21-დღიანი ავტომატური ციკლი",
    desc_en: "Diode & Alexandrite laser removal with 21-day automated care cycle",
    badge_ka: "პოპულარული",
    badge_en: "Popular",
    services: [
      {
        id: "svc_laser_full",
        type: "laser_epilation",
        name_ka: "დიოდური ლაზერული ეპილაცია (მთლიანი სხეული)",
        name_en: "Diode Laser Epilation (Full Body)",
        desc_ka: "უახლესი თაობის მოყინვის მეთოდით, უმტკივნეულო პროცედურა. მოქმედებს 21-დღიანი შეხსენება.",
        desc_en: "Medical-grade cooling diode laser hair removal. Includes 21-day care cycle reminder.",
        price_gel: 95,
        duration_minutes: 45,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_laser_combo",
        type: "laser_epilation",
        name_ka: "ლაზერული ეპილაცია (ფეხები + ღრმა ბიკინი + იღლიები)",
        name_en: "Laser Epilation (Legs + Deep Bikini + Underarms)",
        desc_ka: "ყველაზე მოთხოვნადი კომბინირებული პაკეტი, 21-დღიანი ციკლით.",
        desc_en: "Most popular combo package with 21-day care cycle.",
        price_gel: 65,
        duration_minutes: 35,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_laser_zones",
        type: "epilation",
        name_ka: "ლაზერული ეპილაცია (ცალკეული ზონები)",
        name_en: "Laser Epilation (Selected Zones)",
        desc_ka: "სახე, იღლია ან ხელები — სწრაფი და ეფექტური სეანსი.",
        desc_en: "Targeted zone epilation session with soothing balm.",
        price_gel: 35,
        duration_minutes: 20,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_consultation",
        type: "consultation",
        name_ka: "უფასო კონსულტაცია და სატესტო იმპულსი",
        name_en: "Free Consultation & Laser Patch Test",
        desc_ka: "კანის ტიპის შეფასება და ლაზერის სატესტო სინჯი.",
        desc_en: "Complimentary skin assessment & laser patch test.",
        price_gel: 0,
        duration_minutes: 15,
        is_epilation: false,
        enabled: true,
      },
    ],
  },
  {
    id: "sugaring_waxing",
    title_ka: "შუგარინგი და ცვილით ეპილაცია",
    title_en: "Sugaring & Waxing Studio",
    desc_ka: "ორგანული ბიო-შაქრის პასტა და პრემიუმ ცვილი + 21-დღიანი შეხსენების ციკლი",
    desc_en: "Organic sugar paste & luxury warm wax with 21-day care cycle",
    badge_ka: "ორგანული",
    badge_en: "Organic",
    services: [
      {
        id: "svc_sugaring_bikini",
        type: "sugaring_epilation",
        name_ka: "შუგარინგი (ღრმა ბიკინი + იღლიები)",
        name_en: "Sugaring (Deep Bikini + Underarms)",
        desc_ka: "ნაზი ორგანული შაქრის პასტით ეპილაცია მგრძნობიარე კანისთვის.",
        desc_en: "Gentle organic sugar paste epilation for sensitive skin.",
        price_gel: 45,
        duration_minutes: 30,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_sugaring_full",
        type: "sugaring_epilation",
        name_ka: "შუგარინგი (მთლიანი სხეული)",
        name_en: "Full Body Organic Sugaring",
        desc_ka: "სრული ბიო-ეპილაცია ორგანული შაქრით. მოქმედებს 21-დღიანი შეხსენება.",
        desc_en: "Full body gentle sugaring hair removal. Includes 21-day reminder.",
        price_gel: 80,
        duration_minutes: 60,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_wax_legs",
        type: "wax_epilation",
        name_ka: "ცვილით ეპილაცია (ფეხები + ხელები)",
        name_en: "Warm Wax Epilation (Legs & Arms)",
        desc_ka: "დაბალტემპერატურული ვარდის ცვილით სწრაფი დეპილაცია.",
        desc_en: "Low-temperature warm wax epilation.",
        price_gel: 40,
        duration_minutes: 35,
        is_epilation: true,
        enabled: true,
      },
      {
        id: "svc_wax_face",
        type: "wax_epilation",
        name_ka: "სახის ზონების დეპილაცია (ცვილი)",
        name_en: "Facial Zone Waxing",
        desc_ka: "ზედა ტუჩი, წარბები, ლოყები.",
        desc_en: "Upper lip, eyebrows, facial zones.",
        price_gel: 15,
        duration_minutes: 15,
        is_epilation: true,
        enabled: true,
      },
    ],
  },
  {
    id: "beauty_spa",
    title_ka: "სილამაზის სალონი & სპა",
    title_en: "Beauty Salon & Spa",
    desc_ka: "მანიკიური, პედიკიური, სახის ღრმა წმენდა და სარელაქსაციო მასაჟი",
    desc_en: "Manicure, pedicure, deep facial cleansing and relaxation massage",
    badge_ka: "უნივერსალური",
    badge_en: "Full Service",
    services: [
      {
        id: "svc_manicure_gel",
        type: "manicure",
        name_ka: "მანიკიური (შილაკი / გელ-ლაქი)",
        name_en: "Gel Manicure & Nail Styling",
        desc_ka: "აპარატული ან კომბინირებული მანიკიური გელ-ლაქის დაფარვით.",
        desc_en: "Hardware or combo manicure with durable gel polish.",
        price_gel: 35,
        duration_minutes: 60,
        is_epilation: false,
        enabled: true,
      },
      {
        id: "svc_pedicure",
        type: "manicure",
        name_ka: "პედიკიური (სრული მოვლა)",
        name_en: "Complete Spa Pedicure",
        desc_ka: "ტერფის დამუშავება, სკრაბი და გელ-ლაქი.",
        desc_en: "Foot care, exfoliating scrub, and polish.",
        price_gel: 50,
        duration_minutes: 60,
        is_epilation: false,
        enabled: true,
      },
      {
        id: "svc_facial_deep",
        type: "facial",
        name_ka: "სახის ღრმა წმენდა და დატენიანება",
        name_en: "Deep Cleansing Facial & Hydration",
        desc_ka: "ულტრაბგერითი წმენდა, პილინგი და აღმდგენი ნიღაბი.",
        desc_en: "Ultrasonic exfoliation, peel, and barrier recovery mask.",
        price_gel: 90,
        duration_minutes: 60,
        is_epilation: false,
        enabled: true,
      },
      {
        id: "svc_massage_relax",
        type: "massage",
        name_ka: "სარელაქსაციო მასაჟი (მთლიანი სხეული)",
        name_en: "Full Body Relaxation Massage",
        desc_ka: "არომათერაპია და კუნთების დაჭიმულობის მოხსნა.",
        desc_en: "Aromatherapy soothing full-body oil massage.",
        price_gel: 70,
        duration_minutes: 60,
        is_epilation: false,
        enabled: true,
      },
    ],
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
