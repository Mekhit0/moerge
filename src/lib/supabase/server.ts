import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SalonSettings } from "../types";

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
 * Creates a server-only Supabase client for background cron jobs or webhook processing.
 * Uses SUPABASE_SERVICE_ROLE_KEY when configured, falling back to anon client that invokes
 * SECURITY DEFINER RPC functions protected by CRON_SECRET.
 */
export function createAdminOrRpcSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 10
      ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  settings: SalonSettings;
}

/**
 * Verifies the user's Supabase Auth session on the server and resolves their
 * authorized salon_id via salon_memberships (or provisions initial membership via
 * the SECURITY DEFINER `ensure_user_salon` RPC).
 * Never trusts a client-supplied salon_id.
 */
export async function getAuthenticatedSalonContext(): Promise<AuthenticatedSalonContext | null> {
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
    "Lumière Epilation Studio";

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
      .select("salon_id")
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

  const [salonRes, settingsRes] = await Promise.all([
    supabase
      .from("salons")
      .select("id, name, slug")
      .eq("id", salonId)
      .maybeSingle(),
    supabase
      .from("salon_settings")
      .select("*")
      .eq("salon_id", salonId)
      .maybeSingle(),
  ]);

  const salonRow = salonRes.data;
  const salonSlug = salonRow?.slug ?? "lumiere-studio";
  const salonName = salonRow?.name ?? "Lumière Epilation Studio";

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://moerge.vercel.app"
  ).replace(/\/$/, "");
  const autoBookingUrl = `${appUrl}/book?salon=${salonSlug}`;

  const settings: SalonSettings = settingsRes.data
    ? {
        ...settingsRes.data,
        booking_url: autoBookingUrl,
        salon_name: salonName || settingsRes.data.salon_name,
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
        auto_reminders_enabled: true,
        dry_run_mode: false,
        test_recipient_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? "staff@lumieresalon.com",
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Salon Staff",
    },
    salonId,
    salonSlug,
    salonName,
    settings,
  };
}
