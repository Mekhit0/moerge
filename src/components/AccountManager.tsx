"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Alert, Button, Card, CardHeader } from "@/components/ui";

/** The signed-in person's account: who they are, and deleting the salon (owner) or their login. */
export default function AccountManager({ role, salonName, name, email }: { role: "owner" | "admin" | "staff"; salonName: string; name: string; email: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owner = role === "owner";
  const ready = owner ? confirm.trim() === salonName.trim() : confirm.trim().toLowerCase() === email.trim().toLowerCase();

  async function remove() {
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(owner ? { scope: "salon", confirm } : { scope: "me" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(String(result.error ?? t("ვერ მოხერხდა.", "Something went wrong."))); return; }
      await createBrowserSupabaseClient().auth.signOut().catch(() => undefined);
      router.replace("/?deleted=1");
      router.refresh();
    } catch {
      setError(t("ქსელური შეცდომა.", "Network error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("ჩემი ანგარიში", "My account")}</h1>
      <Card>
        <CardHeader title={name || email} description={email} />
        <p className="text-sm text-stone-600">{t(`სალონი: ${salonName}`, `Salon: ${salonName}`)}</p>
      </Card>

      <Card className="border-red-200">
        <CardHeader title={owner ? t("სალონის წაშლა", "Delete the salon") : t("ანგარიშის წაშლა", "Delete my account")} />
        {owner ? (
          <div className="space-y-3 text-sm leading-relaxed text-stone-700">
            <p>{t("წაიშლება სალონი და ყველაფერი მასში: კლიენტები, ვიზიტები, გადახდები, სპეციალისტები, პარამეტრები და SMS-ის ისტორია. წაიშლება თქვენი და იმ გუნდის წევრების შესვლაც, ვისაც სხვა სალონი არ აქვს. ამის დაბრუნება შეუძლებელია.",
              "This deletes the salon and everything in it: clients, visits, payments, specialists, settings and SMS history. Your login and those of team members with no other salon are deleted too. This cannot be undone.")}</p>
            <p>{t("ინვოისებს ვინახავთ იმდენ ხანს, რამდენსაც საგადასახადო კანონი მოითხოვს, კლიენტების მონაცემების გარეშე. აქტიური პაკეტი წყდება და შემდეგი თანხა აღარ ჩამოიჭრება.",
              "Invoices are kept as long as tax law requires, without client data. An active plan ends and nothing more is charged.")}</p>
            <Alert tone="warning">
              {t("წაშლამდე ჩამოტვირთეთ კლიენტების სია: ", "Before deleting, download your client list: ")}
              <Link href="/clients" className="font-semibold underline underline-offset-2">{t("კლიენტები → ექსპორტი", "Clients → Export")}</Link>
            </Alert>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-stone-700">{t("წაიშლება თქვენი შესვლა და სალონთან წვდომა. სალონში ჩაწერილი ვიზიტები და თქვენი სახელი სალონის ჩანაწერებში რჩება. ამის დაბრუნება შეუძლებელია.",
            "This deletes your login and your access to the salon. Visits recorded at the salon and your name in its records stay with the salon. This cannot be undone.")}</p>
        )}
        <label htmlFor="delete-confirm" className="mt-4 block text-sm font-semibold text-stone-800">
          {owner ? t(`დასადასტურებლად ჩაწერეთ სალონის სახელი: ${salonName}`, `To confirm, type the salon name: ${salonName}`)
            : t(`დასადასტურებლად ჩაწერეთ თქვენი ელ-ფოსტა: ${email}`, `To confirm, type your email: ${email}`)}
        </label>
        <input id="delete-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off"
          className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
        {error && <Alert tone="error" className="mt-3">{error}</Alert>}
        <Button variant="danger" className="mt-4" icon={<Trash2 className="h-4 w-4" />} loading={busy} disabled={!ready || busy} onClick={() => void remove()}>
          {owner ? t("სალონის სამუდამოდ წაშლა", "Delete the salon for good") : t("ანგარიშის სამუდამოდ წაშლა", "Delete my account for good")}
        </Button>
      </Card>
    </div>
  );
}
