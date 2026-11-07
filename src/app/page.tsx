import LandingPage from "@/components/marketing/LandingPage";
import { jsonLdScript, organizationJsonLd, pageMetadata, softwareJsonLd, websiteJsonLd } from "@/lib/seo";
import { currentOffer } from "@/lib/pricing";

// Rebuilt every hour so the November wording switches to the trial wording on 1 December by itself.
export const revalidate = 3600;

const TITLE = "moarge (მოარგე): სალონის მართვის პროგრამა და ონლაინ ჯავშანი";
const DESCRIPTION = "სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი 24/7, კალენდარი, კლიენტების ბაზა, გადახდები და შემოსავალი. 19 ₾-დან თვეში, უფასო საცდელით.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/",
  absoluteTitle: true,
  keywords: [
    "სალონის პროგრამა", "სალონის მართვის პროგრამა", "ონლაინ ჯავშანი", "ონლაინ ჩაწერა", "სალონის კალენდარი",
    "კლიენტების ბაზა", "სილამაზის სალონი", "მანიკურის სალონი", "ბარბერშოპი", "moarge", "მოარგე", "salon software georgia",
  ],
});

export default function HomePage() {
  const structured = [organizationJsonLd(), websiteJsonLd(), softwareJsonLd(DESCRIPTION)];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <LandingPage offer={currentOffer()} />
    </>
  );
}
