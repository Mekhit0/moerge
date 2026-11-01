import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import PlatformAdminManager from "@/components/PlatformAdminManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ადმინი", robots: { index: false, follow: false } };

export default async function PlatformPage() {
  const ownerId = process.env.PLATFORM_OWNER_USER_ID?.trim();
  if (!ownerId) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=%2Fplatform");
  if (user.id !== ownerId) notFound();
  return <Suspense><PlatformAdminManager /></Suspense>;
}
