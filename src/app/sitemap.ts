import { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { SEO_PAGES } from "@/lib/seo-pages";

// Fixed dates: a sitemap that says "changed now" on every request teaches Google to ignore it.
const SITE_UPDATED = new Date("2026-11-01");
const LEGAL_UPDATED = new Date("2026-10-01");
const PRICING_UPDATED = new Date("2026-11-02");

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();

  return [
    { url: baseUrl, lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 1.0 },
    ...SEO_PAGES.map((page) => ({
      url: `${baseUrl}/${page.slug}`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly" as const,
      priority: page.slug === "salonis-programa" ? 0.9 : 0.8,
    })),
    { url: `${baseUrl}/book`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/pricing`, lastModified: PRICING_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/terms`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
