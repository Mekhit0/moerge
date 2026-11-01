"use client";

import React, { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { normalizeGeorgianPhone } from "@/lib/validation";
import { Alert, Button, Chip, ChipRow, Field, Input, Sheet, Textarea } from "@/components/ui";

export interface ClientFormValue {
  id?: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  preferred_staff_id: string | null;
  notes: string | null;
  sms_consent: boolean;
  email_consent: boolean;
  preferred_language: "ka" | "en";
}

export interface StaffOption { id: string; full_name: string; color: string | null }

function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "en" && en ? en : ka;
}

const EMPTY: ClientFormValue = {
  full_name: "", phone: "", email: "", birthday: null, preferred_staff_id: null, notes: "",
  sms_consent: false, email_consent: false, preferred_language: "ka",
};

/**
 * New client or edit an existing one. Only name and phone are needed; everything else is optional
 * and folded under "More" so a quick entry at the reception desk stays two fields.
 */
export function ClientFormSheet({ open, client, staff, onClose, onSaved }: {
  open: boolean;
  client: ClientFormValue | null;
  staff: StaffOption[];
  onClose: () => void;
  onSaved: (client: Record<string, unknown>) => void;
}) {
  const { lang, t } = useLanguage();
  const [value, setValue] = useState<ClientFormValue>(EMPTY);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const start = client ?? EMPTY;
      setValue({ ...start, phone: start.phone ?? "", email: start.email ?? "", notes: start.notes ?? "" });
      setMore(Boolean(client && (client.email || client.birthday || client.preferred_staff_id || client.notes)));
      setError(null);
      setExistingId(null);
    }
  }

  const set = <K extends keyof ClientFormValue>(key: K, next: ClientFormValue[K]) => setValue((current) => ({ ...current, [key]: next }));
  const phoneOk = Boolean(value.phone && normalizeGeorgianPhone(value.phone));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value.full_name.trim().length < 2) { setError(t("ჩაწერეთ სახელი.", "Enter the name.")); return; }
    if (!phoneOk) { setError(t("შეიყვანეთ ქართული მობილური, მაგ: 5XX XX XX XX.", "Enter a Georgian mobile number such as 5XX XX XX XX.")); return; }
    setBusy(true);
    setError(null);
    setExistingId(null);
    const response = await fetch(client?.id ? `/api/clients/${client.id}` : "/api/clients", {
      method: client?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: value.full_name.trim(),
        phone: value.phone,
        email: value.email?.trim() || null,
        birthday: value.birthday || null,
        preferred_staff_id: value.preferred_staff_id,
        notes: value.notes?.trim() || null,
        sms_consent: value.sms_consent,
        email_consent: value.email_consent,
        preferred_language: value.preferred_language,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!response) { setError(t("ქსელური შეცდომა. სცადეთ თავიდან.", "Network error. Please try again.")); return; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(localMessage(String(data.error ?? "Error"), lang));
      if (typeof data.client_id === "string") setExistingId(data.client_id);
      return;
    }
    onSaved(data.client as Record<string, unknown>);
  }

  return (
    <Sheet open={open} onClose={onClose} title={client?.id ? t("კლიენტის რედაქტირება", "Edit client") : t("ახალი კლიენტი", "New client")}
      footer={<Button type="submit" form="client-form" size="lg" block loading={busy}>{t("შენახვა", "Save")}</Button>}>
      <form id="client-form" onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert tone="error">
          {error}
          {existingId && <> <a className="font-semibold underline" href={`/clients/${existingId}`}>{t("გახსნა", "Open")}</a></>}
        </Alert>}
        <Field label={t("სახელი და გვარი", "Full name")}>
          {(props) => <Input {...props} value={value.full_name} onChange={(event) => set("full_name", event.target.value)} autoComplete="off" maxLength={120} />}
        </Field>
        <Field label={t("მობილური", "Mobile")} hint={t("მაგ: 555 12 34 56", "e.g. 555 12 34 56")}>
          {(props) => <Input {...props} type="tel" inputMode="tel" value={value.phone ?? ""} onChange={(event) => set("phone", event.target.value)} autoComplete="off" maxLength={40} />}
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm text-stone-700">
          <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={value.sms_consent} onChange={(event) => set("sms_consent", event.target.checked)} />
          {t("თანახმაა SMS შეხსენებებზე", "Agrees to SMS reminders")}
        </label>

        {!more && <button type="button" onClick={() => setMore(true)} className="min-h-11 text-sm font-semibold text-brand-strong hover:underline">
          {t("+ მეტი ინფორმაცია", "+ More details")}
        </button>}

        {more && <div className="space-y-5 border-t border-stone-100 pt-5">
          <Field label={t("მნიშვნელოვანი შენიშვნა", "Important note")} optionalLabel={t("(ჩანს ყველგან)", "(shown everywhere)")}>
            {(props) => <Textarea {...props} value={value.notes ?? ""} onChange={(event) => set("notes", event.target.value)} maxLength={1000}
              placeholder={t("მაგ: ალერგია ლატექსზე", "e.g. allergic to latex")} />}
          </Field>
          <Field label={t("დაბადების დღე", "Birthday")} optionalLabel={t("(არასავალდებულო)", "(optional)")}>
            {(props) => <Input {...props} type="date" value={value.birthday ?? ""} max={new Date().toISOString().slice(0, 10)} onChange={(event) => set("birthday", event.target.value || null)} />}
          </Field>
          {staff.length > 0 && <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("საყვარელი სპეციალისტი", "Preferred specialist")}</p>
            <ChipRow>
              <Chip selected={!value.preferred_staff_id} onClick={() => set("preferred_staff_id", null)}>{t("არცერთი", "None")}</Chip>
              {staff.map((member) => (
                <Chip key={member.id} selected={value.preferred_staff_id === member.id} dotColor={member.color ?? undefined}
                  onClick={() => set("preferred_staff_id", member.id)}>{member.full_name}</Chip>
              ))}
            </ChipRow>
          </div>}
          <Field label={t("ელ-ფოსტა", "Email")} optionalLabel={t("(არასავალდებულო)", "(optional)")}>
            {(props) => <Input {...props} type="email" inputMode="email" value={value.email ?? ""} onChange={(event) => set("email", event.target.value)} autoComplete="off" />}
          </Field>
          {value.email && <label className="flex min-h-11 items-center gap-3 text-sm text-stone-700">
            <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={value.email_consent} onChange={(event) => set("email_consent", event.target.checked)} />
            {t("თანახმაა ელ-ფოსტით შეხსენებებზე", "Agrees to email reminders")}
          </label>}
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("შეტყობინებების ენა", "Message language")}</p>
            <ChipRow>
              <Chip selected={value.preferred_language === "ka"} onClick={() => set("preferred_language", "ka")}>ქართული</Chip>
              <Chip selected={value.preferred_language === "en"} onClick={() => set("preferred_language", "en")}>English</Chip>
            </ChipRow>
          </div>
        </div>}
      </form>
    </Sheet>
  );
}
