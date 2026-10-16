import { Webhook } from "svix";

export type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained";

export interface ParsedResendWebhookEvent {
  type: ResendWebhookEventType;
  providerMessageId: string;
  recipientEmail: string | null;
  errorMessage: string | null;
  createdAt: string;
  rawPayload: Record<string, unknown>;
}

/**
 * Verifies the cryptographic signature of an incoming Resend (Svix) webhook
 * and parses the delivery/bounce/complaint payload.
 */
export function verifyAndParseResendWebhook(params: {
  rawBody: string;
  headers: {
    svixId: string | null;
    svixTimestamp: string | null;
    svixSignature: string | null;
  };
  webhookSecret?: string | null;
}): ParsedResendWebhookEvent {
  const { rawBody, headers, webhookSecret } = params;
  const secret = (webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET ?? "").trim();

  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured on the server.");
  }

  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) {
    throw new Error("Missing required Svix webhook signature headers.");
  }

  const wh = new Webhook(secret);
  const verifiedPayload = wh.verify(rawBody, {
    "svix-id": headers.svixId,
    "svix-timestamp": headers.svixTimestamp,
    "svix-signature": headers.svixSignature,
  }) as Record<string, unknown>;

  return parseResendPayloadObject(verifiedPayload);
}

/**
 * Parses a verified Resend webhook payload object into normalized fields.
 */
export function parseResendPayloadObject(
  payload: Record<string, unknown>
): ParsedResendWebhookEvent {
  const type = String(payload.type ?? "") as ResendWebhookEventType;
  const validTypes: ResendWebhookEventType[] = [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
  ];

  if (!validTypes.includes(type)) {
    throw new Error(`Unsupported Resend webhook event type: "${type}"`);
  }

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const providerMessageId = String(data.email_id ?? data.id ?? "").trim();

  if (!providerMessageId) {
    throw new Error("Webhook payload missing data.email_id");
  }

  const toField = data.to;
  const recipientEmail = Array.isArray(toField)
    ? String(toField[0] ?? "")
    : typeof toField === "string"
    ? toField
    : null;

  const bounceObj = (data.bounce ?? {}) as Record<string, unknown>;
  const errorMessage =
    typeof bounceObj.message === "string"
      ? bounceObj.message
      : typeof data.reason === "string"
      ? data.reason
      : type === "email.bounced"
      ? "Email bounced at recipient mail server"
      : type === "email.complained"
      ? "Recipient reported email as spam"
      : null;

  return {
    type,
    providerMessageId,
    recipientEmail,
    errorMessage,
    createdAt: String(payload.created_at ?? new Date().toISOString()),
    rawPayload: payload,
  };
}
