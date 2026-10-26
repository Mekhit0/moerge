import { describe, it, expect, vi } from "vitest";
import { Webhook } from "svix";
import {
  addCalendarDays,
  calculateReminderSchedule,
  calculateRetryPlan,
  checkReminderEligibility,
  classifyEmailError,
  evaluateSmartSlotAvailability,
  generateReminderIdempotencyKey,
  planReminderReconciliation,
  zonedDateTimeToUtc,
} from "../src/lib/scheduling";
import {
  GEORGIAN_DEFAULT_EMAIL_BODY,
  GEORGIAN_DEFAULT_EMAIL_SUBJECT,
  TREATMENT_LABELS_I18N,
} from "../src/lib/i18n";
import {
  appointmentInputSchema,
  clientInputSchema,
  isValidCalendarDate,
  isValidEmailAddress,
  isValidTimeZone,
  normalizeEmail,
  salonSettingsSchema,
} from "../src/lib/validation";
import {
  ClaimedReminderJob,
  EmailTransport,
  processClaimedReminder,
} from "../src/lib/reminder-worker";
import {
  parseResendPayloadObject,
  verifyAndParseResendWebhook,
} from "../src/lib/webhook-processor";
import { renderReminderEmail } from "../src/lib/email-template";
import { checkRateLimit, resetRateLimitBuckets } from "../src/lib/rate-limit";

