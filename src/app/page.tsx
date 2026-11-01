import LandingPage from "@/components/marketing/LandingPage";
import { jsonLdScript, organizationJsonLd, pageMetadata, softwareJsonLd, websiteJsonLd } from "@/lib/seo";

const TITLE = "moarge | სალონის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტები";
const DESCRIPTION = "სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი 24/7, კალენდარი სპეციალისტების მიხედვით, კლიენტების ბაზა, შეხსენებები და შემოსავალი. 30 დღე უფასოდ.";

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
      <LandingPage />
    </>
  );
}
