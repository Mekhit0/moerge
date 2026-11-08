import { redirect } from "next/navigation";
import BillingManager from "@/components/BillingManager";
import { billingOpen } from "@/lib/billing-plans";

export default function BillingPage() {
  if (!billingOpen()) redirect("/dashboard");
  return <BillingManager />;
}
