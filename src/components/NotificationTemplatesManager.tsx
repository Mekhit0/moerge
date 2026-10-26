"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Template = { id: string; message_type: string; channel: "sms" | "email"; language: "ka" | "en"; subject_template: string | null; body_template: string; is_active: boolean };
const types = ["booking_confirmation","reminder_24h","reminder_2h","cancel_confirmation","reschedule_confirmation","recall","no_show_followup"];

export default function NotificationTemplatesManager() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => templates.find((item) => item.id === selectedId) ?? null, [templates, selectedId]);
  useEffect(() => {
    void fetch("/api/notification-templates").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load templates.");
      setTemplates(result.templates ?? []);
      setSelectedId(result.templates?.[0]?.id ?? "");
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load templates."));
  }, []);
  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject_template ?? "");
    setBody(selected.body_template);
    setActive(selected.is_active);
  }, [selected]);
  const label = (item: Template) => `${item.message_type.replaceAll("_"," ")} · ${item.channel.toUpperCase()} · ${item.language.toUpperCase()}`;
  async function save() {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/notification-templates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, subject_template: selected.channel === "email" ? subject : null, body_template: body, is_active: active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save template.");
      setTemplates((current) => current.map((item) => item.id === selected.id ? result.template : item));
      setMessage(t("შაბლონი შენახულია.", "Template saved."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("შენახვა ვერ მოხერხდა.", "Could not save template."));
    } finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-rose-100 bg-white p-6 shadow-sm sm:p-8">
    <header><h1 className="text-2xl font-bold text-stone-900">{t("შეტყობინების შაბლონები", "Notification templates")}</h1>
      <p className="mt-2 text-sm text-stone-600">{t("შაბლონები ცალკეა SMS-ისა და ელ-ფოსტისთვის, ქართულად და ინგლისურად.", "Templates are separate for SMS and email, in Georgian and English.")}</p></header>
    <label className="block text-xs font-semibold text-stone-600">{t("შეტყობინება, არხი და ენა", "Message, channel, and language")}
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
        {templates.map((item) => <option key={item.id} value={item.id}>{label(item)}</option>)}
      </select>
    </label>
    {selected?.channel === "email" && <label className="block text-xs font-semibold text-stone-600">{t("თემა", "Subject")}
      <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
    </label>}
    <label className="block text-xs font-semibold text-stone-600">{t("შეტყობინების ტექსტი", "Message body")}
      <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" />
    </label>
    <p className="text-xs text-stone-500">{t("ცვლადები: {{client_name}}, {{salon_name}}, {{service_name}}, {{local_start}}, {{manage_link}}, {{booking_link}}, {{unsubscribe_link}}", "Variables: {{client_name}}, {{salon_name}}, {{service_name}}, {{local_start}}, {{manage_link}}, {{booking_link}}, {{unsubscribe_link}}")}</p>
    <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t("ჩართულია", "Active")}</label>
    <div className="flex items-center gap-4"><button disabled={!selected || busy} onClick={() => void save()} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("ინახება...", "Saving...") : t("შენახვა", "Save template")}</button><span role="status" className="text-sm text-stone-600">{message}</span></div>
    <div className="text-xs text-stone-500">{t("შეტყობინების ტიპები: ", "Message types: ")}{types.join(", ")}</div>
  </section>;
}
