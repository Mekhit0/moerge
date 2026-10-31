"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import MoargeLogo from "@/components/MoargeLogo";
import { Alert, Button, ButtonLink, Field, Input } from "@/components/ui";

export interface InviteInfo {
  email: string;
  role: "admin" | "staff";
  salonName: string;
  staffName: string | null;
}

/** Join a salon from an invite link: the email is fixed, the person only picks a name and password. */
export default function InviteAccept({ token, invite }: { token: string; invite: InviteInfo | null }) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [fullName, setFullName] = useState(invite?.staffName ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!invite) return;
    if (password.length < 8) {
      setError(t("პაროლი უნდა იყოს მინიმუმ 8 სიმბოლო.", "The password must be at least 8 characters."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, full_name: fullName, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Error");
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password });
      if (signInError) throw new Error(t("ანგარიში შეიქმნა. შედით ელ-ფოსტით და პაროლით.", "Your account is ready. Sign in with your email and password."));
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Error";
      const [ka, en] = message.split(" / ");
      setError(lang === "en" && en ? en : ka);
      setBusy(false);
    }
  }

  const roleLabel = invite?.role === "admin"
    ? t("ადმინისტრატორი", "Admin")
    : t("სპეციალისტი", "Specialist");

  return (
    <div className="min-h-screen bg-ivory">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link href="/" className="inline-flex min-h-10 items-center rounded-xl px-2"><MoargeLogo size="sm" variant="full" /></Link>
        <LanguageSwitcher />
      </div>
      <main className="flex justify-center px-4 pb-10 pt-2 sm:pt-10">
        <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-6 shadow-xl shadow-rose-950/5 sm:p-10">
          {invite ? (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div>
                <p className="text-sm font-semibold text-brand">{t("მოწვევა", "Invitation")}</p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{invite.salonName}</h1>
                <p className="mt-2 text-sm text-stone-600">
                  {invite.role === "staff"
                    ? t("გიწვევთ გუნდში. ნახავთ თქვენს ვიზიტებს და კლიენტებს.", "invites you to the team. You will see your own visits and clients.")
                    : t("გიწვევთ გუნდში. ნახავთ სალონის კალენდარს და კლიენტებს.", "invites you to the team. You will see the salon calendar and clients.")}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-stone-50 p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-stone-500">{t("ელ-ფოსტა", "Email")}</dt><dd className="mt-0.5 break-all font-semibold text-stone-900">{invite.email}</dd></div>
                <div><dt className="text-stone-500">{t("როლი", "Role")}</dt><dd className="mt-0.5 font-semibold text-stone-900">{roleLabel}</dd></div>
              </dl>

              {error && <Alert tone="error">{error}</Alert>}

              <Field label={t("თქვენი სახელი", "Your name")}>
                {(props) => <Input {...props} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={80} required />}
              </Field>
              <Field label={t("შექმენით პაროლი", "Create a password")} hint={t("მინიმუმ 8 სიმბოლო", "At least 8 characters")}>
                {(props) => <Input {...props} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />}
              </Field>

              <Button type="submit" size="lg" block loading={busy} disabled={!fullName.trim() || password.length < 8} icon={<Lock className="h-5 w-5" />}>
                {t("გუნდში შესვლა", "Join the team")}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><User className="h-6 w-6" /></span>
              <h1 className="text-xl font-extrabold text-stone-900">{t("ბმული აღარ მოქმედებს", "This link no longer works")}</h1>
              <p className="text-sm text-stone-600">{t("მოწვევა ვადაგასულია ან უკვე გამოყენებულია. სთხოვეთ სალონს ახალი ბმული.", "The invitation has expired or was already used. Ask the salon for a new link.")}</p>
              <ButtonLink href="/login" variant="secondary" block>{t("შესვლა", "Sign in")}</ButtonLink>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
