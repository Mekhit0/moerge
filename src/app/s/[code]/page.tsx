import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import SmsOptout from "./SmsOptout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SMS შეთავაზებები", robots: { index: false, follow: false } };

/**
 * The stop link from an offer SMS (moarge.com/s/code). It asks before stopping, so link previews
 * in messaging apps cannot unsubscribe anyone by opening the page.
 */
export default async function SmsOptoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{7}$/.test(code)) notFound();
  const { data } = await createServiceClient().rpc("sms_optout_lookup", { p_code: code });
  const found = data as { salon_name: string; subscribed: boolean } | null;
  if (!found) notFound();
  return <SmsOptout code={code} salonName={found.salon_name} alreadyStopped={!found.subscribed} />;
}
