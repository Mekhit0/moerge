import React from "react";
import { redirect } from "next/navigation";
import { createServiceClient, getAuthenticatedSalonContext } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthenticatedSalonContext();

  if (!ctx) {
    redirect("/login");
  }
  if (!ctx.settings.onboarding_completed_at) redirect("/onboarding");
  const db = createServiceClient();
  const { data: subscription } = await db.from("subscriptions").select("status,trial_ends_at,grace_ends_at").eq("salon_id",ctx.salonId).maybeSingle();
  const readOnly = !(subscription?.status === "active" || (subscription?.status === "trialing" && new Date(subscription.trial_ends_at).getTime() > Date.now()) || (subscription?.status === "past_due" && subscription.grace_ends_at && new Date(subscription.grace_ends_at).getTime() > Date.now()));

  return (
    <AppShell
      salonName={ctx.settings?.salon_name || ctx.salonName || "My Salon"}
      timezone={ctx.settings?.timezone || "Asia/Tbilisi"}
      autoRemindersEnabled={Boolean(ctx.settings?.auto_reminders_enabled ?? true)}
      dryRunMode={Boolean(ctx.settings?.dry_run_mode ?? false)}
      staffName={ctx.user?.fullName || "Staff"}
      staffEmail={ctx.user?.email || ""}
      canManageData={ctx.role === "owner" || ctx.role === "admin"}
      readOnly={readOnly}
      isPlatformOwner={Boolean(process.env.PLATFORM_OWNER_USER_ID && ctx.user.id === process.env.PLATFORM_OWNER_USER_ID)}
    >
      {children}
    </AppShell>
  );
}
