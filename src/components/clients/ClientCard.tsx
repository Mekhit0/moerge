"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarPlus, GitMerge, MessageCircle, Pencil, Phone, Search, StickyNote, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatShortDate } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { SEGMENT_LABELS, initialOf, segmentsFor, type ClientStats } from "@/lib/crm";
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, Chip, ChipRow, Dialog, EmptyState, Input, Sheet, StatCard, StatusBadge, Textarea, cn, useToast } from "@/components/ui";
import { ClientFormSheet, type ClientFormValue, type StaffOption } from "./ClientFormSheet";

export interface CardClient extends ClientFormValue {
  id: string;
  tags: string[];
  is_archived: boolean;
  is_blocked: boolean;
  created_at: string;
}

export interface CardVisit {
  id: string;
  treatment_date: string;
  time: string;
  status: string;
  service: string;
  staff: { full_name: string; color: string | null } | null;
  price: number;
  paid: { total: number; tip: number } | null;
  notes: string | null;
}

export interface CardNote { id: string; kind: "note" | "allergy" | "formula"; body: string; created_at: string; created_by: string | null; author: string | null }
interface Match { id: string; full_name: string; phone: string | null }

function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "en" && en ? en : ka;
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) : {};
  return { ok: Boolean(response?.ok), data, error: response?.ok ? null : String(data.error ?? "Error") };
}

const NOTE_KINDS = ["note", "allergy", "formula"] as const;

/**
 * One client: who they are, what was done, what to do next. Call, Viber, WhatsApp and Book are one tap
 * away; notes that matter in a salon (allergies, color formulas) sit right under the numbers.
 */
