import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { appUrl } from "@/lib/app-url";
import { earningsAccess } from "@/lib/earnings-server";
import { currentOffer } from "@/lib/pricing";

function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Asia/Tbilisi" }).format(new Date(iso));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthenticatedSalonContext();

  if (!ctx) {
    redirect("/login?access=none");
  }
  if (!ctx.settings.onboarding_completed_at) redirect("/onboarding");
  const { data: subscription } = await ctx.supabase
    .from("subscriptions")
    .select("status,trial_ends_at,grace_ends_at")
    .eq("salon_id", ctx.salonId)
    .maybeSingle();
  const readOnly = !(subscription?.status === "active" || (subscription?.status === "trialing" && new Date(subscription.trial_ends_at).getTime() > Date.now()) || (subscription?.status === "past_due" && subscription.grace_ends_at && new Date(subscription.grace_ends_at).getTime() > Date.now()));

  const canManageData = ctx.role === "owner" || ctx.role === "admin";
  const trialNotice = canManageData && subscription?.status === "trialing" && subscription.trial_ends_at
    ? {
      endsAt: subscription.trial_ends_at,
      endsOn: { ka: formatDay(subscription.trial_ends_at, "ka-GE"), en: formatDay(subscription.trial_ends_at, "en-GB") },
      pilot: currentOffer().pilot,
    }
    : null;

  return (
    <AppShell
      salonName={ctx.settings?.salon_name || ctx.salonName || "My Salon"}
      bookingUrl={appUrl(`/book?salon=${encodeURIComponent(ctx.salonSlug)}`)}
      autoRemindersEnabled={Boolean(ctx.settings?.auto_reminders_enabled ?? true)}
      dryRunMode={Boolean(ctx.settings?.dry_run_mode ?? false)}
      emailDeliveryConfigured={Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_DOMAIN?.trim())}
      staffName={ctx.user?.fullName || "Staff"}
      staffEmail={ctx.user?.email || ""}
      canManageData={canManageData}
      earnings={{ owner: "salon", office: "salon", master: "own", none: "none" }[earningsAccess(ctx)] as "salon" | "own" | "none"}
      readOnly={readOnly}
      trialNotice={trialNotice}
      isPlatformOwner={Boolean(process.env.PLATFORM_OWNER_USER_ID && ctx.user.id === process.env.PLATFORM_OWNER_USER_ID)}
    >
      {children}
    </AppShell>
  );
}
