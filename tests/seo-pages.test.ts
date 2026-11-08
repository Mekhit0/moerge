import { describe, expect, it } from "vitest";
import { SEO_PAGES, seoPage } from "../src/lib/seo-pages";
import { ARTICLES, article, articlesFor, readingMinutes } from "../src/lib/articles";
import { jsonLdScript, organizationJsonLd, pageMetadata } from "../src/lib/seo";
import { SCENES } from "../src/components/tour/Scenes";

const RESERVED = ["about", "blog", "book", "login", "register", "terms", "privacy", "pricing", "dashboard", "settings", "api", "guide", "platform"];

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
      expect(page.details.length).toBeGreaterThanOrEqual(1);
      for (const detail of page.details) expect(detail.paragraphs.length).toBeGreaterThanOrEqual(1);
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

  it("point the business details at its own social profiles", () => {
    expect(organizationJsonLd().sameAs).toEqual(["https://www.instagram.com/moarge.salon/", "https://www.facebook.com/people/Moarge/61596051124446/"]);
  });

  it("escape structured data so it cannot close the script tag", () => {
    expect(jsonLdScript({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("Articles", () => {
  it("have unique slugs, titles and descriptions of a sensible length", () => {
    expect(new Set(ARTICLES.map((item) => item.slug)).size).toBe(ARTICLES.length);
    expect(new Set(ARTICLES.map((item) => item.title)).size).toBe(ARTICLES.length);
    for (const item of ARTICLES) {
      expect(item.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(item.title.length).toBeLessThanOrEqual(65);
      expect(item.description.length).toBeGreaterThan(80);
      expect(item.description.length).toBeLessThanOrEqual(170);
      expect(item.updated >= item.published).toBe(true);
      expect(item.sections.length).toBeGreaterThanOrEqual(4);
      expect(readingMinutes(item)).toBeGreaterThanOrEqual(2);
    }
  });

  it("link only to real feature pages, and those pages link back", () => {
    for (const item of ARTICLES) {
      expect(item.related.length).toBeGreaterThan(0);
      for (const slug of item.related) {
        expect(seoPage(slug), `${item.slug} links to ${slug}`).toBeDefined();
        expect(articlesFor(slug)).toContain(item);
      }
    }
    expect(article("no-such-article")).toBeUndefined();
  });

  it("follow the Georgian copy rules: no em dashes", () => {
    expect(JSON.stringify(ARTICLES)).not.toContain("—");
    expect(JSON.stringify(SEO_PAGES.map((page) => page.details))).not.toContain("—");
  });
});
