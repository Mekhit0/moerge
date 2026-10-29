import type { Metadata } from "next";
import PricingDetails from "@/components/PricingDetails";

export const metadata: Metadata = {
  title: { absolute: "სალონის მართვის პროგრამის ფასები | moarge" },
  description: "moarge-ის ფასები: უფასო 14-დღიანი საცდელი პერიოდი, Business ₾60-ად და Multi-branch ₾150-ად. შეადარეთ ფილიალები და SMS ლიმიტები.",
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
  return <PricingDetails />;
}
