import { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book", "/pricing", "/login", "/terms", "/privacy"],
      disallow: ["/api/", "/dashboard/", "/appointments/", "/clients/", "/settings/", "/email-history/"],
    },
    sitemap: appUrl("/sitemap.xml"),
  };
}
