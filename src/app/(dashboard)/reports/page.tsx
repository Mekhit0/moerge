import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import ReportsManager from "@/components/ReportsManager";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  if (!requireRole(ctx, ["owner", "admin"])) redirect("/dashboard");
  return <ReportsManager />;
}
