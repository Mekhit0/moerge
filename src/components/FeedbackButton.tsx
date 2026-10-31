"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function FeedbackButton() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, pagePath: pathname || "/dashboard" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("უკუკავშირის გაგზავნა ვერ მოხერხდა.", "Could not send feedback."));
      setBody(""); setMessage(t("მადლობა. უკუკავშირი გაიგზავნა.", "Thank you. Your feedback was sent."));
    } catch (error) { setMessage(error instanceof Error ? error.message : t("უკუკავშირის გაგზავნა ვერ მოხერხდა.", "Could not send feedback.")); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className="fixed bottom-20 right-4 lg:bottom-5 lg:right-5 z-40 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-rose-700 text-sm font-semibold text-white shadow-lg hover:bg-rose-800 sm:h-auto sm:w-auto sm:px-4 sm:py-3" aria-label={t("უკუკავშირის გაგზავნა", "Send feedback")}><MessageSquare className="h-5 w-5 sm:h-4 sm:w-4"/><span className="hidden sm:inline">{t("უკუკავშირი", "Feedback")}</span></button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{t("უკუკავშირი", "Feedback")}</h2><button type="button" onClick={() => setOpen(false)} aria-label={t("დახურვა", "Close")}><X className="h-5 w-5"/></button></div>
        <label className="block text-sm">{t("რა შეგვიძლია გავაუმჯობესოთ?", "What could we improve?")}<textarea autoFocus required minLength={5} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} rows={5} className="mt-2 w-full rounded-xl border p-3"/></label>
        {message && <p role="status" className="text-sm text-stone-700">{message}</p>}
        <div className="flex justify-end"><button disabled={busy} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t("იგზავნება...", "Sending...") : t("გაგზავნა", "Send")}</button></div>
      </form>
    </div>}
  </>;
}
