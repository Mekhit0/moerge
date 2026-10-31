import { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";
import { BILLING_CONFIG } from "@/lib/billing-plans";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book", ...(BILLING_CONFIG.billingEnabled ? ["/pricing"] : []), "/login", "/terms", "/privacy"],
      disallow: ["/api/", "/dashboard/", "/appointments/", "/clients/", "/settings/", "/email-history/"],
    },
    sitemap: appUrl("/sitemap.xml"),
  };
}
