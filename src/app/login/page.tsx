"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Lock,
  Mail,
  User,
  Users,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { currentOffer } from "@/lib/pricing";
import { appUrl } from "@/lib/app-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import TurnstileWidget, { TURNSTILE_SITE_KEY } from "@/components/TurnstileWidget";

type Mode = "signin" | "signup" | "reset";

const inputClass =
  "w-full min-h-12 pl-11 pr-4 rounded-xl border border-stone-200 bg-stone-50/50 text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition";

export default function LoginPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [salonName, setSalonName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState("/dashboard");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use; bumping the key renders a fresh check after each attempt.
  const [turnstileKey, setTurnstileKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    setRedirectTo(safeRedirectPath(params.get("redirectTo"), "/dashboard"));
    if (params.get("confirmed") === "true") {
      setInfoMessage(t("ელფოსტა დადასტურდა. შედით ანგარიშზე.", "Your email is confirmed. Please sign in."));
    }
    if (params.get("access") === "none") {
      const supabase = createBrowserSupabaseClient();
      void supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        void supabase.auth.signOut();
        setError(t("ამ ანგარიშს სალონზე წვდომა აღარ აქვს. დაუკავშირდით სალონის მფლობელს.", "This account no longer has access to a salon. Contact the salon owner."));
      });
    }
    if (params.get("reset") === "expired") {
      setMode("reset");
      setError(t("ბმულის ვადა გავიდა. მოითხოვეთ ახალი.", "That link has expired. Please request a new one."));
    }
  }, [t]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfoMessage(null);
  }

  function friendlyAuthError(message: string): string {
    if (message === "Invalid login credentials") {
      return t("ელფოსტა ან პაროლი არასწორია.", "The email or password is wrong.");
    }
    if (/rate limit|too many/i.test(message)) {
      return t("ძალიან ბევრი მცდელობა. სცადეთ რამდენიმე წუთში.", "Too many attempts. Please try again in a few minutes.");
    }
    return message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();

      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: appUrl("/auth/callback?next=%2Freset-password"),
        });
        if (resetError) {
          setError(friendlyAuthError(resetError.message));
        } else {
          setInfoMessage(t(
            "თუ ეს ელფოსტა რეგისტრირებულია, რამდენიმე წუთში მიიღებთ ბმულს ახალი პაროლისთვის. შეამოწმეთ Spam საქაღალდეც.",
            "If this email is registered, you'll get a link to set a new password in a few minutes. Check your spam folder too."
          ));
        }
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            salonName: salonName.trim(),
            turnstile_token: turnstileToken,
          }),
        });
        const regData = await regRes.json().catch(() => ({}));
        setTurnstileToken(null);
        setTurnstileKey((key) => key + 1);
        if (!regRes.ok) {
          setError(regData.error || t("რეგისტრაცია ვერ მოხერხდა. სცადეთ თავიდან.", "Sign-up failed. Please try again."));
          setLoading(false);
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        if (mode === "signup") {
          setInfoMessage(t("ანგარიში შეიქმნა. ახლა შედით.", "Your account is ready. Please sign in."));
          setMode("signin");
        } else {
          setError(friendlyAuthError(signInError.message));
        }
        setLoading(false);
        return;
      }

      router.push(mode === "signup" ? "/dashboard" : redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("რაღაც შეცდომა მოხდა. სცადეთ თავიდან.", "Something went wrong. Please try again."));
      setLoading(false);
    }
  }

  const title = mode === "signin"
    ? t("შესვლა", "Sign in")
    : mode === "signup"
      ? t("სალონის რეგისტრაცია", "Register your salon")
      : t("პაროლის აღდგენა", "Reset your password");

  const subtitle = mode === "signin"
    ? t("შედით თქვენი სალონის პანელში.", "Sign in to your salon dashboard.")
    : mode === "signup"
      ? t(`${currentOffer().trialDays} დღე უფასოდ, ბარათის გარეშე.`, `${currentOffer().trialDays} days free, no card needed.`)
      : t("მიუთითეთ ელფოსტა და გამოგიგზავნით ბმულს ახალი პაროლისთვის.", "Enter your email and we'll send you a link to set a new password.");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-ivory">
      {/* Brand panel: computers only, so phones see the form first */}
      <aside className="hidden lg:flex lg:w-1/2 bg-stone-900 text-white p-14 flex-col justify-between">
        <Link href="/" className="relative z-10 inline-block w-fit hover:opacity-95 transition">
          <MoargeLogo size="lg" variant="full" theme="white" />
        </Link>
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.12]">
            {t("სალონის ჯავშნები ", "Salon bookings ")}
            <span className="text-rose-400">
              {t("რვეულის გარეშე", "without the notebook")}
            </span>
          </h1>
          <ul className="space-y-4 text-base text-stone-200">
            {[
              { icon: Gift, text: t(`${currentOffer().trialDays} დღე უფასოდ, ბარათის გარეშე`, `${currentOffer().trialDays} days free, no card needed`) },
              { icon: CalendarDays, text: t("ონლაინ ჯავშნები და მარტივი კალენდარი", "Online booking and a simple calendar") },
              { icon: Users, text: t(`${BILLING_CONFIG.trialStaffLimit}-მდე სპეციალისტი`, `Up to ${BILLING_CONFIG.trialStaffLimit} specialists`) },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-rose-400 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-stone-400">© {new Date().getFullYear()} moarge</p>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-stone-600 hover:text-rose-700">
            <ArrowLeft className="w-4 h-4" />
            <span className="lg:hidden"><MoargeLogo size="sm" variant="full" /></span>
            <span className="hidden lg:inline">{t("მთავარი გვერდი", "Home")}</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-10 sm:p-8">
          <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-6 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">{title}</h2>
            <p className="mt-1.5 text-sm sm:text-base text-stone-500">{subtitle}</p>

            {mode !== "reset" && (
              <div className="mt-6 grid grid-cols-2 p-1 bg-stone-100 rounded-2xl" role="tablist">
                {(["signin", "signup"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab}
                    onClick={() => switchMode(tab)}
                    className={`min-h-11 text-sm font-semibold rounded-xl transition ${mode === tab ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900"}`}
                  >
                    {tab === "signin" ? t("შესვლა", "Sign in") : t("რეგისტრაცია", "Sign up")}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {infoMessage && (
              <div role="status" className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <Field id="salonName" label={t("სალონის სახელი", "Salon name")} icon={Building2}
                    hint={t("გამოჩნდება თქვენს ჯავშნის გვერდზე.", "Shown on your booking page.")}>
                    <input id="salonName" type="text" required autoComplete="organization" value={salonName}
                      onChange={(e) => setSalonName(e.target.value)} placeholder={t("მაგ: სალონი ია", "e.g. Salon Ia")} className={inputClass} />
                  </Field>
                  <Field id="fullName" label={t("თქვენი სახელი", "Your name")} icon={User}>
                    <input id="fullName" type="text" required autoComplete="name" value={fullName}
                      onChange={(e) => setFullName(e.target.value)} placeholder={t("ნინო ბერიძე", "Nino Beridze")} className={inputClass} />
                  </Field>
                </>
              )}

              <Field id="email" label={t("ელფოსტა", "Email")} icon={Mail}>
                <input id="email" type="email" required autoComplete="email" inputMode="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="salon@gmail.com" className={inputClass} />
              </Field>

              {mode !== "reset" && (
                <Field
                  id="password"
                  label={t("პაროლი", "Password")}
                  icon={Lock}
                  hint={mode === "signup" ? t("მინიმუმ 6 სიმბოლო.", "At least 6 characters.") : undefined}
                  action={mode === "signin" ? (
                    <button type="button" onClick={() => switchMode("reset")} className="text-sm font-semibold text-rose-700 hover:underline">
                      {t("დაგავიწყდათ?", "Forgot it?")}
                    </button>
                  ) : undefined}
                >
                  <input id="password" type={showPassword ? "text" : "password"} required minLength={6}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex min-h-10 min-w-10 items-center justify-center text-stone-400 hover:text-stone-600"
                    aria-label={showPassword ? t("პაროლის დამალვა", "Hide password") : t("პაროლის ჩვენება", "Show password")}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </Field>
              )}

              {mode === "signup" && <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} language={lang} />}

              <button type="submit" disabled={loading || (mode === "signup" && Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                className="w-full min-h-14 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition">
                {loading
                  ? t("გთხოვთ დაელოდოთ...", "Please wait...")
                  : mode === "signin"
                    ? <>{t("შესვლა", "Sign in")}<ArrowRight className="w-5 h-5" /></>
                    : mode === "signup"
                      ? <>{t("რეგისტრაცია", "Create account")}<ArrowRight className="w-5 h-5" /></>
                      : t("ბმულის გაგზავნა", "Send link")}
              </button>
            </form>

            {mode === "reset" && (
              <button type="button" onClick={() => switchMode("signin")} className="mt-4 w-full min-h-11 text-sm font-semibold text-stone-600 hover:text-rose-700">
                {t("შესვლაზე დაბრუნება", "Back to sign in")}
              </button>
            )}

            <p className="mt-6 text-center text-xs text-stone-400 leading-relaxed">
              {mode === "signup"
                ? t("რეგისტრაციით ეთანხმებით", "By signing up you agree to the")
                : t("შესვლით ეთანხმებით", "By signing in you agree to the")}{" "}
              <Link href="/terms" className="text-stone-600 hover:underline font-semibold">{t("წესებს", "Terms")}</Link>{" "}
              {t("და", "and")}{" "}
              <Link href="/privacy" className="text-stone-600 hover:underline font-semibold">{t("კონფიდენციალურობის პოლიტიკას", "Privacy Policy")}</Link>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  hint,
  action,
  children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-stone-700">{label}</label>
        {action}
      </div>
      <div className="relative">
        <Icon className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {children}
      </div>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
