"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bug, CheckCircle2, Mail, MessageSquare, RotateCcw, Store } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { UBILL_LOW_BALANCE } from "@/lib/sms";
import { formatShortDate } from "@/lib/dates";
import MoargeLogo from "@/components/MoargeLogo";
import { Alert, Badge, Button, Card, CardHeader, Chip, ChipRow, EmptyState, Skeleton, StatCard, Tabs, cn, useToast } from "@/components/ui";

type Tab = "overview" | "salons" | "feedback" | "errors" | "messages";
type Salon = { salon_id: string; salon_name: string; slug: string; created_at: string; subscription_status: string | null; plan_code: string | null; trial_ends_at: string | null; active_staff: number; active_branches: number; bookings_period: number; sms_messages_period: number; sms_cost_gel: number };
type Feedback = { id: string; salon_name: string | null; author: string | null; author_email: string | null; body: string; page_path: string; created_at: string; resolved_at: string | null };
type Summary = { salons: number; trialing: number; trials_ending: number; bookings_30d: number; open_feedback: number; errors_24h: number; messages_sent_24h: number; messages_failed_24h: number; ubill_sms: number | null };
type ErrorGroup = { key: string; source: string; message: string; path: string | null; count: number; first_seen: string; last_seen: string; resolved: boolean; ids: string[]; salons: number };
type Problem = { id: string; salon_name: string | null; message_type: string; channel: string; status: string; attempt_count: number; error: string; created_at: string };

