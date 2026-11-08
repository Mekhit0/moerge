import { SEO_PAGES } from "@/lib/seo-pages";
import { ARTICLES } from "@/lib/articles";
import { PACKAGES } from "@/lib/pricing";
import { getAppUrl } from "@/lib/app-url";

// A short guide to the site for AI assistants (llms.txt convention). Built at deploy time.
export const dynamic = "force-static";

export function GET() {
  const base = getAppUrl();
  const solo = PACKAGES.find((pkg) => pkg.code === "solo")!;
  const business = PACKAGES.find((pkg) => pkg.code === "business")!;
  const lines = [
    "# moarge (მოარგე)",
    "",
    `> moarge is online salon management software in Georgian for beauty salons, nail studios, barbershops and cosmetologists in Georgia: online booking, team calendar, client base, SMS reminders, and specialists' commission. Run by IE WINST in Georgia. Not related to the car accessories shop with a similar name.`,
    "",
    `Prices: Solo ${solo.monthlyGel} GEL a month (1 specialist, ${solo.smsIncluded} SMS); Business ${business.monthlyGel} GEL a month (${business.staffIncluded} specialists, ${business.smsIncluded} SMS). 6 months -10%, 12 months -20%. Pages are in Georgian.`,
    "",
    "## Main pages",
    `- [Home](${base}): what moarge does`,
    `- [Pricing](${base}/pricing): plans and what they include`,
    ...SEO_PAGES.map((page) => `- [${page.label}](${base}/${page.slug}): ${page.description}`),
    "",
    "## Articles for salon owners",
    ...ARTICLES.map((item) => `- [${item.h1}](${base}/blog/${item.slug}): ${item.description}`),
    "",
    "## Legal",
    `- [Terms](${base}/terms)`,
    `- [Privacy](${base}/privacy)`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
