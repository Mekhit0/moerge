import React from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import SettingsManager from "@/components/SettingsManager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) {
    redirect("/login");
  }

  const hasSavedResendKey = Boolean(
    ctx.settings.resend_api_key &&
      (String(ctx.settings.resend_api_key).startsWith("re_") ||
        ctx.settings.resend_api_key === "********")
  );
  const hasEnvResendKey = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith("re_")
  );

  const resendConfigured = hasSavedResendKey || hasEnvResendKey;
  const webhookSecretConfigured = Boolean(
    process.env.RESEND_WEBHOOK_SECRET &&
      process.env.RESEND_WEBHOOK_SECRET.startsWith("whsec_")
  );

  return (
    <SettingsManager
      initialSettings={{
        ...ctx.settings,
        salon_slug: ctx.salonSlug,
        resend_api_key: hasSavedResendKey ? "********" : null,
      }}
      resendConfigured={resendConfigured}
      webhookSecretConfigured={webhookSecretConfigured}
    />
  );
}
