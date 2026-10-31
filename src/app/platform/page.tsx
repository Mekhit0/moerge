import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import PlatformAdminManager from "@/components/PlatformAdminManager";

export const dynamic = "force-dynamic";
export default async function PlatformPage() {
  const ownerId = process.env.PLATFORM_OWNER_USER_ID?.trim();
  if (!ownerId) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?access=none");
  if (user.id !== ownerId) notFound();
  return <PlatformAdminManager/>;
}
