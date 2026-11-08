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
    name: "moarge",
    alternateName: ["MOARGE", "მოარგე"],
    description: "სალონის მართვის პროგრამა საქართველოს სილამაზის სალონებისთვის, ბარბერშოპებისთვის და კოსმეტოლოგებისთვის.",
    // Tells search engines this is not the Tbilisi car accessories shop with a similar name.
    disambiguatingDescription: "moarge (მოარგე) is online salon management software for beauty salons in Georgia, run by IE WINST. It is not a car accessories shop.",
    legalName: `${COMPANY_LEGAL_NAME_KA} / ${COMPANY_LEGAL_NAME_EN}`,
    url: getAppUrl(),
    logo: `${getAppUrl()}/logo.png`,
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
    "@id": `${getAppUrl()}/#software`,
    name: "moarge",
    url: getAppUrl(),
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Salon management software",
    // Runs in the browser and can be added to the home screen; there are no store apps.
    operatingSystem: "Web",
    inLanguage: ["ka", "en"],
    description,
    offers: PACKAGES.filter((pkg) => pkg.available).map((pkg) => ({
      "@type": "Offer",
      name: pkg.name.en,
      price: String(pkg.monthlyGel),
      priceCurrency: "GEL",
      priceSpecification: { "@type": "UnitPriceSpecification", price: String(pkg.monthlyGel), priceCurrency: "GEL", unitCode: "MON" },
      url: `${getAppUrl()}/pricing`,
      validFrom: PRICING_STARTS_AT.toISOString(),
    })),
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

export function articleJsonLd(input: { path: string; title: string; description: string; published: string; updated: string }) {
  const url = `${getAppUrl()}${input.path}`;
  const day = (date: string) => `${date}T09:00:00+04:00`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description,
    inLanguage: "ka",
    datePublished: day(input.published),
    dateModified: day(input.updated),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: `${getAppUrl()}${SHARE_IMAGE.url}`,
    author: { "@id": `${getAppUrl()}/#organization` },
    publisher: { "@id": `${getAppUrl()}/#organization` },
  };
}

export function blogJsonLd(posts: Array<{ path: string; title: string; published: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${getAppUrl()}/blog#blog`,
    name: "moarge: რჩევები სალონის მფლობელებისთვის",
    url: `${getAppUrl()}/blog`,
    inLanguage: "ka",
    publisher: { "@id": `${getAppUrl()}/#organization` },
    blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `${getAppUrl()}${post.path}`, datePublished: `${post.published}T09:00:00+04:00` })),
  };
}
