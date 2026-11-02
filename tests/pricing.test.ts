import { describe, expect, it } from "vitest";
import { PACKAGES, SMS_PACK_PRICE_GEL, currentOffer, formatGel, packagePrice } from "../src/lib/pricing";
import { pricingFaq } from "../src/lib/pricing-faq";

const [solo, business, multi] = PACKAGES;

describe("public prices", () => {
  it("match the agreed packages", () => {
    expect([solo.monthlyGel, business.monthlyGel, multi.monthlyGel]).toEqual([19, 59, 149]);
    expect(solo.smsIncluded).toBe(0);
    expect(business.staffIncluded).toBe(10);
    expect(multi.available).toBe(false);
    expect(SMS_PACK_PRICE_GEL).toBe(20);
  });

  it("discount 6 and 12 month payments", () => {
    expect(packagePrice(business, 1)).toEqual({ total: 59, perMonth: 59, discountPercent: 0 });
    expect(packagePrice(business, 6)).toEqual({ total: 318.6, perMonth: 53.1, discountPercent: 10 });
    expect(packagePrice(solo, 12)).toEqual({ total: 182.4, perMonth: 15.2, discountPercent: 20 });
  });

  it("write prices the Georgian way", () => {
    expect(formatGel(59)).toBe("59");
    expect(formatGel(102.6)).toBe("102.60");
    expect(formatGel(1000)).toBe("1 000");
    expect(formatGel(11940.5)).toBe("11 940.50");
  });

  it("switch from the free November to the 7-day trial at midnight Tbilisi time", () => {
    expect(currentOffer(new Date("2026-11-30T19:59:59Z"))).toMatchObject({ pilot: true, trialDays: 30, earlyBird: true, smsLive: false });
    expect(currentOffer(new Date("2026-11-30T20:00:00Z"))).toMatchObject({ pilot: false, trialDays: 7, earlyBird: true, smsLive: true });
    expect(currentOffer(new Date("2026-12-31T20:00:00Z"))).toMatchObject({ pilot: false, earlyBird: false });
  });

  it("keep the pricing FAQ free of em dashes", () => {
    for (const offer of [currentOffer(new Date("2026-11-15")), currentOffer(new Date("2026-12-15"))]) {
      expect(JSON.stringify(pricingFaq(offer))).not.toContain("—");
    }
  });
});
