"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Download, Phone, Search, Upload, UserPlus, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatShortDate } from "@/lib/dates";
import { formatGel } from "@/lib/visit-flow";
import { SEGMENTS, SEGMENT_LABELS, initialOf, nameKey, segmentsFor, vipThreshold, type ClientStats, type Segment } from "@/lib/crm";
import { Alert, Badge, Button, ButtonLink, Card, Chip, ChipRow, EmptyState, IconButton, Input, cn, useToast } from "@/components/ui";
import { ClientFormSheet, type StaffOption } from "./ClientFormSheet";

export interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_archived: boolean;
  is_blocked: boolean;
  created_at: string;
  stats: ClientStats | null;
}

type Filter = "all" | Segment | "duplicates" | "archived";
const PAGE = 60;

/**
 * The client base: search by name or phone, automatic lists (due to return, at risk, birthdays and
 * more) and one-tap call or book on every row.
 */
export default function ClientsList({ clients, staff, today, canManage, startNew }: {
  clients: ClientRow[];
  staff: StaffOption[];
  today: string;
  canManage: boolean;
  startNew: boolean;
}) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [creating, setCreating] = useState(startNew && canManage);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const year = Number(today.slice(0, 4));

  const enriched = useMemo(() => {
    const vipFrom = vipThreshold(clients.map((client) => client.stats ?? { total_spent: 0 }));
    const nameCounts = new Map<string, number>();
    for (const client of clients) if (!client.is_archived) nameCounts.set(nameKey(client.full_name), (nameCounts.get(nameKey(client.full_name)) ?? 0) + 1);
    return clients.map((client) => ({
      ...client,
      segments: client.stats && !client.is_archived ? segmentsFor(client.stats, today, vipFrom) : [],
      duplicate: !client.is_archived && (nameCounts.get(nameKey(client.full_name)) ?? 0) > 1,
    }));
  }, [clients, today]);

  const counts = useMemo(() => {
    const result = new Map<Filter, number>();
    for (const client of enriched) {
      if (client.is_archived) { result.set("archived", (result.get("archived") ?? 0) + 1); continue; }
      result.set("all", (result.get("all") ?? 0) + 1);
      for (const segment of client.segments) result.set(segment, (result.get(segment) ?? 0) + 1);
      if (client.duplicate) result.set("duplicates", (result.get("duplicates") ?? 0) + 1);
    }
    return result;
  }, [enriched]);

  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("ka");
    const digits = query.replace(/\D/g, "");
    const rows = enriched.filter((client) => {
      if (filter === "archived" ? !client.is_archived : client.is_archived) return false;
      if (filter === "duplicates" && !client.duplicate) return false;
      if (filter !== "all" && filter !== "archived" && filter !== "duplicates" && !client.segments.includes(filter)) return false;
      if (!text) return true;
      return client.full_name.toLocaleLowerCase("ka").includes(text)
        || (digits.length >= 3 && (client.phone ?? "").replace(/\D/g, "").includes(digits))
        || (client.email ?? "").toLowerCase().includes(text);
    });
    // Lists that need action show who waited longest first; duplicates sit next to each other.
    if (filter === "duplicates") return rows.sort((a, b) => nameKey(a.full_name).localeCompare(nameKey(b.full_name), "ka"));
    if (filter === "due" || filter === "at_risk" || filter === "lost") {
      return rows.sort((a, b) => (a.stats?.last_visit ?? "").localeCompare(b.stats?.last_visit ?? ""));
    }
    return rows.sort((a, b) => (b.stats?.last_visit ?? b.created_at.slice(0, 10)).localeCompare(a.stats?.last_visit ?? a.created_at.slice(0, 10)));
  }, [enriched, filter, query]);

  async function importCsv(file?: File) {
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const response = await fetch("/api/clients/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setImportMessage({ tone: "error", text: String(result.error ?? t("იმპორტი ვერ მოხერხდა.", "Import failed.")) });
      else {
        setImportMessage({ tone: "success", text: t(`დაემატა ${result.imported} კლიენტი. გამოტოვებულია ${result.skipped_duplicates} განმეორებული.`, `Imported ${result.imported} clients. Skipped ${result.skipped_duplicates} duplicates.`) });
        router.refresh();
      }
    } catch {
      setImportMessage({ tone: "error", text: t("ქსელური შეცდომა.", "Network error.") });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filters: Filter[] = ["all", ...SEGMENTS.filter((segment) => (counts.get(segment) ?? 0) > 0),
    ...(canManage && (counts.get("duplicates") ?? 0) > 0 ? ["duplicates" as const] : []),
    ...((counts.get("archived") ?? 0) > 0 ? ["archived" as const] : [])];
  const filterLabel = (value: Filter) => value === "all" ? t("ყველა", "All")
    : value === "duplicates" ? t("შესაძლო დუბლიკატები", "Possible duplicates")
    : value === "archived" ? t("არქივი", "Archived")
    : t(SEGMENT_LABELS[value].ka, SEGMENT_LABELS[value].en);
  const hint = filter === "duplicates"
    ? t("ერთნაირი სახელი. გახსენით ბარათი და გააერთიანეთ, თუ ერთი ადამიანია.", "Same name. Open a card and merge if it is the same person.")
    : filter !== "all" && filter !== "archived" ? t(SEGMENT_LABELS[filter].hint.ka, SEGMENT_LABELS[filter].hint.en) : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("კლიენტები", "Clients")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t(`სულ ${counts.get("all") ?? 0}`, `${counts.get("all") ?? 0} in total`)}</p>
        </div>
        {canManage && <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button size="lg" className="flex-1 sm:flex-none" icon={<UserPlus className="h-5 w-5" />} onClick={() => setCreating(true)}>{t("ახალი კლიენტი", "New client")}</Button>
          <Button variant="secondary" size="lg" loading={importing} icon={<Upload className="h-5 w-5 text-brand" />} onClick={() => fileRef.current?.click()}>{t("იმპორტი", "Import")}</Button>
          <ButtonLink href="/api/clients/export" variant="secondary" size="lg" icon={<Download className="h-5 w-5 text-brand" />} prefetch={false}>{t("ექსპორტი", "Export")}</ButtonLink>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importCsv(event.target.files?.[0])} />
        </div>}
      </header>

      {importMessage && <Alert tone={importMessage.tone}>{importMessage.text}</Alert>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE); }} className="pl-12"
          placeholder={t("სახელი ან ნომერი", "Name or phone")} aria-label={t("კლიენტის ძებნა", "Search clients")} type="search" />
      </div>

      <div>
        <ChipRow>
          {filters.map((value) => (
            <Chip key={value} selected={filter === value} onClick={() => { setFilter(value); setShown(PAGE); }}>
              {filterLabel(value)} <span className={cn("text-xs", filter === value ? "text-white/80" : "text-stone-400")}>{counts.get(value) ?? 0}</span>
            </Chip>
          ))}
        </ChipRow>
        {hint && <p className="mt-2 text-sm text-stone-500">{hint}</p>}
      </div>

      <Card className="p-0">
        {visible.length === 0 ? (
          <EmptyState icon={<Users />} title={clients.length === 0 ? t("ჯერ კლიენტები არ არის.", "No clients yet.") : t("ვერაფერი მოიძებნა.", "Nothing found.")}
            text={clients.length === 0 && canManage ? t("დაამატეთ პირველი კლიენტი ან შემოიტანეთ სია Excel-იდან (CSV).", "Add your first client or import a list from Excel (CSV).") : undefined} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {visible.slice(0, shown).map((client) => (
              <li key={client.id} className="flex items-center gap-2 pr-2">
                <Link href={`/clients/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-stone-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand-strong">
                    {initialOf(client.full_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-stone-900">{client.full_name}</span>
                      {client.is_blocked && <Badge tone="danger">{t("დაბლოკილი", "Blocked")}</Badge>}
                      {client.segments.slice(0, 2).map((segment) => (
                        <Badge key={segment} tone={segment === "at_risk" || segment === "no_shows" ? "warning" : segment === "lost" ? "neutral" : "brand"}>
                          {t(SEGMENT_LABELS[segment].ka, SEGMENT_LABELS[segment].en)}
                        </Badge>
                      ))}
                    </span>
                    <span className="block truncate text-sm text-stone-500">
                      {client.phone}
                      {client.stats?.last_visit ? ` · ${t("ბოლო", "Last")} ${formatShortDate(client.stats.last_visit, lang, year)}` : ` · ${t("ვიზიტი ჯერ არ ყოფილა", "No visits yet")}`}
                      {client.stats && client.stats.visit_count > 0 ? ` · ${client.stats.visit_count} ${t("ვიზიტი", client.stats.visit_count === 1 ? "visit" : "visits")}` : ""}
                      {canManage && client.stats && Number(client.stats.total_spent) > 0 ? ` · ${formatGel(Number(client.stats.total_spent), lang)}` : ""}
                    </span>
                  </span>
                </Link>
                {client.phone && <a href={`tel:${client.phone}`} aria-label={t("დარეკვა", "Call")}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-600 hover:bg-brand-soft hover:text-brand-strong">
                  <Phone className="h-5 w-5" />
                </a>}
                {canManage && !client.is_archived && <IconButton label={t("ჯავშანი", "Book")} className="shrink-0"
                  onClick={() => router.push(`/appointments?new=1&clientId=${client.id}`)}>
                  <CalendarPlus className="h-5 w-5" />
                </IconButton>}
              </li>
            ))}
          </ul>
        )}
        {visible.length > shown && <div className="border-t border-stone-100 p-3 text-center">
          <Button variant="ghost" onClick={() => setShown((value) => value + PAGE)}>{t(`კიდევ ${Math.min(PAGE, visible.length - shown)}`, `Show ${Math.min(PAGE, visible.length - shown)} more`)}</Button>
        </div>}
      </Card>

      <ClientFormSheet open={creating} client={null} staff={staff} onClose={() => setCreating(false)}
        onSaved={(created) => {
          setCreating(false);
          toast.success(t("კლიენტი დაემატა.", "Client added."));
          router.push(`/clients/${String(created.id)}`);
        }} />
    </div>
  );
}