/** Georgia is always UTC+4. */
function when(iso: string, lang: "ka" | "en") {
  const local = new Date(Date.parse(iso) + 4 * 3_600_000).toISOString();
  return `${formatShortDate(local.slice(0, 10), lang, new Date().getFullYear())} ${local.slice(11, 16)}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error ?? "Error"));
  return data as T;
}

/** The platform owner's panel: every salon, their feedback, our error log and message delivery. */
export default function PlatformAdminManager() {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "overview");
  const [overview, setOverview] = useState<{ summary: Summary; salons: Salon[]; feedback: Feedback[] } | null>(null);
  const [errors, setErrors] = useState<ErrorGroup[] | null>(null);
  const [showFixed, setShowFixed] = useState(false);
  const [messages, setMessages] = useState<{ counts: Record<string, Record<string, number>>; problems: Problem[] } | null>(null);
  const [feedbackFilter, setFeedbackFilter] = useState<"open" | "all">("open");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadOverview = useCallback(() => getJson<{ summary: Summary; salons: Salon[]; feedback: Feedback[] }>("/api/platform/overview")
    .then(setOverview).catch((error) => setLoadError(String(error.message))), []);
  const loadErrors = useCallback(() => getJson<{ groups: ErrorGroup[] }>(`/api/platform/errors${showFixed ? "?show=all" : ""}`)
    .then((data) => setErrors(data.groups)).catch((error) => setLoadError(String(error.message))), [showFixed]);
  const loadMessages = useCallback(() => getJson<{ counts: Record<string, Record<string, number>>; problems: Problem[] }>("/api/platform/messages")
    .then(setMessages).catch((error) => setLoadError(String(error.message))), []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { if (tab === "errors") void loadErrors(); }, [tab, loadErrors]);
  useEffect(() => { if (tab === "messages") void loadMessages(); }, [tab, loadMessages]);

  function choose(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "overview" ? "/platform" : `/platform?tab=${next}`);
  }

  async function patch(url: string, body: unknown, done: string) {
    const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { toast.error(t("ვერ შეინახა.", "Could not save.")); return false; }
    toast.success(done);
    return true;
  }

  const summary = overview?.summary;
  const openFeedback = (overview?.feedback ?? []).filter((item) => feedbackFilter === "all" || !item.resolved_at);
  const tabs = [
    { value: "overview" as const, label: t("მიმოხილვა", "Overview") },
    { value: "salons" as const, label: t("სალონები", "Salons") },
    { value: "feedback" as const, label: summary?.open_feedback ? `${t("უკუკავშირი", "Feedback")} · ${summary.open_feedback}` : t("უკუკავშირი", "Feedback") },
    { value: "errors" as const, label: summary?.errors_24h ? `${t("შეცდომები", "Errors")} · ${summary.errors_24h}` : t("შეცდომები", "Errors") },
    { value: "messages" as const, label: t("შეტყობინებები", "Messages") },
  ];
  const statusLabel = (status: string | null) => status === "trialing" ? t("საცდელი", "Trial") : status === "active" ? t("აქტიური", "Active") : status ?? "·";

  return (
    <div className="min-h-screen bg-ivory">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100" aria-label={t("პანელში დაბრუნება", "Back to dashboard")}><ArrowLeft className="h-5 w-5" /></Link>
            <MoargeLogo size="sm" variant="full" />
            <Badge tone="brand" className="hidden sm:inline-flex">{t("ადმინი", "Admin")}</Badge>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("პლატფორმის მართვა", "Platform admin")}</h1>
        <Tabs label={t("განყოფილებები", "Sections")} value={tab} onChange={choose} items={tabs} />
        {loadError && <Alert tone="error">{loadError}</Alert>}

        {tab === "overview" && (summary ? (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t("სალონები", "Salons")} value={String(summary.salons)} hint={t(`${summary.trialing} საცდელზე`, `${summary.trialing} on trial`)} icon={<Store className="h-5 w-5" />} />
              <StatCard label={t("ჯავშნები 30 დღეში", "Bookings, 30 days")} value={String(summary.bookings_30d)} />
              <StatCard label={t("ახალი უკუკავშირი", "Open feedback")} value={String(summary.open_feedback)} icon={<MessageSquare className="h-5 w-5" />} />
              <StatCard label={t("შეცდომები 24 სთ-ში", "Errors, 24 hours")} value={String(summary.errors_24h)} icon={<Bug className="h-5 w-5" />} />
            </section>
            <Card>
              <CardHeader title={t("ყურადღება", "Needs attention")} />
              <ul className="space-y-2 text-sm">
                {summary.trials_ending > 0 && <li className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />{t(`${summary.trials_ending} სალონს საცდელი ვადა 7 დღეში უმთავრდება.`, `${summary.trials_ending} salons end their trial within 7 days.`)}</li>}
                {summary.ubill_sms !== null && summary.ubill_sms < UBILL_LOW_BALANCE && <li className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" />{t(`uBill-ზე ${summary.ubill_sms} SMS დარჩა. შეავსეთ ბალანსი, თორემ შეხსენებები გაჩერდება.`, `${summary.ubill_sms} SMS left on uBill. Top up, or reminders will stop.`)}</li>}
                {summary.messages_failed_24h > 0 && <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-red-600" />{t(`${summary.messages_failed_24h} შეტყობინება ვერ გაიგზავნა 24 სთ-ში.`, `${summary.messages_failed_24h} messages failed in 24 hours.`)}</li>}
                {summary.errors_24h > 0 && <li className="flex items-center gap-2"><Bug className="h-4 w-4 text-red-600" />{t(`${summary.errors_24h} შეცდომა 24 სთ-ში.`, `${summary.errors_24h} errors in 24 hours.`)}</li>}
                {summary.open_feedback > 0 && <li className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-brand" />{t(`${summary.open_feedback} ახალი უკუკავშირი.`, `${summary.open_feedback} new feedback.`)}</li>}
                {!summary.trials_ending && !summary.messages_failed_24h && !summary.errors_24h && !summary.open_feedback && !(summary.ubill_sms !== null && summary.ubill_sms < UBILL_LOW_BALANCE) && <li className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t("ყველაფერი რიგზეა.", "All good.")}</li>}
              </ul>
              <p className="mt-4 text-xs text-stone-500">{t(`გაგზავნილი შეტყობინებები 24 სთ-ში: ${summary.messages_sent_24h}`, `Messages sent in 24 hours: ${summary.messages_sent_24h}`)}</p>
              <p className="mt-1 text-xs text-stone-500">{summary.ubill_sms === null ? t("uBill-ის ნაშთი: უცნობია (გასაღები არ არის ან uBill არ პასუხობს)", "uBill balance: unknown (no key, or uBill did not answer)") : t(`uBill-ის ნაშთი: ${summary.ubill_sms} SMS`, `uBill balance: ${summary.ubill_sms} SMS`)}</p>
            </Card>
          </div>
        ) : !loadError && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28" />)}</div>)}

        {tab === "salons" && overview && (
          <Card className="p-0">
            {overview.salons.length === 0 ? <EmptyState title={t("სალონები ჯერ არ არის.", "No salons yet.")} /> : (
              <ul className="divide-y divide-stone-100">
                {overview.salons.map((salon) => (
                  <li key={salon.salon_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-900">
                        {salon.salon_name}<Badge tone={salon.subscription_status === "active" ? "success" : "neutral"}>{statusLabel(salon.subscription_status)}</Badge>
                      </p>
                      <p className="truncate text-sm text-stone-500">
                        /{salon.slug} · {t("დარეგისტრირდა", "joined")} {when(salon.created_at, lang)}
                        {salon.trial_ends_at && ` · ${t("საცდელი", "trial")} ${when(salon.trial_ends_at, lang).split(" ").slice(0, -1).join(" ")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-4 text-sm text-stone-700">
                      <span><span className="block text-xs text-stone-500">{t("სპეციალისტი", "Staff")}</span>{salon.active_staff}</span>
                      <span><span className="block text-xs text-stone-500">{t("ჯავშანი 30 დ.", "Bookings 30d")}</span>{salon.bookings_period}</span>
                      <span><span className="block text-xs text-stone-500">SMS</span>{salon.sms_messages_period}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === "feedback" && overview && (
          <div className="space-y-3">
            <ChipRow>
              <Chip selected={feedbackFilter === "open"} onClick={() => setFeedbackFilter("open")}>{t("ახალი", "Open")}</Chip>
              <Chip selected={feedbackFilter === "all"} onClick={() => setFeedbackFilter("all")}>{t("ყველა", "All")}</Chip>
            </ChipRow>
            {openFeedback.length === 0 ? <Card><EmptyState icon={<MessageSquare />} title={t("ახალი უკუკავშირი არ არის.", "No open feedback.")} /></Card> : openFeedback.map((item) => (
              <Card key={item.id} className={cn(item.resolved_at && "opacity-60")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{item.salon_name ?? t("სალონი", "Salon")} · {item.author ?? ""}</p>
                    <p className="text-xs text-stone-500">{item.author_email} · {item.page_path} · {when(item.created_at, lang)}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-stone-800">{item.body}</p>
                  </div>
                  <Button variant={item.resolved_at ? "ghost" : "secondary"} loading={busy === item.id} className="shrink-0"
                    icon={item.resolved_at ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    onClick={async () => {
                      setBusy(item.id);
                      const ok = await patch("/api/platform/feedback", { id: item.id, resolved: !item.resolved_at }, item.resolved_at ? t("ხელახლა გაიხსნა.", "Reopened.") : t("მონიშნულია: შესრულდა.", "Marked done."));
                      setBusy(null);
                      if (ok) void loadOverview();
                    }}>
                    {item.resolved_at ? t("ხელახლა გახსნა", "Reopen") : t("შესრულდა", "Done")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "errors" && (
          <div className="space-y-3">
            <ChipRow>
              <Chip selected={!showFixed} onClick={() => setShowFixed(false)}>{t("გასასწორებელი", "To fix")}</Chip>
              <Chip selected={showFixed} onClick={() => setShowFixed(true)}>{t("ყველა 90 დღეში", "All, 90 days")}</Chip>
            </ChipRow>
            <p className="text-sm text-stone-500">{t("ახალ შეცდომებზე მოგივათ წერილი, მაქსიმუმ საათში ერთხელ.", "New errors send you an email, at most once an hour.")}</p>
            {errors === null ? <Skeleton className="h-24" /> : errors.length === 0 ? <Card><EmptyState icon={<CheckCircle2 />} title={t("შეცდომები არ არის.", "No errors.")} /></Card> : errors.map((group) => (
              <Card key={group.key} className={cn(group.resolved && "opacity-60")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={group.source === "cron" ? "warning" : "danger"}>{group.source === "client" ? t("ბრაუზერი", "Browser") : group.source === "cron" ? t("შეხსენებები", "Reminders") : t("სერვერი", "Server")}</Badge>
                      <span className="font-semibold text-stone-900">{group.count}×</span>
                      {group.path && <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">{group.path}</code>}
                    </p>
                    <p className="mt-2 break-words font-mono text-xs text-stone-800">{group.message}</p>
                    <p className="mt-1 text-xs text-stone-500">{t("ბოლოს", "Last")} {when(group.last_seen, lang)} · {t("პირველად", "first")} {when(group.first_seen, lang)}</p>
                  </div>
                  <Button variant={group.resolved ? "ghost" : "secondary"} loading={busy === group.key} className="shrink-0"
                    icon={group.resolved ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    onClick={async () => {
                      setBusy(group.key);
                      const ok = await patch("/api/platform/errors", { ids: group.ids, resolved: !group.resolved }, group.resolved ? t("ხელახლა გაიხსნა.", "Reopened.") : t("მონიშნულია: გასწორდა.", "Marked fixed."));
                      setBusy(null);
                      if (ok) { void loadErrors(); void loadOverview(); }
                    }}>
                    {group.resolved ? t("ხელახლა გახსნა", "Reopen") : t("გასწორდა", "Fixed")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "messages" && (messages === null ? <Skeleton className="h-40" /> : (
          <div className="space-y-5">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {["email", "sms"].map((channel) => {
                const counts = messages.counts[channel] ?? {};
                return (
                  <Card key={channel}>
                    <CardHeader title={channel === "email" ? t("ელ-ფოსტა, 7 დღე", "Email, 7 days") : t("SMS, 7 დღე", "SMS, 7 days")} className="mb-2" />
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {[["sent", t("გაიგზავნა", "Sent")], ["pending", t("რიგში", "Waiting")], ["retry", t("ხელახლა ცდა", "Retrying")], ["failed", t("ვერ გაიგზავნა", "Failed")], ["suppressed", t("შეჩერდა", "Stopped")]].map(([key, label]) => (
                        <div key={key} className="flex justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"><dt className="text-stone-500">{label}</dt><dd className="font-semibold text-stone-900">{counts[key] ?? 0}</dd></div>
                      ))}
                    </dl>
                  </Card>
                );
              })}
            </section>
            <Card>
              <CardHeader title={t("პრობლემური შეტყობინებები", "Messages with problems")} description={t("ბოლო 50, მიმღების გარეშე.", "Latest 50, recipients hidden.")} />
              {messages.problems.length === 0 ? <p className="text-sm text-stone-500">{t("პრობლემა არ არის.", "No problems.")}</p> : (
                <ul className="divide-y divide-stone-100">
                  {messages.problems.map((problem) => (
                    <li key={problem.id} className="py-3 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge tone={problem.status === "failed" ? "danger" : "warning"}>{problem.status === "failed" ? t("ვერ გაიგზავნა", "Failed") : t("ხელახლა ცდა", "Retrying")}</Badge>
                        <span className="font-semibold text-stone-900">{problem.salon_name ?? "·"}</span>
                        <span className="text-stone-500">{problem.channel} · {problem.message_type} · {problem.attempt_count}×</span>
                      </p>
                      {problem.error && <p className="mt-1 break-words font-mono text-xs text-stone-700">{problem.error}</p>}
                      <p className="mt-0.5 text-xs text-stone-400">{when(problem.created_at, lang)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ))}
      </main>
    </div>
  );
}
