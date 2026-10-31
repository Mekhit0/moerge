import { describe, expect, it } from "vitest";
import { PUBLIC_BOOKING_LIMITS, publicBookingGuardError } from "../src/lib/booking-guard";
import { formatBookingCode } from "../src/lib/booking-code";
import { bookingLookupSchema, isPlaceholderReplyEmail } from "../src/lib/validation";

describe("public booking guard", () => {
  it("allows a phone with no block and few upcoming bookings", () => {
    expect(publicBookingGuardError({ blocked: false, upcoming: 0 })).toBeNull();
    expect(publicBookingGuardError({ blocked: false, upcoming: PUBLIC_BOOKING_LIMITS.upcomingPerPhonePerSalon - 1 })).toBeNull();
  });

  it("stops blocked numbers and numbers at the upcoming-booking limit", () => {
    expect(publicBookingGuardError({ blocked: true, upcoming: 0 })).toMatch(/not available for this number/);
    expect(publicBookingGuardError({ blocked: false, upcoming: PUBLIC_BOOKING_LIMITS.upcomingPerPhonePerSalon })).toMatch(/upcoming bookings/);
  });
});

describe("booking lookup input", () => {
  it("accepts a 6-digit code with spaces and a Georgian mobile number", () => {
    const parsed = bookingLookupSchema.safeParse({ code: "123 456", phone: "555 12 34 56" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.code).toBe("123456");
  });

  it("rejects short codes and non-Georgian numbers", () => {
    expect(bookingLookupSchema.safeParse({ code: "12345", phone: "555123456" }).success).toBe(false);
    expect(bookingLookupSchema.safeParse({ code: "123456", phone: "+1 202 555 0100" }).success).toBe(false);
  });

  it("formats codes for reading out loud", () => {
    expect(formatBookingCode("123456")).toBe("123 456");
    expect(formatBookingCode(null)).toBe("");
  });
});

describe("reply address placeholder", () => {
  it("treats the signup defaults as placeholders", () => {
    expect(isPlaceholderReplyEmail("onboarding@resend.dev")).toBe(true);
    expect(isPlaceholderReplyEmail("reminders@example.com")).toBe(true);
    expect(isPlaceholderReplyEmail("")).toBe(true);
    expect(isPlaceholderReplyEmail("nino@gmail.com")).toBe(false);
  });
});
