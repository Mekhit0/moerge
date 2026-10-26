import { Resend } from "resend";
import { renderReminderEmail } from "./email-template";
import { calculateRetryPlan, classifyEmailError } from "./scheduling";

export interface ClaimedReminderJob {
  reminder_id: string;
  salon_id: string;
  client_id: string;
  appointment_id: string;
  scheduled_for_date: string;
  scheduled_send_at: string;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  client_name: string;
  client_email: string;
  client_archived: boolean;
  client_consent: boolean;
  client_unsubscribed_at: string | null;
  unsubscribe_token: string;
  treatment_date: string;
  treatment_type: string;
  appointment_status: string;
  salon_name: string;
  sender_display_name: string;
  verified_sender_email: string;
  timezone: string;
  email_subject: string;
  email_body_template: string;
  booking_url: string;
  brand_color: string;
  dry_run_mode: boolean;
  test_recipient_email: string | null;
}

export interface SingleReminderProcessResult {
  reminderId: string;
  recipientEmail: string;
  outcome:
    | "api_accepted"
    | "dry_run_delivered"
    | "retry_scheduled"
    | "permanent_failure"
    | "canceled_suppressed";
  providerMessageId: string | null;
  isDryRun: boolean;
  errorMessage: string | null;
  nextRetryAtIso: string | null;
  statusCode: number;
}

export interface EmailTransport {
  sendEmail(params: {
    from: string;
    replyTo?: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
    unsubscribeUrl: string;
  }): Promise<{ id: string }>;
}

