import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PricingDetails from "@/components/PricingDetails";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export const metadata: Metadata = {
  title: { absolute: "სალონის მართვის პროგრამის ფასები | moarge" },
  description: "moarge-ის ფასები: უფასო საცდელი პერიოდი, Business ₾60-ად და Multi-branch ₾150-ად. შეადარეთ ფილიალები და SMS ლიმიტები.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    locale: "ka_GE",
    url: "/pricing",
    siteName: "moarge",
    title: "სალონის მართვის პროგრამის ფასები | moarge",
    description: "შეადარეთ moarge-ის პაკეტები, ფილიალების რაოდენობა და SMS ლიმიტები.",
  },
};

export default function PricingPage() {
  // During the pilot there are no paid plans; the landing page explains the free test month.
  if (!BILLING_CONFIG.billingEnabled) redirect("/#pilot");
  return <PricingDetails />;
}
