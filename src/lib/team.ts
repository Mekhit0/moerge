import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { platformSender } from "./reminder-worker";

/** Invite links carry 32 random bytes; only their SHA-256 hash is stored. */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

const ROLE_KA = { admin: "ადმინისტრატორად", staff: "სპეციალისტად" } as const;
const ROLE_EN = { admin: "an admin", staff: "a specialist" } as const;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Sends the invite link by email when Resend is configured. Returns false when email is not set up
 * or the provider refuses, so the owner can still share the link by Viber or WhatsApp.
 */
export async function sendInviteEmail(input: { to: string; salonName: string; role: "admin" | "staff"; link: string; idempotencyKey: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!key.startsWith("re_")) return false;
  let from: string;
  try {
    from = platformSender(input.salonName);
  } catch {
    return false;
  }
  const text = [
    `გამარჯობა! ${input.salonName} გიწვევთ moarge-ში ${ROLE_KA[input.role]}.`,
    `გახსენით ბმული და შექმენით პაროლი: ${input.link}`,
    "ბმული მოქმედებს 7 დღე.",
    "",
    `Hello! ${input.salonName} invites you to moarge as ${ROLE_EN[input.role]}.`,
    `Open the link and create a password: ${input.link}`,
    "The link works for 7 days.",
  ].join("\n");
  const link = escapeHtml(input.link);
  const salon = escapeHtml(input.salonName);
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917">
<p>გამარჯობა! <strong>${salon}</strong> გიწვევთ moarge-ში ${ROLE_KA[input.role]}.</p>
<p><a href="${link}" style="display:inline-block;background:#e11d48;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">მოწვევის მიღება</a></p>
<p style="color:#78716c;font-size:13px">ბმული მოქმედებს 7 დღე.</p>
<hr style="border:none;border-top:1px solid #e7e5e4">
<p style="color:#78716c;font-size:13px">${salon} invites you to moarge as ${ROLE_EN[input.role]}. <a href="${link}">Accept the invitation</a>. The link works for 7 days.</p>
</div>`;
  try {
    const result = await new Resend(key).emails.send(
      { from, to: [input.to], subject: `${input.salonName}: მოწვევა moarge-ში / Invitation`, html, text },
      { idempotencyKey: input.idempotencyKey },
    );
    return !result.error;
  } catch {
    return false;
  }
}
