import { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

// Private app screens stay out of search. Sign-in and personal booking pages carry their own noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/appointments",
        "/clients",
        "/settings",
        "/email-history",
        "/reports",
        "/billing",
        "/guide",
        "/account",
        "/platform",
        "/invite",
        "/onboarding",
        "/ui-kit",
        "/s/",
      ],
    },
    sitemap: appUrl("/sitemap.xml"),
  };
}
