import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedSalonContext, requireRole } from "@/lib/supabase/server";
import GuideView from "@/components/guide/GuideView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "გზამკვლევი" };

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const ctx = await getAuthenticatedSalonContext();
  if (!ctx) redirect("/login?access=none");
  const params = await searchParams;
  return <GuideView audience={requireRole(ctx, ["owner", "admin"]) ? "office" : "master"} initialLesson={params.lesson} />;
}