export function platformSender(salonName: string): string {
  const domain = process.env.RESEND_FROM_DOMAIN?.trim().toLowerCase();
  if (!domain || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) {
    throw new Error("Missing or invalid RESEND_FROM_DOMAIN environment variable.");
  }
  const safeName = salonName.replace(/[<>\"]/g, "").trim();
  return `"${safeName} via moarge" <no-reply@${domain}>`;
}

/**
 * Default Resend email transport using server-side RESEND_API_KEY.
 */
export function createResendTransport(): EmailTransport | null {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!key || !key.startsWith("re_")) {
    return null;
  }

  const resend = new Resend(key);

  return {
    async sendEmail({ from, replyTo, to, subject, html, text, idempotencyKey, unsubscribeUrl }) {
      const response = await resend.emails.send(
        {
          from,
          replyTo,
          to: [to],
          subject,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        },
        {
          idempotencyKey,
        }
      );

      if (response.error) {
        const err = new Error(response.error.message || "Resend API rejected email request") as Error & {
          statusCode?: number;
        };
        err.statusCode =
          (response.error as unknown as { statusCode?: number }).statusCode ?? 422;
        throw err;
      }

      if (!response.data?.id) {
        throw new Error("Resend API returned neither data.id nor error");
      }

      return { id: response.data.id };
    },
  };
}

/**
 * Processes a single claimed reminder job, handling suppression checks,
 * test-recipient redirection, dry-run simulation, Resend dispatch, and
 * temporary vs. permanent failure classification.
 */
export async function processClaimedReminder(
  job: ClaimedReminderJob,
  options: {
    transport?: EmailTransport | null;
    appBaseUrl?: string;
    envDryRun?: boolean;
    envTestRecipient?: string | null;
    now?: Date;
  } = {}
): Promise<SingleReminderProcessResult & { subject: string }> {
  const appBaseUrl = (
    options.appBaseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const unsubscribeUrl = `${appBaseUrl}/unsubscribe?token=${encodeURIComponent(
    job.unsubscribe_token
  )}`;

  const rendered = renderReminderEmail({
    clientName: job.client_name,
    salonName: job.salon_name,
    bookingUrl: job.booking_url,
    subjectTemplate: job.email_subject,
    bodyTemplate: job.email_body_template,
    brandColor: job.brand_color,
    unsubscribeUrl,
  });

  // 1. Check suppression rules before dispatching
  if (job.client_archived) {
    return {
      reminderId: job.reminder_id,
      recipientEmail: job.client_email,
      subject: rendered.subject,
      outcome: "canceled_suppressed",
      providerMessageId: null,
      isDryRun: false,
      errorMessage: "Suppressed: client profile is archived.",
      nextRetryAtIso: null,
      statusCode: 409,
    };
  }

  if (!job.client_consent || job.client_unsubscribed_at) {
    return {
      reminderId: job.reminder_id,
      recipientEmail: job.client_email,
      subject: rendered.subject,
      outcome: "canceled_suppressed",
      providerMessageId: null,
      isDryRun: false,
      errorMessage: "Suppressed: client unsubscribed or withdrew email consent.",
      nextRetryAtIso: null,
      statusCode: 409,
    };
  }

  if (job.appointment_status !== "completed") {
    return {
      reminderId: job.reminder_id,
      recipientEmail: job.client_email,
      subject: rendered.subject,
      outcome: "canceled_suppressed",
      providerMessageId: null,
      isDryRun: false,
      errorMessage: `Suppressed: associated appointment status is "${job.appointment_status}".`,
      nextRetryAtIso: null,
      statusCode: 409,
    };
  }

  // 2. Determine target recipient (support test-recipient override for safe testing)
  const testRecipient =
    (options.envTestRecipient ?? process.env.EMAIL_TEST_RECIPIENT ?? "").trim() ||
    (job.test_recipient_email ?? "").trim();

  const targetRecipientEmail = testRecipient || job.client_email;

  // 3. Determine whether Dry-Run Mode is active and resolve Resend transport
  const resolvedTransport =
    options.transport !== undefined
      ? options.transport
      : createResendTransport();

  const envDryRun =
    options.envDryRun ??
    (process.env.EMAIL_DRY_RUN?.toLowerCase() === "true");

  const isDryRun = Boolean(job.dry_run_mode || envDryRun || !resolvedTransport);

  if (isDryRun && !resolvedTransport) {
    const simulatedId = `dryrun_${job.reminder_id.slice(0, 8)}_${Date.now()}`;
    return {
      reminderId: job.reminder_id,
      recipientEmail: targetRecipientEmail,
      subject: rendered.subject,
      outcome: "dry_run_delivered",
      providerMessageId: simulatedId,
      isDryRun: true,
      errorMessage: null,
      nextRetryAtIso: null,
      statusCode: 200,
    };
  }

  if (!resolvedTransport) {
    // Live mode requested, but RESEND_API_KEY is missing
    const retryPlan = calculateRetryPlan(
      job.attempt_count,
      job.max_attempts,
      false,
      options.now
    );
    return {
      reminderId: job.reminder_id,
      recipientEmail: targetRecipientEmail,
      subject: rendered.subject,
      outcome: retryPlan.shouldRetry ? "retry_scheduled" : "permanent_failure",
      providerMessageId: null,
      isDryRun: false,
      errorMessage:
        "Resend API Key is not configured in Salon Settings or environment variables.",
      nextRetryAtIso: retryPlan.nextRetryAtIso,
      statusCode: 503,
    };
  }

  // 4. Send via Resend transport with deterministic attempt idempotency key
  const fromHeader = platformSender(job.salon_name);
  const attemptIdempotencyKey = `${job.idempotency_key}:attempt:${job.attempt_count}`;

  try {
    const res = await resolvedTransport.sendEmail({
      from: fromHeader,
      replyTo: job.verified_sender_email,
      to: targetRecipientEmail,
      subject: testRecipient
        ? `[TEST -> ${job.client_email}] ${rendered.subject}`
        : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: attemptIdempotencyKey,
      unsubscribeUrl,
    });

    return {
      reminderId: job.reminder_id,
      recipientEmail: targetRecipientEmail,
      subject: rendered.subject,
      outcome: "api_accepted",
      providerMessageId: res.id,
      isDryRun: false,
      errorMessage: null,
      nextRetryAtIso: null,
      statusCode: 200,
    };
  } catch (err) {
    const classified = classifyEmailError(err);
    const retryPlan = calculateRetryPlan(
      job.attempt_count,
      job.max_attempts,
      classified.isPermanent,
      options.now
    );

    return {
      reminderId: job.reminder_id,
      recipientEmail: targetRecipientEmail,
      subject: rendered.subject,
      outcome: retryPlan.shouldRetry ? "retry_scheduled" : "permanent_failure",
      providerMessageId: null,
      isDryRun: false,
      errorMessage: classified.message,
      nextRetryAtIso: retryPlan.nextRetryAtIso,
      statusCode: classified.statusCode,
    };
  }
}
