import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import SettingsNav from "@/components/SettingsNav";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  // Settings belong to the salon office; masters only work with their own day.
  if (!requireRole(ctx, ["owner", "admin"])) redirect("/dashboard");

  return (
    <>
      <SettingsNav canManageData={requireRole(ctx, ["owner", "admin"])} />
      {children}
    </>
  );
}
