"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Scissors } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, Input, Sheet, Skeleton, useToast } from "@/components/ui";

type Service = { id: string; name_ka: string; price_gel: number; duration_minutes: number; recall_days: number | null; is_active: boolean; is_online_bookable: boolean; staff_ids: string[] };
type Staff = { id: string; full_name: string; is_active: boolean };
type Draft = { id?: string; name: string; price: string; duration: number; recallDays: number | null; online: boolean; staffIds: string[] };

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const RECALL = [null, 14, 21, 30, 45, 60, 90] as const;
const EMPTY: Draft = { name: "", price: "", duration: 60, recallDays: null, online: true, staffIds: [] };

/** Services and prices: a list to scan, a sheet to add or change one. */
export default function ServicesSettings() {
  const { t } = useLanguage();
  const toast = useToast();
  const [services, setServices] = useState<Service[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [serviceResponse, staffResponse] = await Promise.all([fetch("/api/services"), fetch("/api/staff")]);
    const [serviceData, staffData] = await Promise.all([serviceResponse.json(), staffResponse.json()]);
    setServices(serviceData.services ?? []);
    setStaff((staffData.staff ?? []).map((item: Staff) => ({ id: item.id, full_name: item.full_name, is_active: item.is_active })));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const activeStaff = staff.filter((member) => member.is_active);
  const names = (ids: string[]) => staff.filter((member) => ids.includes(member.id)).map((member) => member.full_name).join(", ");
  const open = (service?: Service) => setDraft(service
    ? { id: service.id, name: service.name_ka, price: String(service.price_gel), duration: service.duration_minutes, recallDays: service.recall_days, online: service.is_online_bookable, staffIds: service.staff_ids ?? [] }
    : { ...EMPTY, staffIds: activeStaff.length === 1 ? [activeStaff[0].id] : [] });

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const response = await fetch("/api/services", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "");
  }

  async function save() {
    if (!draft) return;
    const price = Number(draft.price);
    if (draft.name.trim().length < 2) return toast.error(t("ჩაწერეთ სერვისის სახელი.", "Enter the service name."));
    if (!Number.isFinite(price) || price < 0) return toast.error(t("შეამოწმეთ ფასი.", "Check the price."));
    if (activeStaff.length > 0 && draft.staffIds.length === 0) return toast.error(t("აირჩიეთ, ვინ ასრულებს.", "Choose who performs it."));
    setSaving(true);
    try {
      const body = { name_ka: draft.name.trim(), price_gel: price, duration_minutes: draft.duration, recall_days: draft.recallDays, is_online_bookable: draft.online, staff_ids: draft.staffIds };
      await request(draft.id ? "PATCH" : "POST", draft.id ? { id: draft.id, ...body } : body);
      toast.success(draft.id ? t("შენახულია.", "Saved.") : t("სერვისი დაემატა.", "Service added."));
      setDraft(null);
      await load();
    } catch (error) {
      toast.error((error instanceof Error && error.message.split(" / ")[0]) || t("შენახვა ვერ მოხერხდა.", "Could not save."));
    } finally { setSaving(false); }
  }

  async function setActive(service: Service, active: boolean) {
    try {
      await request("PATCH", { id: service.id, is_active: active, ...(active ? {} : { is_online_bookable: false }) });
      toast.success(active ? t("სერვისი ჩაირთო.", "Service is on.") : t("სერვისი გამოირთო.", "Service is off."));
      setDraft(null);
      await load();
    } catch { toast.error(t("შენახვა ვერ მოხერხდა.", "Could not save.")); }
  }

  const active = (services ?? []).filter((service) => service.is_active);
  const inactive = (services ?? []).filter((service) => !service.is_active);
  const editing = draft?.id ? services?.find((service) => service.id === draft.id) : undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("სერვისები და ფასები", "Services and prices")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("რას სთავაზობთ, რა ღირს და რამდენ ხანს გრძელდება.", "What you offer, what it costs and how long it takes.")}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>{t("სერვისის დამატება", "Add service")}</Button>
      </header>

      {services === null ? <Skeleton className="h-48" /> : active.length === 0 ? (
        <Card><EmptyState icon={<Scissors />} title={t("სერვისები ჯერ არ არის", "No services yet")} text={t("დაამატეთ პირველი სერვისი: სახელი, ფასი და ხანგრძლივობა.", "Add your first service: name, price and length.")}
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>{t("სერვისის დამატება", "Add service")}</Button>} /></Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-stone-100">
            {active.map((service) => (
              <li key={service.id}>
                <button type="button" onClick={() => open(service)} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-stone-50 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-stone-900">{service.name_ka}</span>
                    <span className="block truncate text-sm text-stone-500">{names(service.staff_ids ?? []) || t("სპეციალისტი არ არის მიბმული", "No specialist assigned")}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold tabular-nums text-stone-900">{service.price_gel} ₾</span>
                    <span className="text-xs text-stone-500">{t(`${service.duration_minutes} წთ`, `${service.duration_minutes} min`)}{!service.is_online_bookable && <Badge className="ml-1.5 py-0.5">{t("ონლაინ არა", "Not online")}</Badge>}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {inactive.length > 0 && (
        <details className="group rounded-2xl border border-stone-200 bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-stone-700 sm:px-5">
            {t(`გამორთული სერვისები (${inactive.length})`, `Switched-off services (${inactive.length})`)}<span className="text-stone-400 group-open:hidden">{t("ნახვა", "Show")}</span>
          </summary>
          <ul className="divide-y divide-stone-100 border-t border-stone-100">
            {inactive.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="truncate text-stone-500">{service.name_ka} · {service.price_gel} ₾</span>
                <Button size="sm" variant="secondary" onClick={() => void setActive(service, true)}>{t("ჩართვა", "Turn on")}</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t("სერვისის შეცვლა", "Edit service") : t("ახალი სერვისი", "New service")}
        footer={<Button size="lg" block loading={saving} onClick={() => void save()}>{t("შენახვა", "Save")}</Button>}>
        {draft && <div className="space-y-5">
          <Field label={t("სახელი", "Name")}>{(props) => <Input {...props} value={draft.name} maxLength={150} placeholder={t("მაგ. მანიკური", "e.g. Manicure")} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</Field>
          <Field label={t("ფასი, ₾", "Price, ₾")}>{(props) => <Input {...props} type="number" inputMode="decimal" min={0} step="0.5" value={draft.price} placeholder="40" onChange={(event) => setDraft({ ...draft, price: event.target.value })} />}</Field>
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("ხანგრძლივობა", "Length")}</p>
            <ChipRow>{DURATIONS.map((minutes) => <Chip key={minutes} selected={draft.duration === minutes} onClick={() => setDraft({ ...draft, duration: minutes })}>{minutes < 60 ? t(`${minutes} წთ`, `${minutes} min`) : minutes % 60 ? t(`${Math.floor(minutes / 60)} სთ ${minutes % 60} წთ`, `${Math.floor(minutes / 60)} h ${minutes % 60} min`) : t(`${minutes / 60} სთ`, `${minutes / 60} h`)}</Chip>)}</ChipRow>
            {!DURATIONS.includes(draft.duration) && <p className="mt-2 text-xs text-stone-500">{t(`ახლა: ${draft.duration} წთ`, `Now: ${draft.duration} min`)}</p>}
          </div>
          {activeStaff.length > 0 && <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("ვინ ასრულებს", "Who performs it")}</p>
            <ChipRow className="flex-wrap">{activeStaff.map((member) => {
              const selected = draft.staffIds.includes(member.id);
              return <Chip key={member.id} selected={selected} onClick={() => setDraft({ ...draft, staffIds: selected ? draft.staffIds.filter((id) => id !== member.id) : [...draft.staffIds, member.id] })}>{member.full_name}</Chip>;
            })}</ChipRow>
          </div>}
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span><span className="block font-semibold text-stone-900">{t("ჩანს ონლაინ ჯავშანში", "Shown for online booking")}</span><span className="text-sm text-stone-500">{t("გამორთეთ, თუ ამ სერვისზე მხოლოდ თქვენ წერთ.", "Turn off if only you book this service.")}</span></span>
            <input type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-rose-600" checked={draft.online} onChange={(event) => setDraft({ ...draft, online: event.target.checked })} />
          </label>
          <div>
            <p className="text-sm font-semibold text-stone-700">{t("როდის დაბრუნდეს კლიენტი", "When the client should come back")}</p>
            <p className="mb-2 text-xs text-stone-500">{t("დაბრუნების SMS-ისთვის. თუ არ აირჩევთ, მოქმედებს SMS პარამეტრების დღეები.", "For the come-back SMS. If not set, the SMS settings' days apply.")}</p>
            <ChipRow>{RECALL.map((days) => <Chip key={days ?? "none"} selected={draft.recallDays === days} onClick={() => setDraft({ ...draft, recallDays: days })}>{days === null ? t("ზოგადი", "Default") : t(`${days} დღეში`, `In ${days} days`)}</Chip>)}</ChipRow>
          </div>
          {editing && <Button variant="ghost" block onClick={() => void setActive(editing, false)}>{t("სერვისის გამორთვა", "Switch the service off")}</Button>}
        </div>}
      </Sheet>
    </div>
  );
}
