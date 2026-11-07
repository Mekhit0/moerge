import type { Metadata } from "next";
import { getAppUrl } from "./app-url";
import { COMPANY_LEGAL_NAME_EN, COMPANY_LEGAL_NAME_KA, FACEBOOK_URL, INSTAGRAM_URL, SUPPORT_EMAIL, SUPPORT_PHONE_TEL } from "./contact";
import { CHEAPEST_MONTHLY_GEL, PACKAGES, PRICING_STARTS_AT } from "./pricing";

const SITE_NAME = "moarge";
// Set explicitly: a page's own openGraph block replaces the inherited one, image included.
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "moarge, salon software for Georgia" };

/**
 * Metadata for one public page: its own canonical address, social preview text and, for pages that
 * should not appear in Google (sign-in, personal booking links), a noindex.
 */
export function pageMetadata(input: { title: string; description: string; path: string; noIndex?: boolean; absoluteTitle?: boolean; keywords?: string[] }): Metadata {
  const url = input.path === "/" ? getAppUrl() : `${getAppUrl()}${input.path}`;
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "ka_GE", siteName: SITE_NAME, url, title: input.title, description: input.description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images: [SHARE_IMAGE.url] },
    robots: input.noIndex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${getAppUrl()}/#organization`,
    name: "MOARGE",
    alternateName: ["moarge", "მოარგე"],
    description: "სალონის მართვის პროგრამა საქართველოს სილამაზის სალონებისთვის, ბარბერშოპებისთვის და კოსმეტოლოგებისთვის.",
    legalName: `${COMPANY_LEGAL_NAME_KA} / ${COMPANY_LEGAL_NAME_EN}`,
    url: getAppUrl(),
    logo: `${getAppUrl()}/icon.svg`,
    sameAs: [INSTAGRAM_URL, FACEBOOK_URL],
    email: SUPPORT_EMAIL,
    telephone: SUPPORT_PHONE_TEL,
    areaServed: { "@type": "Country", name: "Georgia" },
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, telephone: SUPPORT_PHONE_TEL, availableLanguage: ["ka", "en"] }],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getAppUrl()}/#website`,
    name: "moarge",
    alternateName: ["MOARGE", "მოარგე"],
    url: getAppUrl(),
    inLanguage: "ka",
    publisher: { "@id": `${getAppUrl()}/#organization` },
  };
}

export function softwareJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "moarge",
    url: getAppUrl(),
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Salon management software",
    operatingSystem: "Web, iOS, Android",
    inLanguage: ["ka", "en"],
    description,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "GEL",
      lowPrice: String(CHEAPEST_MONTHLY_GEL),
      highPrice: String(Math.max(...PACKAGES.filter((pkg) => pkg.available).map((pkg) => pkg.monthlyGel))),
      offerCount: PACKAGES.filter((pkg) => pkg.available).length,
      url: `${getAppUrl()}/pricing`,
      validFrom: PRICING_STARTS_AT.toISOString(),
    },
    publisher: { "@id": `${getAppUrl()}/#organization` },
  };
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? getAppUrl() : `${getAppUrl()}${item.path}`,
    })),
  };
}

/** Structured data as a safe inline script: closing tags inside strings cannot end the script. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
