"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { formatShortDate } from "@/lib/dates";

type Entry = { id: string; action: "insert" | "update" | "delete"; entity_type: string; changed_fields: string[]; actor_name: string | null; created_at: string };

const THINGS: Record<string, { ka: string; en: string }> = {
  appointments: { ka: "ვიზიტი", en: "Visit" },
  visit_payments: { ka: "გადახდა", en: "Payment" },
  staff: { ka: "სპეციალისტი", en: "Specialist" },
  staff_services: { ka: "სპეციალისტის სერვისები", en: "Specialist services" },
  salon_settings: { ka: "სალონის პარამეტრები", en: "Salon settings" },
  salons: { ka: "სალონი", en: "Salon" },
  client_notes: { ka: "კლიენტის შენიშვნა", en: "Client note" },
};
const ACTIONS = { insert: { ka: "დაემატა", en: "added" }, update: { ka: "შეიცვალა", en: "changed" }, delete: { ka: "წაიშალა", en: "removed" } };

/** Recent changes in plain words: what changed, who changed it and when. Values themselves are never stored. */
export default function AuditLogPanel() {
  const { lang, t } = useLanguage();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch("/api/audit").then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      setRows(data.entries ?? []);
    }).catch(() => setError(true));
  }, []);

  const when = (iso: string) => {
    const local = new Date(Date.parse(iso) + 4 * 3_600_000).toISOString();
    return `${formatShortDate(local.slice(0, 10), lang)} ${local.slice(11, 16)}`;
  };

  return (
    <section>
      <h3 className="font-semibold text-stone-900">{t("ბოლო ცვლილებები", "Recent changes")}</h3>
      <p className="mt-0.5 text-sm text-stone-500">{t("ვინ რა შეცვალა. თავად მნიშვნელობები არ ინახება.", "Who changed what. The values themselves are not stored.")}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{t("ჟურნალი ვერ ჩაიტვირთა.", "Could not load the log.")}</p>}
      {rows && rows.length === 0 && <p className="mt-3 text-sm text-stone-500">{t("ცვლილებები ჯერ არ არის.", "No changes yet.")}</p>}
      {rows && rows.length > 0 && <ul className="mt-3 max-h-80 divide-y divide-stone-100 overflow-y-auto rounded-2xl border border-stone-100">
        {rows.map((row) => {
          const thing = THINGS[row.entity_type] ?? { ka: row.entity_type, en: row.entity_type };
          return (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="text-stone-900">{t(`${thing.ka} ${ACTIONS[row.action]?.ka ?? ""}`, `${thing.en} ${ACTIONS[row.action]?.en ?? ""}`)}</span>
                {row.actor_name && <span className="text-stone-500"> · {row.actor_name}</span>}
              </span>
              <time className="shrink-0 text-xs text-stone-400">{when(row.created_at)}</time>
            </li>
          );
        })}
      </ul>}
    </section>
  );
}
