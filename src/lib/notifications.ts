import { calculateRetryPlan, classifyEmailError } from "./scheduling";
import { SMS_PROVIDER_COST_GEL, sendUbillSms, smsParts } from "./sms";
import { createResendTransport, platformSender, type EmailTransport } from "./reminder-worker";

export type NotificationChannel = "sms" | "email";
export type NotificationMessageType =
  | "booking_confirmation"
  | "reminder_24h"
  | "reminder_2h"
  | "cancel_confirmation"
  | "reschedule_confirmation"
  | "recall"
  | "no_show_followup";

export interface NotificationJob {
  id: string;
  salon_id: string;
  client_id: string;
  appointment_id: string | null;
  message_type: NotificationMessageType;
  channel: NotificationChannel;
  language: "ka" | "en";
  recipient: string;
  subject: string | null;
  body: string;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
  salon_name: string;
  reply_to: string;
  unsubscribe_url: string;
  client_allowed: boolean;
  client_archived: boolean;
  dry_run_mode: boolean;
  /** Billed SMS parts, set by the queue for SMS. */
  sms_parts?: number | null;
}

export interface NotificationProvider {
  send(job: NotificationJob): Promise<{ id: string; cost?: number | null }>;
}

export type NotificationProcessResult = {
  id: string;
  status: "sent" | "retry" | "failed" | "suppressed";
  providerMessageId: string | null;
  cost: number | null;
  error: string | null;
  nextAttemptAt: string | null;
};

export class FakeNotificationProvider implements NotificationProvider {
  readonly sent: NotificationJob[] = [];
  private readonly completedKeys = new Map<string, string>();
  constructor(private failuresRemaining = 0) {}

  async send(job: NotificationJob) {
    const prior = this.completedKeys.get(job.idempotency_key);
    if (prior) return { id: prior, cost: 0 };
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      const error = new Error("Fake provider temporary failure") as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    }
    this.sent.push(job);
    const id = `fake-${job.id}`;
    this.completedKeys.set(job.idempotency_key, id);
    return { id, cost: 0 };
  }
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function createEmailNotificationProvider(
  transport: EmailTransport | null = createResendTransport()
): NotificationProvider {
  return {
    async send(job) {
      if (!transport) {
        const error = new Error("RESEND_API_KEY is not configured.") as Error & { statusCode: number };
        error.statusCode = 503;
        throw error;
      }
      const url = job.unsubscribe_url;
      const text = job.body;
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${htmlEscape(text)}</div><p><a href="${htmlEscape(url)}">Unsubscribe</a></p>`;
      const result = await transport.sendEmail({
        from: platformSender(job.salon_name),
        replyTo: job.reply_to,
        to: job.recipient,
        subject: job.subject ?? job.salon_name,
        html,
        text: `${text}\n\nUnsubscribe: ${url}`,
        idempotencyKey: job.idempotency_key,
        unsubscribeUrl: url,
      });
      return { id: result.id };
    },
  };
}

/** SMS through uBill. Cost is what uBill charges: one price per SMS part. */
export function createUbilSmsProvider(options: {
  apiKey?: string;
  brandId?: string;
  fetcher?: typeof fetch;
} = {}): NotificationProvider {
  return {
    async send(job) {
      const result = await sendUbillSms({ number: job.recipient, text: job.body }, options);
      const parts = job.sms_parts ?? smsParts(job.body);
      return { id: result.id, cost: Math.round(parts * SMS_PROVIDER_COST_GEL * 10000) / 10000 };
    },
  };
}

export function createNotificationProvider(
  channel: NotificationChannel,
  options: { emailTransport?: EmailTransport | null; fetcher?: typeof fetch } = {}
): NotificationProvider {
  if (channel === "email") return createEmailNotificationProvider(options.emailTransport);
  return createUbilSmsProvider({ fetcher: options.fetcher });
}

export async function processNotification(
  job: NotificationJob,
  provider: NotificationProvider,
  now = new Date()
): Promise<NotificationProcessResult> {
  if (!job.client_allowed || job.client_archived) {
    return { id: job.id, status: "suppressed", providerMessageId: null, cost: null, error: "Consent withdrawn or client archived.", nextAttemptAt: null };
  }
  try {
    const result = await provider.send(job);
    return { id: job.id, status: "sent", providerMessageId: result.id, cost: result.cost ?? null, error: null, nextAttemptAt: null };
  } catch (cause) {
    const classified = classifyEmailError(cause);
    const retry = calculateRetryPlan(job.attempt_count, job.max_attempts, classified.isPermanent, now);
    return {
      id: job.id,
      status: retry.shouldRetry ? "retry" : "failed",
      providerMessageId: null,
      cost: null,
      error: classified.message,
      nextAttemptAt: retry.nextRetryAtIso,
    };
  }
}
