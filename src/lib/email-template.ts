import { DEFAULT_EMAIL_BODY_TEMPLATE, DEFAULT_EMAIL_SUBJECT } from "./types";

export interface EmailTemplateRenderInput {
  clientName: string;
  salonName: string;
  bookingUrl: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  brandColor?: string;
  unsubscribeUrl?: string;
}

export interface RenderedReminderEmail {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Renders both plain-text and mobile-friendly branded HTML versions of the
 * 21-day epilation appointment reminder email.
 */
export function renderReminderEmail(
  input: EmailTemplateRenderInput
): RenderedReminderEmail {
  const clientName = input.clientName.trim() || "Valued Client";
  const salonName = input.salonName.trim() || "Our Salon";
  const bookingUrl = input.bookingUrl.trim() || "https://example.com/book";
  const brandColor =
    input.brandColor && /^#[0-9A-Fa-f]{6}$/.test(input.brandColor)
      ? input.brandColor
      : "#e11d48";
  const unsubscribeUrl =
    input.unsubscribeUrl?.trim() || "http://localhost:3000/unsubscribe";

  const rawSubject = input.subjectTemplate?.trim() || DEFAULT_EMAIL_SUBJECT;
  const rawBody = input.bodyTemplate?.trim() || DEFAULT_EMAIL_BODY_TEMPLATE;

  const replaceTokens = (str: string) =>
    str
      .replace(/\{\{\s*client_name\s*\}\}/gi, clientName)
      .replace(/\{\{\s*salon_name\s*\}\}/gi, salonName)
      .replace(/\{\{\s*booking_link\s*\}\}/gi, bookingUrl)
      .replace(/\{\{\s*unsubscribe_link\s*\}\}/gi, unsubscribeUrl);

  const subject = replaceTokens(rawSubject);
  const textBody = replaceTokens(rawBody);
  const fullText = `${textBody}\n\n---\nTo unsubscribe from future appointment reminder emails from ${salonName}, visit:\n${unsubscribeUrl}`;

  // Convert paragraphs to HTML while turning {{booking_link}} into a prominent CTA button
  const paragraphs = rawBody.split(/\n\s*\n/);
  const htmlParagraphs = paragraphs
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";

      if (trimmed === "{{booking_link}}") {
        const safeUrl = escapeHtml(bookingUrl);
        return `
          <div style="margin: 28px 0; text-align: center;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; background-color: ${brandColor}; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.25);">
              Book Your Next Appointment
            </a>
            <div style="margin-top: 10px; font-size: 12px; color: #78716c;">
              Or copy this link: <a href="${safeUrl}" style="color: ${brandColor}; text-decoration: underline;">${safeUrl}</a>
            </div>
          </div>
        `;
      }

      const escaped = escapeHtml(trimmed)
        .replace(/\{\{\s*client_name\s*\}\}/gi, escapeHtml(clientName))
        .replace(/\{\{\s*salon_name\s*\}\}/gi, escapeHtml(salonName))
        .replace(
          /\{\{\s*booking_link\s*\}\}/gi,
          `<a href="${escapeHtml(bookingUrl)}" style="color: ${brandColor}; font-weight: 600; text-decoration: underline;">${escapeHtml(bookingUrl)}</a>`
        )
        .replace(/\n/g, "<br />");

      return `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.65; color: #292524;">${escaped}</p>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fdf8f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #292524;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fdf8f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #fce7f3; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border-bottom: 1px solid #fecdd3; text-align: center;">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: #ffffff; color: ${brandColor}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px;">
                21-Day Care Reminder
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1c1917; letter-spacing: -0.02em;">
                ${escapeHtml(salonName)}
              </h1>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              ${htmlParagraphs}
            </td>
          </tr>
          <!-- Footer & Unsubscribe -->
          <tr>
            <td style="padding: 20px 32px; background-color: #fafaf9; border-top: 1px solid #f5f5f4; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #78716c; line-height: 1.5;">
                You received this email because you visited <strong>${escapeHtml(salonName)}</strong> for an epilation treatment and opted in to appointment care reminders.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a8a29e;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color: #78716c; text-decoration: underline;">Unsubscribe from future reminders</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject,
    text: fullText,
    html,
    unsubscribeUrl,
  };
}
