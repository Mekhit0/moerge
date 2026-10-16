"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Building2,
  User,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("confirmed") === "true") {
        setInfoMessage(
          t(
            "თქვენი ელ-ფოსტა წარმატებით დადასტურდა! გთხოვთ გაიაროთ ავტორიზაცია.",
            "Your email has been verified successfully! Please sign in."
          )
        );
        setMode("signin");
      }
    }
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        const redirectUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "https://moerge.vercel.app/auth/callback";

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim() || "Salon Owner",
              salon_name: salonName.trim() || "My Beauty Salon",
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setInfoMessage(
            t(
              "სალონის ანგარიში შეიქმნა! გთხოვთ შეამოწმოთ თქვენი ელ-ფოსტა ვერიფიკაციის ბმულისთვის.",
              "Salon account created! Please check your email inbox for the verification link."
            )
          );
          setMode("signin");
          setLoading(false);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("დაფიქსირდა გაუთვალისწინებელი შეცდომა.", "An unexpected error occurred.")
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#fdf8f6]">
      {/* Left Brand Showcase */}
      <div className="lg:w-1/2 bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 text-rose-200 text-xs font-bold tracking-wide uppercase transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-300" />
              MOERGE • {t("მთავარ გვერდზე დაბრუნება", "Back to Home")}
            </Link>
            <LanguageSwitcher />
          </div>

          <h1 className="mt-6 text-3xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            MOERGE — {t("სალონის მართვის სისტემა", "Salon Management Ecosystem")}
          </h1>
          <p className="mt-4 text-rose-100/85 text-base lg:text-lg max-w-xl leading-relaxed">
            {t(
              "დაარეგისტრირეთ თქვენი სალონი, შექმენით მორგებული ონლაინ ჯავშნის გვერდი და ავტომატურად მართეთ 21-დღიანი შეხსენებები.",
              "Register your salon on MOERGE, launch your custom online booking page, and automate 21-day epilation reminder emails."
            )}
          </p>
        </div>

        <div className="relative z-10 mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="text-rose-200 text-xs font-semibold uppercase tracking-wider">
              {t("თქვენი სალონის ბრენდი", "Your Salon Branding")}
            </div>
            <p className="mt-1 text-sm text-white/90">
              {t(
                "პანელზე და ჯავშნის გვერდზე ჩანს თქვენი სალონის სახელი და ფასები (₾).",
                "Your own salon name and GEL pricing are showcased across the dashboard and booking page."
              )}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
            <div className="text-rose-200 text-xs font-semibold uppercase tracking-wider">
              {t("ზუსტი 21-დღიანი ციკლი (GMT+4)", "21-Day Precision Cycle")}
            </div>
            <p className="mt-1 text-sm text-white/90">
              {t(
                "ითვლის ზუსტ კალენდარულ დღეებს საქართველოს დროის სარტყელის (Asia/Tbilisi) მიხედვით.",
                "Calculates exact calendar days in Georgia Standard Time (Asia/Tbilisi)."
              )}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200/80">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-300 shrink-0" />
            {t(
              "დაცულია Supabase Auth-ით და Row Level Security-ით (MOERGE SaaS)",
              "Protected by Supabase Auth & Row Level Security (MOERGE SaaS)"
            )}
          </span>
          <Link
            href="/book"
            className="text-rose-200 hover:text-white underline font-semibold"
          >
            {t("ონლაინ ჩაწერის გვერდი →", "Public Booking Page →")}
          </Link>
        </div>
      </div>

      {/* Right Login / Register Card */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-8 sm:p-10">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                MOERGE ECOSYSTEM
              </span>
              <h2 className="text-2xl font-bold text-stone-900 mt-0.5">
                {mode === "signin"
                  ? t("სალონის პერსონალის შესვლა", "Salon Staff Sign In")
                  : t("ახალი სალონის რეგისტრაცია", "Register New Salon")}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {mode === "signin"
                  ? t(
                      "შედით თქვენი სალონის მართვის პანელში.",
                      "Access your salon workspace and appointment reminders."
                    )
                  : t(
                      "დაარეგისტრირეთ თქვენი სალონის სახელი და შექმენით სამუშაო სივრცე.",
                      "Enter your salon name and create your dedicated workspace."
                    )}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="salonName"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                  >
                    {t("სალონის დასახელება *", "Salon Name *")}
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      id="salonName"
                      type="text"
                      required
                      value={salonName}
                      onChange={(e) => setSalonName(e.target.value)}
                      placeholder={t("მაგ: Lumière Studio, Silk Bar...", "e.g. Silk Laser Bar")}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {t(
                      "ეს სახელი გამოჩნდება თქვენს სამუშაო პანელზე და ჯავშნის გვერდზე.",
                      "This name will be displayed on your dashboard and public booking page."
                    )}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
                  >
                    {t("თქვენი სახელი და გვარი *", "Your Full Name *")}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("ნინო ბერიძე", "Nino Beridze")}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                {t("ელ-ფოსტის მისამართი *", "Email Address *")}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@yoursalon.ge"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5"
              >
                {t("პაროლი *", "Password *")}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading
                ? t("მიმდინარეობს დამუშავება...", "Processing...")
                : mode === "signin"
                ? t("პანელში შესვლა", "Sign In to Dashboard")
                : t("სალონის რეგისტრაცია", "Register Salon")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="text-xs text-stone-500 hover:text-rose-600 font-medium transition cursor-pointer"
            >
              {mode === "signin"
                ? t(
                    "გსურთ ახალი სალონის რეგისტრაცია? დარეგისტრირდით",
                    "Want to register a new salon? Sign Up"
                  )
                : t(
                    "უკვე გაქვთ სალონის ანგარიში? შესვლა",
                    "Already registered a salon? Sign In"
                  )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
