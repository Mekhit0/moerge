import { describe, expect, it } from "vitest";
import {
  FakeNotificationProvider,
  processNotification,
  type NotificationJob,
  type NotificationMessageType,
} from "@/lib/notifications";
import { normalizeGeorgianPhone } from "@/lib/validation";

const messageTypes: NotificationMessageType[] = [
  "booking_confirmation",
  "reminder_24h",
  "reminder_2h",
  "cancel_confirmation",
  "reschedule_confirmation",
  "recall",
  "no_show_followup",
];

function job(overrides: Partial<NotificationJob> = {}): NotificationJob {
  return {
    id: "notification-id",
    salon_id: "salon-id",
    client_id: "client-id",
    appointment_id: "appointment-id",
    message_type: "booking_confirmation",
    channel: "email",
    language: "ka",
    recipient: "client@example.ge",
    subject: "Booking confirmed",
    body: "Your booking is confirmed.",
    attempt_count: 1,
    max_attempts: 5,
    idempotency_key: "idempotency-key",
    salon_name: "Salon",
    reply_to: "salon@example.ge",
    unsubscribe_url: "https://moarge.ge/unsubscribe?token=token&channel=email",
    client_allowed: true,
    client_archived: false,
    dry_run_mode: true,
    ...overrides,
  };
}

describe("notification provider pipeline", () => {
  it("normalizes Georgian mobile numbers to one salon identity", () => {
    expect(normalizeGeorgianPhone("555 12 34 56")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("995 555 12 34 56")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("+995 555 12 34 56")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("+1 555 12 34 56")).toBeNull();
  });

  it("sends each configured message type through the fake provider", async () => {
    const provider = new FakeNotificationProvider();
    for (const message_type of messageTypes) {
      const result = await processNotification(job({
        id: message_type,
        message_type,
        idempotency_key: `idempotency-${message_type}`,
      }), provider);
      expect(result.status).toBe("sent");
    }
    expect(provider.sent.map((item) => item.message_type)).toEqual(messageTypes);
  });

  it("retries temporary failures using backoff and sends idempotently", async () => {
    const provider = new FakeNotificationProvider(1);
    const fixedNow = new Date("2026-10-26T10:00:00.000Z");
    const first = await processNotification(job(), provider, fixedNow);
    expect(first.status).toBe("retry");
    expect(first.nextAttemptAt).toBe("2026-10-26T10:15:00.000Z");

    const second = await processNotification(job(), provider, fixedNow);
    expect(second.status).toBe("sent");
    const duplicate = await processNotification(job(), provider, fixedNow);
    expect(duplicate.providerMessageId).toBe(second.providerMessageId);
    expect(provider.sent).toHaveLength(1);
  });

  it("suppresses both channels after consent is withdrawn", async () => {
    const provider = new FakeNotificationProvider();
    const sms = await processNotification(job({ channel: "sms", client_allowed: false }), provider);
    const email = await processNotification(job({ client_allowed: false }), provider);
    expect(sms.status).toBe("suppressed");
    expect(email.status).toBe("suppressed");
    expect(provider.sent).toHaveLength(0);
  });
});
