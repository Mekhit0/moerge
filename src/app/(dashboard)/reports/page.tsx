import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext } from "@/lib/supabase/server";
import { earningsAccess } from "@/lib/earnings-server";
import { getTodayInTimeZone } from "@/lib/scheduling";
import EarningsView from "@/components/earnings/EarningsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  const access = earningsAccess(ctx);
  if (access === "none") redirect("/dashboard");
  return (
    <EarningsView
      access={access}
      today={getTodayInTimeZone(ctx.settings.timezone || "Asia/Tbilisi")}
      adminsSeeEarnings={Boolean(ctx.settings.admins_see_earnings)}
    />
  );
}
