import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import SalonSettingsForm from "@/components/settings/SalonSettingsForm";
import AuditLogPanel from "@/components/AuditLogPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  const { data: wallet } = await ctx.supabase
    .from("sms_wallet")
    .select("included_quota,used_this_period,prepaid_balance")
    .eq("salon_id", ctx.salonId)
    .maybeSingle();

  return (
    <SalonSettingsForm
      initial={{ ...ctx.settings, salon_slug: ctx.salonSlug }}
      sms={{
        includedLeft: Math.max(0, (wallet?.included_quota ?? 0) - (wallet?.used_this_period ?? 0)),
        included: wallet?.included_quota ?? 0,
        bought: wallet?.prepaid_balance ?? 0,
      }}
      emailConfigured={Boolean(process.env.RESEND_API_KEY?.startsWith("re_") && process.env.RESEND_FROM_DOMAIN?.trim())}
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
