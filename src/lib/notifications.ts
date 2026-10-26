import { calculateRetryPlan, classifyEmailError } from "./scheduling";
import { BILLING_CONFIG } from "./billing-plans";
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

export function createUbilSmsProvider(options: {
  apiKey?: string;
  brandId?: string;
  fetcher?: typeof fetch;
} = {}): NotificationProvider {
  const apiKey = (options.apiKey ?? process.env.UBILL_API_KEY)?.trim();
  const brandId = (options.brandId ?? process.env.UBILL_BRAND_ID)?.trim();
  const fetcher = options.fetcher ?? fetch;
  return {
    async send(job) {
      if (!apiKey || !brandId || !/^\d+$/.test(brandId)) {
        const error = new Error("UBILL_API_KEY and UBILL_BRAND_ID must be configured.") as Error & { statusCode: number };
        error.statusCode = 503;
        throw error;
      }
      const number = job.recipient.replace(/\D/g, "");
      const response = await fetcher("https://api.ubill.dev/v1/sms/send", {
        method: "POST",
        headers: { key: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ brandID: Number(brandId), numbers: [number], text: job.body }),
      });
      const payload = await response.json().catch(() => ({})) as {
        statusID?: number;
        smsID?: string | number;
        message?: string;
      };
      if (!response.ok || payload.statusID !== 0 || payload.smsID == null) {
        const statusCode = response.status === 429 || response.status >= 500 ? response.status : 422;
        const error = new Error(payload.message || `uBill rejected SMS (status ${payload.statusID ?? response.status}).`) as Error & { statusCode: number };
        error.statusCode = statusCode;
        throw error;
      }
      return { id: String(payload.smsID), cost: BILLING_CONFIG.smsProviderCostGel };
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
