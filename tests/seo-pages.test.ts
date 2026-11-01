import { describe, expect, it } from "vitest";
import { SEO_PAGES, seoPage } from "../src/lib/seo-pages";
import { jsonLdScript, pageMetadata } from "../src/lib/seo";
import { SCENES } from "../src/components/tour/Scenes";

const RESERVED = ["book", "login", "register", "terms", "privacy", "pricing", "dashboard", "settings", "api", "guide", "platform"];

describe("SEO landing pages", () => {
  it("have unique slugs, titles and descriptions", () => {
    const slugs = SEO_PAGES.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(SEO_PAGES.map((page) => page.title)).size).toBe(SEO_PAGES.length);
    expect(new Set(SEO_PAGES.map((page) => page.description)).size).toBe(SEO_PAGES.length);
  });

  it("use safe URL slugs that never shadow an app route", () => {
    for (const page of SEO_PAGES) {
      expect(page.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(RESERVED).not.toContain(page.slug);
    }
  });

  it("are complete, link only to real pages and use a real scene", () => {
    for (const page of SEO_PAGES) {
      expect(page.h1.length).toBeGreaterThan(10);
      expect(page.description.length).toBeGreaterThan(80);
      expect(page.description.length).toBeLessThanOrEqual(170);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.benefits.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(SCENES)).toContain(page.scene);
      for (const slug of page.related) {
        expect(seoPage(slug), `${page.slug} links to ${slug}`).toBeDefined();
        expect(slug).not.toBe(page.slug);
      }
    }
  });

  it("follow the Georgian copy rules: no em dashes", () => {
    expect(JSON.stringify(SEO_PAGES)).not.toContain("—");
  });

  it("each get their own canonical address", () => {
    const meta = pageMetadata({ title: "t", description: "d", path: "/onlain-javshani" });
    expect(meta.alternates?.canonical).toBe("https://www.moarge.test/onlain-javshani");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(pageMetadata({ title: "t", description: "d", path: "/login", noIndex: true }).robots).toEqual({ index: false, follow: true });
  });

  it("escape structured data so it cannot close the script tag", () => {
    expect(jsonLdScript({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
