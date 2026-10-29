"use client";

import React, { useState, useEffect } from "react";
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
  CheckCircle2,
  BellRing,
  Calendar,
  Zap,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"business" | "multi_branch" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup") {
        setMode("signup");
      }
      const plan = params.get("plan");
      if (plan === "business" || plan === "multi_branch") {
        setSelectedPlan(plan);
      }
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
          setError(
            signInError.message === "Invalid login credentials"
              ? t(
                  "ელ-ფოსტა ან პაროლი არასწორია. გთხოვთ გადაამოწმოთ.",
                  "Invalid email or password. Please verify your credentials."
                )
              : signInError.message
          );
          setLoading(false);
          return;
        }

        router.push(selectedPlan ? `/billing?plan=${selectedPlan}` : "/dashboard");
        router.refresh();
      } else {
        // Secure server-side registration with pre-confirmed email (bypasses failing SMTP restrictions)
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            salonName: salonName.trim(),
          }),
        });

        const regData = await regRes.json();

        if (!regRes.ok) {
          setError(
            regData.error ||
              t(
                "რეგისტრაციისას დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.",
                "Registration failed. Please try again."
              )
          );
          setLoading(false);
          return;
        }

        // Auto sign-in immediately upon registration
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setInfoMessage(
            t(
              "სალონის ანგარიში წარმატებით შეიქმნა! გთხოვთ გაიაროთ ავტორიზაცია.",
              "Salon account created successfully! Please sign in with your credentials."
            )
          );
          setMode("signin");
          setLoading(false);
          return;
        }

        router.push(selectedPlan ? `/billing?plan=${selectedPlan}` : "/dashboard");
        router.refresh();
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
      {/* Left Brand Showcase Side */}
      <div className="lg:w-1/2 bg-gradient-to-br from-stone-900 via-rose-950 to-stone-950 text-white p-6 sm:p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header / Back Link */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-rose-200 text-xs font-bold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("მთავარზე დაბრუნება", "Back to Home")}</span>
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Brand Pitch & Highlights */}
        <div className="relative z-10 my-8 sm:my-12 max-w-xl space-y-6">
          <Link href="/" className="inline-block hover:opacity-95 transition">
            <MoargeLogo size="lg" variant="full" theme="white" />
          </Link>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.14] text-white">
            {t("მოარგეთ სალონი ", "Tailor Your Salon with ")}
            <span className="bg-gradient-to-r from-rose-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
              moarge
            </span>
            {t("-ს ჭკვიან ავტომატიზაციას", "-s Smart Automation")}
          </h1>

          <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
            {t(
              "პერსონალური ონლაინ ჯავშნის გვერდი, რეალურ დროში დაცული გრაფიკი გადაფარვების გარეშე და ავტომატური შეხსენებები, რომლებიც თქვენს კლიენტებს სტაბილურად აბრუნებს.",
              "Custom online booking, real-time schedule conflict prevention, and smart automated care reminders that steadily bring clients back."
            )}
          </p>

          {/* 3 Core Value Cards */}
          <div className="pt-2 space-y-3">
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {t("ავტომატური შეხსენებების ძრავა", "Smart Client Retention Engine")}
                </div>
                <div className="text-[12px] text-stone-300 mt-0.5 leading-relaxed">
                  {t(
                    "ვიზიტის დასრულების შემდეგ სისტემა ავტომატურად ამზადებს და უგზავნის კლიენტს პერსონალურ მოწვევას მომდევნო ვიზიტზე — თქვენი ჩარევის გარეშე.",
                    "moarge automatically schedules and dispatches personalized invitations for their next session once marked completed."
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {t("ჯავშნების გადაფარვისგან დაცვა", "Booking conflict prevention")}
                </div>
                <div className="text-[12px] text-stone-300 mt-0.5 leading-relaxed">
                  {t(
                    "მომენტალურად ბლოკავს გადაფარვებს პროცედურის ხანგრძლივობის გათვალისწინებით როგორც ონლაინ, ასევე ადმინისტრატორის მხრიდან.",
                    "Blocks double bookings in real time based on exact procedure durations across both public and admin booking flows."
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {t("თქვენი ბრენდი, სერვისები და ფასები ლარში (₾)", "Custom Branding & GEL Pricing")}
                </div>
                <div className="text-[12px] text-stone-300 mt-0.5 leading-relaxed">
                  {t(
                    "სრული კონტროლი: სალონის სახელი, სამუშაო საათები, მზა პროფესიული თემფლეითები და თქვენი უნიკალური ონლაინ ჯავშნის ბმული.",
                    "Complete control over salon hours, GEL service catalogs, one-click templates, and your dedicated booking URL."
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Security Assurance */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            {t("დაცულია Row Level Security (RLS) არქიტექტურით", "Protected by Supabase RLS Architecture")}
          </span>
          <Link
            href="/book"
            className="text-rose-300 hover:text-white font-semibold transition"
          >
            {t("ონლაინ ჯავშნის ნახვა →", "View Online Booking →")}
          </Link>
        </div>
      </div>

      {/* Right Login / Register Card */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-7 sm:p-10">
          {/* Header Title */}
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              {t("moarge სალონის პორტალი", "moarge Salon Portal")}
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              {mode === "signin"
                ? t("სალონის ავტორიზაცია", "Salon Staff Sign In")
                : t("ახალი სალონის რეგისტრაცია", "Register New Salon")}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-stone-500 leading-relaxed">
              {mode === "signin"
                ? t(
                    "შედით თქვენი სალონის სამუშაო სივრცეში და მართეთ განრიგი.",
                    "Sign in to your salon workspace, calendar, and reminders."
                  )
                : selectedPlan
                  ? t(
                      `რეგისტრაციის შემდეგ გააგრძელებთ ${selectedPlan === "business" ? "Business" : "Multi-branch"} პაკეტის გადახდას.`,
                      `After registration, continue to checkout for the ${selectedPlan === "business" ? "Business" : "Multi-branch"} plan.`
                    )
                  : t(
                      "დაარეგისტრირეთ სალონი და გამოიყენეთ moarge 14 დღე უფასოდ.",
                      "Register your salon and try moarge free for 14 days."
                    )}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="mt-6 flex p-1 bg-stone-100 rounded-2xl border border-stone-200/60">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                mode === "signin"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {t("შესვლა", "Sign In")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                mode === "signup"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {selectedPlan
                ? t("გეგმით რეგისტრაცია", "Register with selected plan")
                : t("რეგისტრაცია (14 დღე უფასოდ)", "Register (Free Trial)")}
            </button>
          </div>

          {/* Error / Info Messages */}
          {error && (
            <div
              role="alert"
              className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label
                    htmlFor="salonName"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5"
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
                      placeholder={t("მაგ: Silk Laser Bar", "e.g. Silk Laser Bar")}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {t(
                      "ეს სახელი გამოჩნდება თქვენს სამუშაო პანელზე და ჯავშნის გვერდზე.",
                      "This brand will appear on your dashboard and public booking page."
                    )}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5"
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
                className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5"
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
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-stone-700"
                >
                  {t("პაროლი *", "Password *")}
                </label>
                {mode === "signin" && (
                  <span className="text-[11px] text-stone-400">
                    {t("მინიმუმ 6 სიმბოლო", "Min. 6 characters")}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-rose-600/25 hover:shadow-rose-600/35 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? (
                <span>{t("მიმდინარეობს დამუშავება...", "Processing...")}</span>
              ) : mode === "signin" ? (
                <>
                  <span>{t("სალონის პანელში შესვლა", "Sign In to Dashboard")}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t("სალონის რეგისტრაცია", "Create Salon Workspace")}</span>
                </>
              )}
            </button>
          </form>

          {mode === "signup" && <div className="mt-6 border-t border-stone-100 pt-5 text-[11px] text-stone-500">
            {selectedPlan ? (
              <p>{t("არჩეული პაკეტი ბილინგის გვერდზე გამოჩნდება რეგისტრაციის შემდეგ. ბარათით გადახდა ჯერ ჩართული არ არის.", "Your selected plan will appear on the billing page after registration. Card payments are not enabled yet.")}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span>{t("14-დღიანი უფასო საცდელი პერიოდი", "14-day free trial")}</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /><span>{t("საკრედიტო ბარათი არ არის საჭირო", "No credit card required")}</span></div>
              </div>
            )}
          </div>}

          {/* Legal and Terms Notice */}
          <div className="mt-5 text-center text-[11px] text-stone-400 leading-relaxed">
            {t("ავტორიზაციით თქვენ ეთანხმებით", "By signing in, you agree to our")}{" "}
            <Link href="/terms" className="text-stone-600 hover:underline font-semibold">
              {t("წესებსა და პირობებს", "Terms of Service")}
            </Link>{" "}
            {t("და", "and")}{" "}
            <Link href="/privacy" className="text-stone-600 hover:underline font-semibold">
              {t("კონფიდენციალურობის პოლიტიკას", "Privacy Policy")}
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
