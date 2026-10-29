import type { Metadata } from "next";
import PricingDetails from "@/components/PricingDetails";

export const metadata: Metadata = {
  title: "Pricing | moarge",
  description: "moarge plan prices, branches, and SMS details. moarge-ის პაკეტების, ფილიალებისა და SMS-ის ფასები.",
};

export default function PricingPage() {
  return <PricingDetails />;
}
