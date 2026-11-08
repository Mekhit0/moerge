import PricingView from "@/components/marketing/PricingView";
import { PACKAGES, currentOffer } from "@/lib/pricing";
import { pricingFaq } from "@/lib/pricing-faq";
import { breadcrumbJsonLd, faqJsonLd, jsonLdScript, pageMetadata, softwareJsonLd } from "@/lib/seo";

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
  const structured = [
    breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: "ფასები", path: "/pricing" }]),
    faqJsonLd(pricingFaq(offer).map((item) => ({ q: item.q.ka, a: item.a.ka }))),
    softwareJsonLd(metadata.description as string),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <PricingView offer={offer} />
    </>
  );
}
