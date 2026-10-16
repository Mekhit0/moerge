import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book", "/login", "/terms", "/privacy"],
      disallow: ["/api/", "/dashboard/", "/appointments/", "/clients/", "/settings/", "/email-history/"],
    },
    sitemap: "https://moerge.vercel.app/sitemap.xml",
  };
}
