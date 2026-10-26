import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login");
  if (ctx.settings.onboarding_completed_at) redirect("/dashboard");
  if (!requireRole(ctx, ["owner", "admin"])) redirect("/dashboard");
  return <OnboardingWizard initialName={ctx.salonName} initialPhone={ctx.settings.salon_phone ?? ""}
    initialAddress={ctx.settings.salon_address ?? ""} timezone={ctx.settings.timezone} slug={ctx.salonSlug} />;
}
