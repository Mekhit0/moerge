import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { platformSender } from "./reminder-worker";
import { appUrl } from "./app-url";
import { SUPPORT_EMAIL } from "./contact";

const ALERT_EVERY_MS = 60 * 60 * 1000;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * At most one email an hour about new errors, to the platform owner. Called from the reminder run,
 * which happens every 10 minutes. Returns how many errors the email covered (0 when none was sent).
 */
export async function sendErrorDigest(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - ALERT_EVERY_MS).toISOString();
  const [{ count: recentAlerts }, { data: fresh }] = await Promise.all([
    db.from("app_errors").select("id", { count: "exact", head: true }).gte("alerted_at", since),
    db.from("app_errors").select("id,source,message,path,created_at").is("alerted_at", null).order("created_at", { ascending: false }).limit(200),
  ]);
  if (!fresh?.length || (recentAlerts ?? 0) > 0) return 0;

  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!key.startsWith("re_")) return 0;
  let from: string;
  try { from = platformSender("moarge"); } catch { return 0; }

  // Group the same message so one broken page does not fill the email.
  const groups = new Map<string, { source: string; message: string; path: string | null; count: number }>();
  for (const row of fresh) {
    const id = `${row.source}|${row.message}|${row.path ?? ""}`;
    const group = groups.get(id) ?? { source: row.source, message: row.message, path: row.path, count: 0 };
    group.count += 1;
    groups.set(id, group);
  }
  const top = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const link = appUrl("/platform?tab=errors");
  const lines = top.map((group) => `${group.count}x [${group.source}] ${group.path ?? ""} ${group.message}`);
  const text = [`moarge: ${fresh.length} ახალი შეცდომა / new errors`, "", ...lines, "", link].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1c1917">
<p><strong>moarge: ${fresh.length}</strong> ახალი შეცდომა / new errors</p>
<ul>${top.map((group) => `<li><strong>${group.count}x</strong> [${escapeHtml(group.source)}] ${escapeHtml(group.path ?? "")}<br><span style="color:#57534e">${escapeHtml(group.message)}</span></li>`).join("")}</ul>
<p><a href="${escapeHtml(link)}">ადმინ პანელში ნახვა / Open the admin panel</a></p></div>`;

  try {
    const result = await new Resend(key).emails.send({
      from,
      to: [process.env.PLATFORM_ALERT_EMAIL?.trim() || SUPPORT_EMAIL],
      subject: `moarge: ${fresh.length} ახალი შეცდომა / new errors`,
      text,
      html,
    });
    if (result.error) return 0;
  } catch {
    return 0;
  }
  await db.from("app_errors").update({ alerted_at: new Date().toISOString() }).in("id", fresh.map((row) => row.id));
  return fresh.length;
}
