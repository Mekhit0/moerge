import { describe, it, expect } from "vitest";
import { siteMetadata as metadata, siteViewport as viewport } from "../src/lib/metadata";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import {
  evaluateSmartSlotAvailability,
  generateDynamicTimeSlots,
} from "../src/lib/scheduling";
import { publicBookingInputSchema } from "../src/lib/validation";

describe("E2E Suite: Landing Page, SEO, Mobile Responsiveness & Smart Retention", () => {
  describe("1. SEO & Metadata Compliance", () => {
    it("has Georgian search friendly default metadata without a site wide canonical", () => {
      expect(metadata.title).toEqual({
        default: "moarge | სალონის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტები",
        template: "%s | moarge",
      });
      expect(metadata.description).toContain("სალონის მართვის პროგრამა");
      expect(metadata.description).not.toContain("—");
      expect(metadata.keywords).toContain("სალონის პროგრამა");
      expect(metadata.keywords).toContain("ონლაინ ჯავშანი");
      expect(metadata.openGraph?.siteName).toBe("moarge");
      expect((metadata.twitter as { card?: string })?.card).toBe("summary_large_image");
      // A canonical in the root layout would make every page point at the home page.
      expect(metadata.alternates?.canonical).toBeUndefined();
    });

    it("has mobile-ready viewport configuration", () => {
      expect(viewport.width).toBe("device-width");
      expect(viewport.initialScale).toBe(1);
    });

    it("generates correct robots.txt and sitemap.xml routes", () => {
      const robotsRules = robots();
      expect(robotsRules.rules).toBeDefined();
      expect(robotsRules.sitemap).toBe("https://www.moarge.test/sitemap.xml");

      const sitemapEntries = sitemap();
      expect(sitemapEntries.length).toBeGreaterThanOrEqual(5);
      const urls = sitemapEntries.map((e) => e.url);
      expect(urls).toContain("https://www.moarge.test");
      expect(urls).not.toContain("https://www.moarge.test/book");
      expect(urls).not.toContain("https://www.moarge.test/login");
      expect(urls).toContain("https://www.moarge.test/salonis-programa");
      expect(new Set(urls).size).toBe(urls.length);

      const rule = Array.isArray(robotsRules.rules) ? robotsRules.rules[0] : robotsRules.rules;
      expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/dashboard", "/platform", "/settings"]));
      expect(urls).toContain("https://www.moarge.test/terms");
      expect(urls).toContain("https://www.moarge.test/privacy");
    });
  });

  describe("2. Smart Scheduling Engine & Availability", () => {
    it("generates exact hourly slots across salon operating schedule", () => {
      const slots = generateDynamicTimeSlots("10:00", "20:00", 60);
      expect(slots).toEqual([
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
        "19:00",
        "20:00",
      ]);
    });

    it("detects time conflicts with dynamic procedure duration", () => {
      const bookedTimes = ["12:00:00"];
      const candidateSlots = generateDynamicTimeSlots("10:00", "15:00", 60);

      // Exact match at 12:00 should conflict with 45m duration
      const checkConflict = evaluateSmartSlotAvailability(
        "12:00",
        bookedTimes,
        45,
        candidateSlots
      );
      expect(checkConflict.isAvailable).toBe(false);
      expect(checkConflict.conflictingTime).toBe("12:00");
      expect(checkConflict.availableSlots).toContain("10:00");
      expect(checkConflict.availableSlots).toContain("11:00");
      expect(checkConflict.availableSlots).toContain("13:00");
      expect(checkConflict.availableSlots).not.toContain("12:00");

      // Free slot at 14:00 should pass
      const checkFree = evaluateSmartSlotAvailability(
        "14:00",
        bookedTimes,
        45,
        candidateSlots
      );
      expect(checkFree.isAvailable).toBe(true);
      expect(checkFree.conflictingTime).toBeNull();
    });
  });

  describe("3. Public Booking Input Validation", () => {
    it("validates valid public appointment requests with custom service details", () => {
      const payload = {
        salon_slug: "malib-1b9bbc",
        full_name: "მარიამ დავითაშვილი",
        email: "mariam.d@example.com",
        phone: "+995 599 12 34 56",
        treatment_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        treatment_time: "14:00",
        treatment_type: "srv_wax_legs",
        service_id: "srv_wax_legs",
        service_name: "ცვილით დეპილაცია (მთლიანი ფეხები)",
        price_gel: 45,
        duration_minutes: 40,
        notes: "პირველი ვიზიტი",
        email_consent: true,
      };

      const result = publicBookingInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid emails and missing required fields", () => {
      const badPayload = {
        full_name: "A",
        email: "not-an-email",
        treatment_date: "invalid-date",
        treatment_time: "99:99",
      };

      const result = publicBookingInputSchema.safeParse(badPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("4. Showcase Demo Isolation & Zero Network/DB Leakage", () => {
    it("returns mock demo salon information when no slug is provided or slug is 'demo'", async () => {
      const { GET } = await import("../src/app/api/public/book/route");
      const req = new Request("http://localhost:3000/api/public/book");
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.found).toBe(true);
      expect(data.demo).toBe(true);
      expect(data.salon_name).toBe("moarge Demo Salon");
      expect(data.availability.booked_times).toEqual(["11:00:00", "15:00:00"]);
    });

    it("intercepts demo submissions and produces simulated confirmation without database writes or email dispatch", async () => {
      const { POST } = await import("../src/app/api/public/book/route");
      const req = new Request("http://localhost:3000/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salon_slug: "demo",
          full_name: "ტესტერ დემო",
          email: "demo.tester@example.com",
          phone: "+995 555 12 34 56",
          treatment_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          treatment_time: "12:00",
          treatment_type: "srv_laser_full",
          service_id: "srv_laser_full",
          email_consent: true,
        }),
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.demo).toBe(true);
      expect(data.booking).toBeDefined();
      expect(data.booking.salon_name).toContain("Demo Showcase");
      expect(data.booking.confirmation_email_sent).toBe(false);
    });
  });
});

