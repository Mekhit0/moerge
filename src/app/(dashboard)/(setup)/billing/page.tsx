import { redirect } from "next/navigation";
import BillingManager from "@/components/BillingManager";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export default function BillingPage() {
  if (!BILLING_CONFIG.billingEnabled) redirect("/dashboard");
  return <BillingManager />;
}