export default function ClientCard({ client, stats, vipFrom, visits, initialNotes, staff, today, userId, canManage }: {
  client: CardClient;
  stats: ClientStats | null;
  vipFrom: number;
  visits: CardVisit[];
  initialNotes: CardNote[];
  staff: StaffOption[];
  today: string;
  userId: string;
  canManage: boolean;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [noteKind, setNoteKind] = useState<CardNote["kind"]>("note");
  const [noteBody, setNoteBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [cancelUpcoming, setCancelUpcoming] = useState(true);
  const [merging, setMerging] = useState(false);
  const [tags, setTags] = useState(client.tags.join(", "));
  const year = Number(today.slice(0, 4));

  useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  const segments = stats && !client.is_archived ? segmentsFor(stats, today, vipFrom) : [];
  // A tag that repeats an automatic list (for example "VIP") is shown once.
  const segmentNames = new Set(segments.map((segment) => t(SEGMENT_LABELS[segment].ka, SEGMENT_LABELS[segment].en).toLocaleLowerCase("ka")));
  const digits = (client.phone ?? "").replace(/\D/g, "");
  const preferred = staff.find((member) => member.id === client.preferred_staff_id);
  const averageCheck = stats && stats.visit_count > 0 ? Number(stats.total_spent) / stats.visit_count : 0;
  const kindLabel = (kind: CardNote["kind"]) => kind === "allergy" ? t("ალერგია", "Allergy") : kind === "formula" ? t("ფორმულა", "Formula") : t("შენიშვნა", "Note");

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setBusy("note");
    const result = await send(`/api/clients/${client.id}/notes`, "POST", { kind: noteKind, body: noteBody.trim() });
    setBusy(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return; }
    setNotes((current) => [result.data.note as CardNote, ...current]);
    setNoteBody("");
    setNoteKind("note");
  }

  async function deleteNote(note: CardNote) {
    setBusy(note.id);
    const result = await send(`/api/clients/${client.id}/notes?note_id=${note.id}`, "DELETE");
    setBusy(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return; }
    setNotes((current) => current.filter((item) => item.id !== note.id));
  }

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy("patch");
    const result = await send(`/api/clients/${client.id}`, "PATCH", body);
    setBusy(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return false; }
    toast.success(done);
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-5">
      <Link href="/clients" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-stone-600 hover:text-brand-strong">
        <ArrowLeft className="h-4 w-4" />{t("კლიენტები", "Clients")}
      </Link>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-bold text-brand-strong">
              {initialOf(client.full_name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-stone-900">{client.full_name}</h1>
              <p className="text-stone-500">{client.phone}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {client.is_archived && <Badge>{t("არქივში", "Archived")}</Badge>}
                {client.is_blocked && <Badge tone="danger">{t("ონლაინ ჯავშანი დაბლოკილია", "Online booking blocked")}</Badge>}
                {segments.map((segment) => (
                  <Badge key={segment} tone={segment === "at_risk" || segment === "no_shows" ? "warning" : segment === "lost" ? "neutral" : "brand"}>
                    {t(SEGMENT_LABELS[segment].ka, SEGMENT_LABELS[segment].en)}
                  </Badge>
                ))}
                {client.tags.filter((tag) => !segmentNames.has(tag.toLocaleLowerCase("ka"))).map((tag) => <Badge key={tag}>{tag}</Badge>)}
              </div>
            </div>
          </div>
          {canManage && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>{t("რედაქტირება", "Edit")}</Button>}
        </div>

        <div className={cn("mt-5 grid gap-2", canManage && !client.is_archived ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
          {client.phone && <ButtonLink href={`tel:${client.phone}`} variant="secondary" icon={<Phone className="h-4 w-4 text-brand" />}>{t("დარეკვა", "Call")}</ButtonLink>}
          {digits && <a href={`viber://chat?number=%2B${digits}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 hover:border-rose-300 hover:bg-brand-soft">
            <MessageCircle className="h-4 w-4 text-violet-600" />Viber
          </a>}
          {digits && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 hover:border-rose-300 hover:bg-brand-soft">
            <MessageCircle className="h-4 w-4 text-emerald-600" />WhatsApp
          </a>}
          {canManage && !client.is_archived && <ButtonLink href={`/appointments?new=1&clientId=${client.id}`} icon={<CalendarPlus className="h-4 w-4" />}>{t("ჯავშანი", "Book")}</ButtonLink>}
        </div>

        {client.notes && <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
        </div>}
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("რიცხვები", "Numbers")}>
        <StatCard label={t("ვიზიტები", "Visits")} value={String(stats?.visit_count ?? 0)}
          hint={stats && stats.no_show_count > 0 ? t(`${stats.no_show_count}-ჯერ არ მოვიდა`, `${stats.no_show_count} no-shows`) : undefined} />
        <StatCard label={t("დახარჯა", "Spent")} value={formatGel(Number(stats?.total_spent ?? 0), lang)}
          hint={averageCheck > 0 ? t(`საშუალოდ ${formatGel(averageCheck, lang)}`, `Avg ${formatGel(averageCheck, lang)}`) : undefined} />
        <StatCard label={t("ბოლო ვიზიტი", "Last visit")} value={stats?.last_visit ? formatShortDate(stats.last_visit, lang, year) : "·"}
          hint={stats?.avg_gap_days ? t(`ჩვეულებრივ ყოველ ${stats.avg_gap_days} დღეში`, `Usually every ${stats.avg_gap_days} days`) : undefined} />
        <StatCard label={t("შემდეგი ვიზიტი", "Next visit")} value={stats?.next_visit ? formatShortDate(stats.next_visit, lang, year) : "·"}
          hint={!stats?.next_visit && stats?.next_expected_date ? t(`დაბრუნების დრო: ${formatShortDate(stats.next_expected_date, lang, year)}`, `Due back: ${formatShortDate(stats.next_expected_date, lang, year)}`) : undefined} />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title={t("შენიშვნები", "Notes")} description={t("ალერგიები, ფერის ფორმულები და სხვა, რაც უნდა გვახსოვდეს.", "Allergies, color formulas and anything else to remember.")} />
            <form onSubmit={addNote} className="space-y-3">
              <ChipRow>
                {NOTE_KINDS.map((kind) => <Chip key={kind} selected={noteKind === kind} onClick={() => setNoteKind(kind)}>{kindLabel(kind)}</Chip>)}
              </ChipRow>
              <Textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={2000} aria-label={t("ახალი შენიშვნა", "New note")}
                placeholder={noteKind === "formula" ? t("მაგ: 7.1 + 6% 1:1, 35 წთ", "e.g. 7.1 + 6% 1:1, 35 min") : noteKind === "allergy" ? t("მაგ: ლატექსი", "e.g. latex") : t("რა უნდა გვახსოვდეს?", "What should we remember?")} />
              <Button type="submit" loading={busy === "note"} disabled={!noteBody.trim()} icon={<StickyNote className="h-4 w-4" />}>{t("დამატება", "Add")}</Button>
            </form>
            {notes.length > 0 && <ul className="mt-5 space-y-2">
              {notes.map((note) => (
                <li key={note.id} className={cn("rounded-2xl border p-3", note.kind === "allergy" ? "border-red-200 bg-red-50/60" : "border-stone-100 bg-stone-50/60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge tone={note.kind === "allergy" ? "danger" : note.kind === "formula" ? "brand" : "neutral"}>{kindLabel(note.kind)}</Badge>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-stone-800">{note.body}</p>
                      <p className="mt-1 text-xs text-stone-400">{note.author ?? ""}{note.author ? " · " : ""}{formatShortDate(note.created_at.slice(0, 10), lang, year)}</p>
                    </div>
                    {(canManage || note.created_by === userId) && <button type="button" onClick={() => void deleteNote(note)} disabled={busy === note.id}
                      aria-label={t("წაშლა", "Delete")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-white hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>}
                  </div>
                </li>
              ))}
            </ul>}
          </Card>

          <Card>
            <CardHeader title={t("ვიზიტების ისტორია", "Visit history")} />
            {visits.length === 0 ? <EmptyState title={t("ვიზიტები ჯერ არ არის.", "No visits yet.")} className="py-6" /> : (
              <ul className="divide-y divide-stone-100">
                {visits.map((visit) => (
                  <li key={visit.id}>
                    <Link href={`/appointments?date=${visit.treatment_date}`} className="flex items-start gap-3 py-3 hover:bg-stone-50/60" style={{ borderLeft: `3px solid ${visit.staff?.color || "#e7e5e4"}`, paddingLeft: 12 }}>
                      <span className="w-16 shrink-0 text-sm">
                        <span className="block font-semibold text-stone-900">{formatShortDate(visit.treatment_date, lang, year)}</span>
                        <span className="text-stone-500">{visit.time}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-stone-900">{visit.service}</span>
                        <span className="block truncate text-sm text-stone-500">{visit.staff?.full_name ?? ""}{visit.notes ? ` · ${visit.notes}` : ""}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        {visit.paid
                          ? <span className="block font-semibold text-emerald-700">{formatGel(visit.paid.total, lang)}{visit.paid.tip > 0 ? <span className="font-normal text-stone-500"> +{formatGel(visit.paid.tip, lang)}</span> : null}</span>
                          : <StatusBadge status={visit.status} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t("დეტალები", "Details")} className="mb-2" />
            <dl className="divide-y divide-stone-100 text-sm">
              {[
                [t("დაბადების დღე", "Birthday"), client.birthday ? formatShortDate(client.birthday, lang, -1) : "·"],
                [t("საყვარელი სპეციალისტი", "Preferred specialist"), preferred?.full_name ?? "·"],
                [t("ელ-ფოსტა", "Email"), client.email || "·"],
                [t("SMS შეხსენებები", "SMS reminders"), client.sms_consent ? t("თანახმაა", "Agreed") : t("არა", "No")],
                [t("ენა", "Language"), client.preferred_language === "en" ? "English" : "ქართული"],
                [t("კლიენტია", "Client since"), formatShortDate(client.created_at.slice(0, 10), lang, year)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-2.5"><dt className="text-stone-500">{label}</dt><dd className="min-w-0 truncate text-right font-medium text-stone-900">{value}</dd></div>
              ))}
            </dl>
          </Card>

          {canManage && <Card>
            <CardHeader title={t("მართვა", "Manage")} className="mb-3" />
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-stone-700" htmlFor="client-tags">{t("თეგები", "Tags")}</label>
                <div className="flex gap-2">
                  <Input id="client-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("VIP, მგრძნობიარე კანი", "VIP, sensitive skin")} />
                  <Button variant="secondary" loading={busy === "patch"} onClick={() => void patch({ tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }, t("თეგები შენახულია.", "Tags saved."))}>
                    {t("შენახვა", "Save")}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-stone-500">{t("მძიმით გამოყავით", "Separate with commas")}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="secondary" icon={<GitMerge className="h-4 w-4 text-brand" />} onClick={() => setMerging(true)}>{t("დუბლიკატის შეერთება", "Merge a duplicate")}</Button>
                {client.is_blocked
                  ? <Button variant="secondary" loading={busy === "patch"} onClick={() => void patch({ is_blocked: false }, t("ბლოკი მოიხსნა.", "Unblocked."))}>{t("ონლაინ ჯავშნის ბლოკის მოხსნა", "Allow online booking again")}</Button>
                  : <Button variant="secondary" onClick={() => setBlockOpen(true)}>{t("ონლაინ ჯავშნის დაბლოკვა", "Block online booking")}</Button>}
                <Button variant="ghost" loading={busy === "patch"} onClick={() => void patch({ is_archived: !client.is_archived }, client.is_archived ? t("კლიენტი აღდგა.", "Client restored.") : t("კლიენტი არქივშია.", "Client archived."))}>
                  {client.is_archived ? t("არქივიდან აღდგენა", "Restore from archive") : t("არქივში გადატანა", "Move to archive")}
                </Button>
              </div>
            </div>
          </Card>}
        </div>
      </div>

      {canManage && <ClientFormSheet open={editing} client={client} staff={staff} onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); toast.success(t("შენახულია.", "Saved.")); router.refresh(); }} />}

      <Dialog open={blockOpen} onClose={() => setBlockOpen(false)} title={t("ონლაინ ჯავშნის დაბლოკვა", "Block online booking")}
        footer={<div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setBlockOpen(false)}>{t("არა", "No")}</Button>
          <Button variant="danger" size="lg" loading={busy === "patch"} onClick={() => void patch({ is_blocked: true, cancel_upcoming: cancelUpcoming }, t("დაბლოკილია.", "Blocked.")).then((ok) => ok && setBlockOpen(false))}>{t("დაბლოკვა", "Block")}</Button>
        </div>}>
        <p className="text-sm text-stone-600">{t("ეს ნომერი ონლაინ ვეღარ დაჯავშნის. თქვენ მაინც შეგიძლიათ ჩაწეროთ აქედან.", "This number can no longer book online. You can still book them here.")}</p>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm text-stone-700">
          <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={cancelUpcoming} onChange={(event) => setCancelUpcoming(event.target.checked)} />
          {t("გაუქმდეს მომავალი ჯავშნებიც", "Also cancel upcoming bookings")}
        </label>
      </Dialog>

      {canManage && <MergeSheet open={merging} keep={client} onClose={() => setMerging(false)} onMerged={() => { setMerging(false); router.refresh(); }} />}
    </div>
  );
}

/** Find the duplicate card and join it into this one. */
function MergeSheet({ open, keep, onClose, onMerged }: { open: boolean; keep: CardClient; onClose: () => void; onMerged: () => void }) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [query, setQuery] = useState(keep.full_name);
  const [results, setResults] = useState<Match[] | null>(null);
  const [chosen, setChosen] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(keep.full_name);
    setChosen(null);
    setError(null);
  }, [open, keep.full_name]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults(null); return; }
    const timer = window.setTimeout(() => {
      void fetch(`/api/clients?search=${encodeURIComponent(query.trim())}&limit=8`).then((response) => response.json()).then((data) => {
        setResults(((data.clients ?? []) as Match[]).filter((match) => match.id !== keep.id));
      }).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, keep.id]);

  async function merge() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const result = await send("/api/clients/merge", "POST", { keep_id: keep.id, merge_id: chosen.id });
    setBusy(false);
    if (!result.ok) { setError(localMessage(result.error ?? "", lang)); return; }
    toast.success(t("ბარათები გაერთიანდა.", "Cards merged."));
    onMerged();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("დუბლიკატის შეერთება", "Merge a duplicate")} description={keep.full_name}
      footer={chosen ? <Button variant="danger" size="lg" block loading={busy} icon={<GitMerge className="h-5 w-5" />} onClick={() => void merge()}>{t("გაერთიანება", "Merge")}</Button> : undefined}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {chosen ? (
          <Alert tone="warning">
            {t(`${chosen.full_name} (${chosen.phone ?? ""}) გადავა ამ ბარათში: ვიზიტები, გადახდები და შენიშვნები. ის ბარათი წაიშლება. ამას ვერ დააბრუნებთ.`,
              `${chosen.full_name} (${chosen.phone ?? ""}) moves into this card: visits, payments and notes. That card is deleted. This cannot be undone.`)}
            <button type="button" className="mt-2 block font-semibold underline" onClick={() => setChosen(null)}>{t("სხვის არჩევა", "Choose another")}</button>
          </Alert>
        ) : <>
          <p className="text-sm text-stone-600">{t("იპოვეთ იგივე ადამიანის მეორე ბარათი. ის ამ ბარათში გადავა.", "Find the other card of the same person. It will move into this card.")}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-12" type="search" aria-label={t("ძებნა", "Search")} />
          </div>
          {results && results.length === 0 && <p className="text-sm text-stone-500">{t("სხვა ბარათი ვერ მოიძებნა.", "No other card found.")}</p>}
          {results && results.length > 0 && <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-100">
            {results.map((match) => (
              <li key={match.id}>
                <button type="button" onClick={() => setChosen(match)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left hover:bg-brand-soft">
                  <span className="min-w-0"><span className="block truncate font-semibold text-stone-900">{match.full_name}</span><span className="text-sm text-stone-500">{match.phone}</span></span>
                  <GitMerge className="h-4 w-4 shrink-0 text-stone-400" />
                </button>
              </li>
            ))}
          </ul>}
        </>}
      </div>
    </Sheet>
  );
}
