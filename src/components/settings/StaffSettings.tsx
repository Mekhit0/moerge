"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Plus, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, Input, Sheet, Skeleton, cn, useToast } from "@/components/ui";

type Staff = { id: string; full_name: string; color: string | null; is_active: boolean; service_ids: string[] };
type Service = { id: string; name_ka: string; is_active: boolean };
type Draft = { id?: string; name: string; color: string; serviceIds: string[] };

const COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777", "#2563eb", "#57534e"];

/** Specialists: who works here, their color in the calendar and the services they do. */
export default function StaffSettings() {
  const { t } = useLanguage();
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [staffResponse, serviceResponse] = await Promise.all([fetch("/api/staff"), fetch("/api/services")]);
    const [staffData, serviceData] = await Promise.all([staffResponse.json(), serviceResponse.json()]);
    setStaff((staffData.staff ?? []).map((item: Staff & { staff_services?: Array<{ service_id: string }> }) => ({
      id: item.id, full_name: item.full_name, color: item.color, is_active: item.is_active,
      service_ids: (item.staff_services ?? []).map((row) => row.service_id),
    })));
    setServices((serviceData.services ?? []).map((item: Service) => ({ id: item.id, name_ka: item.name_ka, is_active: item.is_active })));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const activeServices = services.filter((service) => service.is_active);
  const serviceNames = (ids: string[]) => activeServices.filter((service) => ids.includes(service.id)).map((service) => service.name_ka).join(", ");
  const open = (member?: Staff) => setDraft(member
    ? { id: member.id, name: member.full_name, color: member.color || COLORS[0], serviceIds: member.service_ids }
    : { name: "", color: COLORS[(staff?.length ?? 0) % COLORS.length], serviceIds: activeServices.map((service) => service.id) });

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const response = await fetch("/api/staff", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "");
  }

  async function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2) return toast.error(t("ჩაწერეთ სახელი.", "Enter the name."));
    if (activeServices.length > 0 && draft.serviceIds.length === 0) return toast.error(t("აირჩიეთ სერვისები.", "Choose the services."));
    setSaving(true);
    try {
      const body = { full_name: draft.name.trim(), color: draft.color, service_ids: draft.serviceIds };
      await request(draft.id ? "PATCH" : "POST", draft.id ? { id: draft.id, ...body } : body);
      toast.success(draft.id ? t("შენახულია.", "Saved.") : t("სპეციალისტი დაემატა. ახლა მიუთითეთ სამუშაო საათები.", "Specialist added. Now set their working hours."));
      setDraft(null);
      await load();
    } catch (error) {
      toast.error((error instanceof Error && error.message.split(" / ")[0]) || t("შენახვა ვერ მოხერხდა.", "Could not save."));
    } finally { setSaving(false); }
  }

  async function setActive(member: Staff, active: boolean) {
    try {
      await request("PATCH", { id: member.id, is_active: active });
      toast.success(active ? t("სპეციალისტი ჩაირთო.", "Specialist is on.") : t("სპეციალისტი გამოირთო. ახალ ჯავშნებს აღარ მიიღებს.", "Specialist is off and gets no new bookings."));
      setDraft(null);
      await load();
    } catch (error) {
      toast.error((error instanceof Error && error.message.split(" / ")[0]) || t("შენახვა ვერ მოხერხდა.", "Could not save."));
    }
  }

  const active = (staff ?? []).filter((member) => member.is_active);
  const inactive = (staff ?? []).filter((member) => !member.is_active);
  const editing = draft?.id ? staff?.find((member) => member.id === draft.id) : undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("სპეციალისტები", "Specialists")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("ვინ მუშაობს სალონში და რა სერვისებს ასრულებს.", "Who works in the salon and which services they do.")}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>{t("სპეციალისტის დამატება", "Add specialist")}</Button>
      </header>

      {staff === null ? <Skeleton className="h-40" /> : active.length === 0 ? (
        <Card><EmptyState icon={<Users />} title={t("სპეციალისტები ჯერ არ არის", "No specialists yet")} text={t("დაამატეთ თავი ან გუნდის წევრები. თითოეულს თავისი სვეტი ექნება კალენდარში.", "Add yourself or your team. Each gets their own column in the calendar.")}
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>{t("სპეციალისტის დამატება", "Add specialist")}</Button>} /></Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-stone-100">
            {active.map((member) => (
              <li key={member.id}>
                <button type="button" onClick={() => open(member)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-stone-50 sm:px-5">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: member.color || COLORS[0] }}>{member.full_name.charAt(0)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-stone-900">{member.full_name}</span>
                    <span className="block truncate text-sm text-stone-500">{serviceNames(member.service_ids) || t("სერვისი არ არის მინიჭებული", "No services assigned")}</span>
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
            {t(`გამორთული (${inactive.length})`, `Switched off (${inactive.length})`)}<span className="text-stone-400 group-open:hidden">{t("ნახვა", "Show")}</span>
          </summary>
          <ul className="divide-y divide-stone-100 border-t border-stone-100">
            {inactive.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="truncate text-stone-500">{member.full_name} <Badge className="ml-1">{t("გამორთული", "Off")}</Badge></span>
                <Button size="sm" variant="secondary" onClick={() => void setActive(member, true)}>{t("ჩართვა", "Turn on")}</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t("სპეციალისტის შეცვლა", "Edit specialist") : t("ახალი სპეციალისტი", "New specialist")}
        footer={<Button size="lg" block loading={saving} onClick={() => void save()}>{t("შენახვა", "Save")}</Button>}>
        {draft && <div className="space-y-5">
          <Field label={t("სახელი და გვარი", "Full name")}>{(props) => <Input {...props} value={draft.name} maxLength={120} placeholder={t("მაგ. ანა ბერიძე", "e.g. Ana Beridze")} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</Field>
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("ფერი კალენდარში", "Color in the calendar")}</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setDraft({ ...draft, color })} aria-label={color} aria-pressed={draft.color === color}
                  className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 transition", draft.color === color && "ring-2 ring-stone-900")} style={{ backgroundColor: color }}>
                  {draft.color === color && <Check className="h-5 w-5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          {activeServices.length > 0 ? <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("რა სერვისებს ასრულებს", "Services they do")}</p>
            <ChipRow className="flex-wrap">{activeServices.map((service) => {
              const selected = draft.serviceIds.includes(service.id);
              return <Chip key={service.id} selected={selected} onClick={() => setDraft({ ...draft, serviceIds: selected ? draft.serviceIds.filter((id) => id !== service.id) : [...draft.serviceIds, service.id] })}>{service.name_ka}</Chip>;
            })}</ChipRow>
          </div> : <p className="text-sm text-stone-500">{t("სერვისების დამატების შემდეგ აქვე მიუთითებთ, რას ასრულებს.", "Once you add services, choose here which ones they do.")}</p>}
          {editing && <Button variant="ghost" block onClick={() => void setActive(editing, false)}>{t("სპეციალისტის გამორთვა", "Switch the specialist off")}</Button>}
        </div>}
      </Sheet>
    </div>
  );
}