describe("Salon Appointment Reminder System - Comprehensive Test Suite", () => {
  // 1. Calculating the date 21 days after an appointment
  describe("1. 21-Day Reminder Date Calculation", () => {
    it("calculates exactly 21 calendar days after a standard treatment date", () => {
      expect(addCalendarDays("2026-10-01", 21)).toBe("2026-10-22");
      expect(addCalendarDays("2026-05-10", 21)).toBe("2026-05-31");
    });

    it("rolls over month and year boundaries accurately", () => {
      expect(addCalendarDays("2026-10-20", 21)).toBe("2026-11-10");
      expect(addCalendarDays("2026-12-15", 21)).toBe("2027-01-05");
    });

    it("handles leap year vs non-leap year February boundaries accurately", () => {
      // 2024 is a leap year (Feb has 29 days)
      expect(addCalendarDays("2024-02-15", 21)).toBe("2024-03-07");
      // 2026 is not a leap year (Feb has 28 days)
      expect(addCalendarDays("2026-02-15", 21)).toBe("2026-03-08");
    });
  });

  // 2. Correct handling of time zones and date boundaries
  describe("2. Time Zone & Date Boundary Handling", () => {
    it("computes 09:00 local salon time in America/New_York (EDT vs EST across DST boundary)", () => {
      // Before Nov 1, 2026 DST fallback: 2026-10-01 with 21-day cycle -> reminder sent 1 day before (20 days) = 2026-10-21 (EDT UTC-4) -> 09:00 EDT = 13:00 UTC
      const edtSchedule = calculateReminderSchedule(
        "2026-10-01",
        21,
        "America/New_York",
        9
      );
      expect(edtSchedule.scheduledForDate).toBe("2026-10-21");
      expect(edtSchedule.procedureDueDate).toBe("2026-10-22");
      expect(edtSchedule.scheduledSendAtIso).toBe("2026-10-21T13:00:00.000Z");

      // After Nov 1, 2026 DST fallback: 2026-10-20 with 21-day cycle -> reminder sent 1 day before (20 days) = 2026-11-09 (EST UTC-5) -> 09:00 EST = 14:00 UTC
      const estSchedule = calculateReminderSchedule(
        "2026-10-20",
        21,
        "America/New_York",
        9
      );
      expect(estSchedule.scheduledForDate).toBe("2026-11-09");
      expect(estSchedule.procedureDueDate).toBe("2026-11-10");
      expect(estSchedule.scheduledSendAtIso).toBe("2026-11-09T14:00:00.000Z");
    });

    it("computes 09:00 local salon time in Asia/Tbilisi (UTC+4) and Europe/Paris", () => {
      const tbilisi = zonedDateTimeToUtc("2026-11-05", "Asia/Tbilisi", 9, 0);
      expect(tbilisi.toISOString()).toBe("2026-11-05T05:00:00.000Z");

      const parisWinter = zonedDateTimeToUtc("2026-11-15", "Europe/Paris", 9, 0);
      expect(parisWinter.toISOString()).toBe("2026-11-15T08:00:00.000Z");
    });

    it("rejects invalid IANA time zones and invalid calendar dates", () => {
      expect(isValidTimeZone("America/New_York")).toBe(true);
      expect(isValidTimeZone("Invalid/Timezone_Name")).toBe(false);
      expect(isValidCalendarDate("2026-02-29")).toBe(false);
      expect(isValidCalendarDate("2024-02-29")).toBe(true);
      expect(() =>
        calculateReminderSchedule("2026-10-01", 21, "Mars/Phobos")
      ).toThrow(/Invalid salon time zone/);
    });
  });

  // 3. Creating reminders only for eligible completed appointments
  describe("3. Eligibility Rules for Completed Epilation Appointments", () => {
    const activeClient = {
      is_archived: false,
      email_consent: true,
      unsubscribed_at: null,
    };

    it("approves completed epilation treatments (epilation, laser, wax, sugaring)", () => {
      for (const type of [
        "epilation",
        "laser_epilation",
        "wax_epilation",
        "sugaring_epilation",
      ] as const) {
        const res = checkReminderEligibility(
          { status: "completed", treatment_type: type },
          activeClient
        );
        expect(res.eligible).toBe(true);
      }
    });

    it("rejects non-completed epilation appointments (scheduled, missed, canceled)", () => {
      for (const status of ["scheduled", "missed", "canceled"] as const) {
        const res = checkReminderEligibility(
          { status, treatment_type: "laser_epilation" },
          activeClient
        );
        expect(res.eligible).toBe(false);
      }
    });

    it("rejects completed non-epilation appointments (facial, massage, manicure)", () => {
      for (const type of ["facial", "massage", "manicure", "consultation"] as const) {
        const res = checkReminderEligibility(
          { status: "completed", treatment_type: type },
          activeClient
        );
        expect(res.eligible).toBe(false);
        expect(res.reason).toContain("Only epilation appointments");
      }
    });

    it("rejects archived or unsubscribed clients", () => {
      expect(
        checkReminderEligibility(
          { status: "completed", treatment_type: "epilation" },
          { is_archived: true, email_consent: true }
        ).eligible
      ).toBe(false);

      expect(
        checkReminderEligibility(
          { status: "completed", treatment_type: "epilation" },
          { is_archived: false, email_consent: false }
        ).eligible
      ).toBe(false);
    });
  });

  // 4. Editing, rescheduling, and canceling appointments
  describe("4. Appointment Editing, Rescheduling & Cancellation Reconciliation", () => {
    const salonId = "11111111-1111-4111-8111-111111111111";
    const appointmentId = "d1111111-1111-4111-8111-111111111111";
    const activeClient = {
      is_archived: false,
      email_consent: true,
      unsubscribed_at: null,
    };

    it("creates a new reminder when an eligible appointment is marked completed", () => {
      const action = planReminderReconciliation({
        salonId,
        appointmentId,
        treatmentDate: "2026-10-01",
        treatmentType: "laser_epilation",
        status: "completed",
        client: activeClient,
        existingReminders: [],
        intervalDays: 21,
        timeZone: "UTC",
      });

      expect(action.action).toBe("create");
      if (action.action === "create") {
        expect(action.scheduledForDate).toBe("2026-10-21");
        expect(action.idempotencyKey).toBe(
          `rem:${salonId}:${appointmentId}:2026-10-21`
        );
      }
    });

    it("updates existing scheduled reminder in-place when treatment date is edited (no duplicate created)", () => {
      const action = planReminderReconciliation({
        salonId,
        appointmentId,
        treatmentDate: "2026-10-05",
        treatmentType: "laser_epilation",
        status: "completed",
        client: activeClient,
        existingReminders: [
          {
            id: "rem-existing-1",
            status: "scheduled",
            scheduled_for_date: "2026-10-21",
            scheduled_send_at: "2026-10-21T09:00:00.000Z",
            idempotency_key: `rem:${salonId}:${appointmentId}:2026-10-21`,
          },
        ],
        intervalDays: 21,
        timeZone: "UTC",
      });

      expect(action.action).toBe("update_existing");
      if (action.action === "update_existing") {
        expect(action.reminderId).toBe("rem-existing-1");
        expect(action.scheduledForDate).toBe("2026-10-25");
      }
    });

    it("cancels existing scheduled reminder when appointment is canceled or marked missed", () => {
      const action = planReminderReconciliation({
        salonId,
        appointmentId,
        treatmentDate: "2026-10-01",
        treatmentType: "laser_epilation",
        status: "canceled",
        client: activeClient,
        existingReminders: [
          {
            id: "rem-existing-1",
            status: "scheduled",
            scheduled_for_date: "2026-10-22",
            scheduled_send_at: "2026-10-22T09:00:00.000Z",
            idempotency_key: `rem:${salonId}:${appointmentId}:2026-10-22`,
          },
        ],
      });

      expect(action.action).toBe("cancel_existing");
      if (action.action === "cancel_existing") {
        expect(action.reminderId).toBe("rem-existing-1");
      }
    });
  });

  // 5. Preventing duplicate reminders and duplicate sends
  describe("5. Duplicate Reminder & Duplicate Send Prevention", () => {
    const salonId = "11111111-1111-4111-8111-111111111111";
    const appointmentId = "d2222222-2222-4222-8222-222222222222";

    it("returns noop when an appointment is saved again with identical date and already has a scheduled reminder", () => {
      const key = generateReminderIdempotencyKey(
        salonId,
        appointmentId,
        "2026-10-21"
      );
      const action = planReminderReconciliation({
        salonId,
        appointmentId,
        treatmentDate: "2026-10-01",
        treatmentType: "epilation",
        status: "completed",
        client: { is_archived: false, email_consent: true },
        existingReminders: [
          {
            id: "rem-1",
            status: "scheduled",
            scheduled_for_date: "2026-10-21",
            scheduled_send_at: "2026-10-21T09:00:00.000Z",
            idempotency_key: key,
          },
        ],
      });

      expect(action.action).toBe("noop");
    });

    it("prevents creating a second reminder if a reminder was already sent or delivered for the appointment", () => {
      const action = planReminderReconciliation({
        salonId,
        appointmentId,
        treatmentDate: "2026-10-03",
        treatmentType: "epilation",
        status: "completed",
        client: { is_archived: false, email_consent: true },
        existingReminders: [
          {
            id: "rem-sent-1",
            status: "delivered",
            scheduled_for_date: "2026-10-22",
            scheduled_send_at: "2026-10-22T09:00:00.000Z",
            idempotency_key: "rem:key:1",
          },
        ],
      });

      expect(action.action).toBe("noop");
      if (action.action === "noop") {
        expect(action.reason).toContain("already been delivered");
      }
    });
  });

  // 6 & 7. Handling temporary/permanent email failures and retrying failed jobs safely
  describe("6 & 7. Temporary vs. Permanent Failure Handling & Safe Retry Backoff", () => {
    const baseJob: ClaimedReminderJob = {
      reminder_id: "e1111111-1111-4111-8111-111111111111",
      salon_id: "11111111-1111-4111-8111-111111111111",
      client_id: "c1111111-1111-4111-8111-111111111111",
      appointment_id: "d1111111-1111-4111-8111-111111111111",
      scheduled_for_date: "2026-10-22",
      scheduled_send_at: "2026-10-22T13:00:00.000Z",
      idempotency_key: "rem:salon:appt:2026-10-22",
      attempt_count: 1,
      max_attempts: 3,
      client_name: "Sophia Beaumont",
      client_email: "sophia@example.com",
      client_archived: false,
      client_consent: true,
      client_unsubscribed_at: null,
      unsubscribe_token: "f1111111-1111-4111-8111-111111111111",
      treatment_date: "2026-10-01",
      treatment_type: "laser_epilation",
      appointment_status: "completed",
      salon_name: "moarge Demo Salon",
      sender_display_name: "moarge Demo Salon",
      verified_sender_email: "reminders@example.com",
      timezone: "America/New_York",
      email_subject: "It's time to book your next epilation appointment!",
      email_body_template:
        "Hi {{client_name}}, book at {{booking_link}} with {{salon_name}}!",
      booking_url: "https://example.com/book",
      brand_color: "#e11d48",
      dry_run_mode: false,
      test_recipient_email: null,
    };

    it("schedules exponential backoff retry on temporary 503/timeout failure", async () => {
      const failingTransport: EmailTransport = {
        sendEmail: vi.fn().mockRejectedValue(
          Object.assign(new Error("Upstream gateway timeout"), {
            statusCode: 503,
          })
        ),
      };

      const fixedNow = new Date("2026-10-22T13:00:00.000Z");
      const result = await processClaimedReminder(baseJob, {
        transport: failingTransport,
        envDryRun: false,
        now: fixedNow,
      });

      expect(result.outcome).toBe("retry_scheduled");
      expect(result.nextRetryAtIso).toBe("2026-10-22T13:15:00.000Z"); // +15 min for attempt 1
      expect(result.statusCode).toBe(503);
    });

    it("marks permanent failure immediately without retry on 422 invalid email / unverified domain", async () => {
      const permanentFailTransport: EmailTransport = {
        sendEmail: vi.fn().mockRejectedValue(
          Object.assign(
            new Error("The example.com domain is not verified"),
            { statusCode: 422 }
          )
        ),
      };

      const result = await processClaimedReminder(baseJob, {
        transport: permanentFailTransport,
        envDryRun: false,
      });

      expect(result.outcome).toBe("permanent_failure");
      expect(result.nextRetryAtIso).toBeNull();
    });

    it("stops retrying when attemptCount reaches maxAttempts (3)", () => {
      const plan1 = calculateRetryPlan(1, 3, false);
      expect(plan1.shouldRetry).toBe(true);
      expect(plan1.delayMinutes).toBe(15);

      const plan2 = calculateRetryPlan(2, 3, false);
      expect(plan2.shouldRetry).toBe(true);
      expect(plan2.delayMinutes).toBe(60);

      const plan3 = calculateRetryPlan(3, 3, false);
      expect(plan3.shouldRetry).toBe(false);
      expect(plan3.nextRetryAtIso).toBeNull();
    });

    it("records api_accepted (not delivered) when Resend accepts the email request", async () => {
      const successTransport: EmailTransport = {
        sendEmail: vi.fn().mockResolvedValue({ id: "re_msg_live_12345" }),
      };

      const result = await processClaimedReminder(baseJob, {
        transport: successTransport,
        envDryRun: false,
      });

      expect(result.outcome).toBe("api_accepted");
      expect(result.providerMessageId).toBe("re_msg_live_12345");
      expect(successTransport.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "rem:salon:appt:2026-10-22:attempt:1",
          to: "sophia@example.com",
        })
      );
    });

    it("supports safe dry-run mode and test-recipient override without emailing real clients", async () => {
      const result = await processClaimedReminder(
        {
          ...baseJob,
          dry_run_mode: true,
          test_recipient_email: "qa-safe@example.com",
        },
        { transport: null, envDryRun: true }
      );

      expect(result.outcome).toBe("dry_run_delivered");
      expect(result.isDryRun).toBe(true);
      expect(result.recipientEmail).toBe("qa-safe@example.com");
    });
  });

  // 8. Enforcing salon-level access controls & rate limiting
  describe("8. Security, Unsubscribe Suppression & Rate Limiting", () => {
    it("suppresses sending if client unsubscribed or was archived after scheduling", async () => {
      const unsubscribedJob: ClaimedReminderJob = {
        reminder_id: "e999",
        salon_id: "11111111-1111-4111-8111-111111111111",
        client_id: "c999",
        appointment_id: "d999",
        scheduled_for_date: "2026-10-22",
        scheduled_send_at: "2026-10-22T13:00:00.000Z",
        idempotency_key: "rem:999",
        attempt_count: 1,
        max_attempts: 3,
        client_name: "Opted Out Client",
        client_email: "optout@example.com",
        client_archived: false,
        client_consent: false,
        client_unsubscribed_at: "2026-10-10T00:00:00.000Z",
        unsubscribe_token: "f9999999-9999-4999-8999-999999999999",
        treatment_date: "2026-10-01",
        treatment_type: "epilation",
        appointment_status: "completed",
        salon_name: "moarge Demo Salon",
        sender_display_name: "moarge Demo Salon",
        verified_sender_email: "reminders@example.com",
        timezone: "UTC",
        email_subject: "Reminder",
        email_body_template: "Hi {{client_name}}, {{booking_link}}",
        booking_url: "https://example.com/book",
        brand_color: "#e11d48",
        dry_run_mode: false,
        test_recipient_email: null,
      };

      const res = await processClaimedReminder(unsubscribedJob);
      expect(res.outcome).toBe("canceled_suppressed");
    });

    it("enforces sliding-window rate limits on sensitive endpoints", () => {
      resetRateLimitBuckets();
      expect(checkRateLimit("ip:1", 2, 60_000, 1000).allowed).toBe(true);
      expect(checkRateLimit("ip:1", 2, 60_000, 1001).allowed).toBe(true);
      expect(checkRateLimit("ip:1", 2, 60_000, 1002).allowed).toBe(false);
    });
  });

  // 9. Validating email addresses and required fields
  describe("9. Input Validation & Pre-Flight Settings Validation", () => {
    it("normalizes and validates client email addresses and required fields", () => {
      expect(normalizeEmail("  Sophia.Beaumont@Example.COM ")).toBe(
        "sophia.beaumont@example.com"
      );
      expect(isValidEmailAddress("valid.client+tag@salon.co")).toBe(true);
      expect(isValidEmailAddress("invalid..dots@salon.co")).toBe(false);
      expect(isValidEmailAddress("missing-domain@")).toBe(false);

      const validClient = clientInputSchema.safeParse({
        full_name: "Sophia Beaumont",
        email: "Sophia@Example.com",
        phone: "",
      });
      expect(validClient.success).toBe(true);
      if (validClient.success) {
        expect(validClient.data.email).toBe("sophia@example.com");
        expect(validClient.data.phone).toBeNull();
      }
    });

    it("validates salon settings before enabling automatic sending", () => {
      const invalidPlaceholderSender = salonSettingsSchema.safeParse({
        salon_name: "moarge Demo Salon",
        sender_display_name: "moarge Demo Salon",
        verified_sender_email: "test@example.com",
        timezone: "America/New_York",
        reminder_interval_days: 21,
        email_subject: "It's time to book your next epilation appointment!",
        email_body_template:
          "Hi {{client_name}}, book your next session here: {{booking_link}}",
        booking_url: "https://example.com/book",
        brand_color: "#e11d48",
        auto_reminders_enabled: true,
        dry_run_mode: false,
      });

      expect(invalidPlaceholderSender.success).toBe(false);
    });

    it("renders customizable email template with salon branding and unsubscribe link", () => {
      const rendered = renderReminderEmail({
        clientName: "Elena Rostova",
        salonName: "moarge Demo Salon",
        bookingUrl: "https://example.com/book",
        unsubscribeUrl: "https://example.com/unsubscribe?token=123",
      });

      expect(rendered.subject).toBe(
        "It's time to book your next epilation appointment!"
      );
      expect(rendered.text).toContain("Hi Elena Rostova,");
      expect(rendered.text).toContain("https://example.com/book");
      expect(rendered.text).toContain("moarge Demo Salon Team");
      expect(rendered.html).toContain("Book Your Next Appointment");
      expect(rendered.html).toContain("Unsubscribe from future reminders");
    });
  });

  // 10. Processing provider webhooks
  describe("10. Resend Provider Webhook Verification & Event Processing", () => {
    it("verifies authentic Svix webhook signatures and parses delivery/bounce payloads", () => {
      const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
      const wh = new Webhook(secret);
      const msgId = "msg_2b4x8z9";
      const timestamp = new Date();
      const rawBody = JSON.stringify({
        type: "email.delivered",
        created_at: timestamp.toISOString(),
        data: {
          email_id: msgId,
          to: ["sophia.beaumont@example.com"],
        },
      });

      const signature = wh.sign(msgId, timestamp, rawBody);

      const parsed = verifyAndParseResendWebhook({
        rawBody,
        headers: {
          svixId: msgId,
          svixTimestamp: String(Math.floor(timestamp.getTime() / 1000)),
          svixSignature: signature,
        },
        webhookSecret: secret,
      });

      expect(parsed.type).toBe("email.delivered");
      expect(parsed.providerMessageId).toBe(msgId);
      expect(parsed.recipientEmail).toBe("sophia.beaumont@example.com");
    });

    it("rejects tampered webhook signatures", () => {
      const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
      expect(() =>
        verifyAndParseResendWebhook({
          rawBody: JSON.stringify({
            type: "email.delivered",
            data: { email_id: "123" },
          }),
          headers: {
            svixId: "msg_123",
            svixTimestamp: String(Math.floor(Date.now() / 1000)),
            svixSignature: "v1,invalidSignatureString==",
          },
          webhookSecret: secret,
        })
      ).toThrow();
    });

    it("parses bounce events and extracts bounce failure reasons", () => {
      const bounceEvent = parseResendPayloadObject({
        type: "email.bounced",
        created_at: "2026-10-22T14:00:00.000Z",
        data: {
          email_id: "re_msg_bounce_99",
          to: ["bounced@example.com"],
          bounce: {
            message: "550 5.1.1 The email account that you tried to reach does not exist",
          },
        },
      });

      expect(bounceEvent.type).toBe("email.bounced");
      expect(bounceEvent.providerMessageId).toBe("re_msg_bounce_99");
      expect(bounceEvent.errorMessage).toContain("550 5.1.1");
    });
  });

  // 11. Smart Time-Slot Availability & Georgian (ქართული) Localization
  describe("11. Smart Time-Slot Availability & Georgian Localization", () => {
    it("detects exact and 45-minute buffer conflicts and returns suggested available slots", () => {
      const booked = ["10:30:00", "14:30"];

      // Exact conflict at 10:30
      const exactCheck = evaluateSmartSlotAvailability("10:30", booked, 45);
      expect(exactCheck.isAvailable).toBe(false);
      expect(exactCheck.conflictingTime).toBe("10:30");
      expect(exactCheck.bookedSlots).toContain("10:30");
      expect(exactCheck.bookedSlots).toContain("14:30");
      expect(exactCheck.availableSlots).toContain("09:30");
      expect(exactCheck.availableSlots).toContain("11:30");
      expect(exactCheck.availableSlots).not.toContain("10:30");

      // Buffer conflict within 45 minutes (e.g. 10:50 is 20 mins after 10:30)
      const bufferCheck = evaluateSmartSlotAvailability("10:50", booked, 45);
      expect(bufferCheck.isAvailable).toBe(false);
      expect(bufferCheck.conflictingTime).toBe("10:30");

      // Free slot at 11:30 (60 mins after 10:30)
      const freeCheck = evaluateSmartSlotAvailability("11:30", booked, 45);
      expect(freeCheck.isAvailable).toBe(true);
      expect(freeCheck.conflictingTime).toBeNull();
    });

    it("renders Georgian 21-day reminder email template and localized treatment labels", () => {
      expect(TREATMENT_LABELS_I18N.ka.laser_epilation).toContain("ლაზერული ეპილაცია");
      expect(TREATMENT_LABELS_I18N.en.laser_epilation).toBe("Diode Laser Epilation");

      const renderedKa = renderReminderEmail({
        clientName: "ნინო ბერიძე",
        salonName: "moarge Demo Salon",
        bookingUrl: "https://example.com/book",
        subjectTemplate: GEORGIAN_DEFAULT_EMAIL_SUBJECT,
        bodyTemplate: GEORGIAN_DEFAULT_EMAIL_BODY,
      });

      expect(renderedKa.subject).toBe(
        "დროა დაჯავშნოთ თქვენი შემდეგი ეპილაციის ვიზიტი!"
      );
      expect(renderedKa.text).toContain("გამარჯობა ნინო ბერიძე,");
      expect(renderedKa.text).toContain("21 დღე");
      expect(renderedKa.text).toContain("https://example.com/book");
    });
  });
});
