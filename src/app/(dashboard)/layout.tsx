import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
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

  return (
    <AppShell
      salonName={ctx.settings?.salon_name || ctx.salonName || "My Salon"}
      timezone={ctx.settings?.timezone || "Asia/Tbilisi"}
      autoRemindersEnabled={Boolean(ctx.settings?.auto_reminders_enabled ?? true)}
      dryRunMode={Boolean(ctx.settings?.dry_run_mode ?? false)}
      staffName={ctx.user?.fullName || "Staff"}
      staffEmail={ctx.user?.email || ""}
    >
      {children}
    </AppShell>
  );
}
