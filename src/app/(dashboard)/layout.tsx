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
      salonName={ctx.settings.salon_name}
      timezone={ctx.settings.timezone}
      autoRemindersEnabled={ctx.settings.auto_reminders_enabled}
      dryRunMode={ctx.settings.dry_run_mode}
      staffName={ctx.user.fullName}
      staffEmail={ctx.user.email}
    >
      {children}
    </AppShell>
  );
}
