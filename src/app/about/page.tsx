import LegalView from "@/components/LegalView";
import { ABOUT } from "@/lib/about";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { getAppUrl } from "@/lib/app-url";

export const metadata = pageMetadata({
  title: "moarge-ის შესახებ",
  description: "ვინ ქმნის moarge-ს, რატომ და რას გპირდებით: ქართული სალონის პროგრამა, ღია ფასები, თქვენი მონაცემები თქვენია.",
  path: "/about",
});

export default function AboutPage() {
  const structured = [
    breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: "შესახებ", path: "/about" }]),
    { "@context": "https://schema.org", "@type": "AboutPage", url: `${getAppUrl()}/about`, inLanguage: "ka", mainEntity: { "@id": `${getAppUrl()}/#organization` } },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <LegalView doc={ABOUT} other={{ href: "/pricing", label: { ka: "ფასების ნახვა", en: "See prices" } }} />
    </>
  );
}
