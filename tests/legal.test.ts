import { describe, expect, it } from "vitest";
import { PRIVACY, TERMS, type LegalDocument } from "../src/lib/legal";

const texts = (doc: LegalDocument) => [doc.title, doc.updated, doc.intro, ...doc.sections.flatMap((section) => [section.title, ...(section.paragraphs ?? []), ...(section.list ?? []), ...(section.after ?? [])])];

describe("Legal pages", () => {
  it("have every line in Georgian and English, without em dashes", () => {
    for (const doc of [PRIVACY, TERMS]) {
      for (const text of texts(doc)) {
        expect(text.ka.trim().length).toBeGreaterThan(0);
        expect(text.en.trim().length).toBeGreaterThan(0);
        expect(text.ka).not.toContain("—");
      }
    }
  });

  it("state the published offer: 14-day trial, 75% refund within 14 days, automatic renewal, 90 days of data after the end", () => {
    const terms = JSON.stringify(TERMS);
    expect(terms).toContain("14 days");
    expect(terms).toContain("75%");
    expect(terms).toContain("renews automatically");
    expect(terms).toContain("90 days");
  });

  it("explain cookies under an anchor the cookie notice links to", () => {
    expect(PRIVACY.sections.some((section) => section.id === "cookies")).toBe(true);
    expect(JSON.stringify(PRIVACY)).not.toMatch(/end-to-end/i);
  });
});
