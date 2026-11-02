import PricingView from "@/components/marketing/PricingView";
import { CHEAPEST_MONTHLY_GEL, PACKAGES, PRICING_STARTS_AT, currentOffer } from "@/lib/pricing";
import { pricingFaq } from "@/lib/pricing-faq";
import { breadcrumbJsonLd, faqJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { getAppUrl } from "@/lib/app-url";

// Rebuilt every hour so the November wording switches to the trial wording on 1 December by itself.
export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "ფასები: სალონის პროგრამა 19 ₾-დან თვეში",
  description: `moarge-ის ფასები: სოლო ${PACKAGES[0].monthlyGel} ₾, ბიზნესი ${PACKAGES[1].monthlyGel} ₾ თვეში 10 სპეციალისტით. 6 და 12 თვით გადახდისას ფასდაკლება. უფასო საცდელი პერიოდი.`,
  path: "/pricing",
  keywords: ["სალონის პროგრამის ფასი", "სალონის პროგრამა ფასი", "moarge ფასები", "salon software price georgia"],
});

export default function PricingPage() {
  const offer = currentOffer();
  const sellable = PACKAGES.filter((pkg) => pkg.available);
  const structured = [
    breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: "ფასები", path: "/pricing" }]),
    faqJsonLd(pricingFaq(offer).map((item) => ({ q: item.q.ka, a: item.a.ka }))),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "moarge",
      url: getAppUrl(),
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "GEL",
        lowPrice: String(CHEAPEST_MONTHLY_GEL),
        highPrice: String(Math.max(...sellable.map((pkg) => pkg.monthlyGel))),
        offerCount: sellable.length,
        validFrom: PRICING_STARTS_AT.toISOString(),
      },
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <PricingView offer={offer} />
    </>
  );
}
