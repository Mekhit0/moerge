"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("პაროლები არ ემთხვევა.", "The passwords don't match."));
      return;
    }
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full min-h-12 pl-11 pr-12 rounded-xl border border-stone-200 bg-stone-50/50 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition";

  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
        <Link href="/"><MoargeLogo size="sm" variant="full" /></Link>
        <LanguageSwitcher />
      </div>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">{t("ახალი პაროლი", "New password")}</h1>

          {hasSession === false ? (
            <div className="mt-4 space-y-4">
              <p className="text-base text-stone-600">
                {t("ბმული აღარ მოქმედებს. მოითხოვეთ ახალი ბმული შესვლის გვერდიდან.", "This link no longer works. Request a new one from the sign-in page.")}
              </p>
              <Link href="/login?reset=expired" className="inline-flex w-full min-h-12 items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold">
                {t("ახალი ბმულის მოთხოვნა", "Request a new link")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {[
                { id: "password", label: t("ახალი პაროლი", "New password"), value: password, set: setPassword },
                { id: "confirm", label: t("გაიმეორეთ პაროლი", "Repeat the password"), value: confirm, set: setConfirm },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="mb-1.5 block text-sm font-semibold text-stone-700">{field.label}</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input id={field.id} type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password"
                      value={field.value} onChange={(e) => field.set(e.target.value)} className={inputClass} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-10 min-w-10 items-center justify-center text-stone-400 hover:text-stone-600"
                      aria-label={showPassword ? t("პაროლის დამალვა", "Hide password") : t("პაროლის ჩვენება", "Show password")}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-stone-500">{t("მინიმუმ 6 სიმბოლო.", "At least 6 characters.")}</p>
              <button type="submit" disabled={saving || hasSession === null}
                className="w-full min-h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-rose-600/25 transition">
                {saving ? t("ინახება...", "Saving...") : t("პაროლის შენახვა", "Save password")}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
