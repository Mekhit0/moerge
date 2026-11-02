import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import SalonSettingsForm from "@/components/settings/SalonSettingsForm";
import AuditLogPanel from "@/components/AuditLogPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");

  return (
    <SalonSettingsForm
      initial={{ ...ctx.settings, salon_slug: ctx.salonSlug }}
      deposit={{
        deposit_required: Boolean(ctx.settings.deposit_required),
        deposit_amount_gel: ctx.settings.deposit_amount_gel ?? null,
        deposit_percentage: ctx.settings.deposit_percentage ?? null,
      }}
    >
      <AuditLogPanel />
    </SalonSettingsForm>
  );
}
