import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { SalonSettings } from "../types";
import { appUrl } from "../app-url";

export const SAFE_SALON_SETTINGS_SELECT =
  "id, salon_id, salon_name, sender_display_name, verified_sender_email, timezone, reminder_interval_days, email_subject, email_body_template, booking_url, brand_color, auto_reminders_enabled, dry_run_mode, test_recipient_email, booking_title, booking_subtitle, salon_address, salon_phone, working_hours_start, working_hours_end, slot_interval_minutes, booking_cancel_deadline_hours, send_booking_confirmation_email, sms_reminder_24h, sms_reminder_2h, sms_booking_confirmation, onboarding_completed_at, admins_see_earnings, deposit_required, deposit_amount_gel, deposit_percentage, created_at, updated_at";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component where setting cookies is ignored
        }
      },
    },
  });
}

/**
 * Creates an unauthenticated Supabase client using the anon key for public server endpoints
 * (e.g. public booking RPCs).
 */
export function createPublicServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a server-only Supabase client for background cron jobs or webhook processing.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Throws a clear error if missing; silent fallback to anon key is disabled.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  if (!serviceKey || serviceKey.length < 10) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY: Service role key is required for secure server operations. Silent fallback to anon key is disabled."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface AuthenticatedSalonContext {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  salonId: string;
  salonSlug: string;
  salonName: string;
  role: "owner" | "admin" | "staff";
  /** The staff row linked to this login. A master (role "staff") only sees visits of this row. */
  staffId: string | null;
  settings: SalonSettings;
}

/** Shown when a master tries something only the salon office (owner or admin) may do. */
export const OFFICE_ONLY_ERROR = "ამას სალონის ადმინისტრაცია აკეთებს. / Only the salon office can do this.";

export function requireRole(
  ctx: AuthenticatedSalonContext,
  allowed: ReadonlyArray<AuthenticatedSalonContext["role"]>
): boolean {
  return allowed.includes(ctx.role);
}

/**
 * Verifies the user's Supabase Auth session on the server and resolves their
 * authorized salon_id via salon_memberships (or provisions initial membership via
 * the SECURITY DEFINER `ensure_user_salon` RPC).
 * Never trusts a client-supplied salon_id.
 */
export const getAuthenticatedSalonContext = cache(async function getAuthenticatedSalonContext(): Promise<AuthenticatedSalonContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Ensure the user has an active salon membership
  const userSalonName =
    (user.user_metadata?.salon_name as string | undefined)?.trim() ||
    "My Salon";

  const { data: ensuredSalonId, error: rpcError } = await supabase.rpc(
    "ensure_user_salon",
    {
      p_default_salon_name: userSalonName,
    }
  );

  let salonId: string | null = ensuredSalonId ?? null;

  if (rpcError || !salonId) {
    const { data: membership } = await supabase
      .from("salon_memberships")
      .select("salon_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    salonId = membership?.salon_id ?? null;
  }

  if (!salonId) {
    return null;
  }

  const { data: roleMembership } = await supabase
    .from("salon_memberships")
    .select("role")
    .eq("salon_id", salonId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const [salonRes, settingsRes, staffRes] = await Promise.all([
    supabase
      .from("salons")
      .select("id, name, slug")
      .eq("id", salonId)
      .maybeSingle(),
    supabase
      .from("salon_settings")
      .select(SAFE_SALON_SETTINGS_SELECT)
      .eq("salon_id", salonId)
      .maybeSingle(),
    supabase
      .from("staff")
      .select("id")
      .eq("salon_id", salonId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const salonRow = salonRes.data;
  const salonSlug = salonRow?.slug ?? "my-salon";
  const salonName = salonRow?.name ?? "My Salon";

  const autoBookingUrl = appUrl(`/book?salon=${encodeURIComponent(salonSlug)}`);

  const rawSettings = settingsRes.data as (Record<string, unknown> | null);
  const settings: SalonSettings = rawSettings
    ? {
        ...(rawSettings as unknown as SalonSettings),
        booking_url: autoBookingUrl,
        salon_name: salonName || (rawSettings.salon_name as string),
      }
    : {
        id: "",
        salon_id: salonId,
        salon_name: salonName,
        sender_display_name: salonName,
        verified_sender_email: "onboarding@resend.dev",
        timezone: "Asia/Tbilisi",
        reminder_interval_days: 21,
        email_subject: "მოახლოვდა თქვენი შემდეგი ვიზიტის დრო! | Next Epilation Reminder",
        email_body_template: "",
        booking_url: autoBookingUrl,
        brand_color: "#e11d48",
        auto_reminders_enabled: false,
        dry_run_mode: false,
        test_recipient_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? "",
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Salon Staff",
    },
    salonId,
    salonSlug,
    salonName,
    role: (roleMembership?.role ?? "staff") as "owner" | "admin" | "staff",
    staffId: staffRes.data?.id ?? null,
    settings,
  };
});
