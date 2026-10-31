"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Home,
  Users,
  CalendarDays,
  Settings,
  Wallet,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { SUPPORT_EMAIL } from "@/lib/contact";
import MoargeLogo from "./MoargeLogo";
import FeedbackButton from "./FeedbackButton";

interface AppShellProps {
  salonName: string;
  bookingUrl: string;
  autoRemindersEnabled: boolean;
  dryRunMode: boolean;
  emailDeliveryConfigured: boolean;
  staffName: string;
  staffEmail: string;
  canManageData: boolean;
  readOnly: boolean;
  isPlatformOwner?: boolean;
  children: React.ReactNode;
}

// Settings groups the setup pages that live outside /settings.
const SETTINGS_PATHS = ["/settings", "/billing", "/email-history"];

export default function AppShell({
  salonName,
  bookingUrl,
  autoRemindersEnabled,
  dryRunMode,
  emailDeliveryConfigured,
  staffName,
  staffEmail,
  canManageData,
  readOnly,
  isPlatformOwner = false,
  children,
}: AppShellProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: "/dashboard", label: t("დღეს", "Today"), icon: Home },
    { href: "/appointments", label: t("კალენდარი", "Calendar"), icon: CalendarDays },
    { href: "/clients", label: t("კლიენტები", "Clients"), icon: Users },
    ...(canManageData ? [{ href: "/reports", label: t("შემოსავალი", "Income"), icon: Wallet }] : []),
    { href: "/settings", label: t("პარამეტრები", "Settings"), icon: Settings },
  ];

  const isItemActive = (href: string) => {
    const paths = href === "/settings" ? SETTINGS_PATHS : [href];
    return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  };

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const reminderStatus = dryRunMode
    ? { tone: "amber", text: t("სატესტო რეჟიმი: შეხსენებები კლიენტებს არ ეგზავნებათ", "Test mode: reminders are not sent to clients") }
    : !autoRemindersEnabled
      ? { tone: "amber", text: t("ავტომატური შეხსენებები გამორთულია", "Automatic reminders are off") }
      : !emailDeliveryConfigured
        ? { tone: "amber", text: t("ელფოსტით შეხსენებები ჯერ არ მუშაობს", "Email reminders are not set up yet") }
        : { tone: "emerald", text: t("ავტომატური შეხსენებები ჩართულია", "Automatic reminders are on") };

  return (
    <div className="min-h-screen flex bg-[#fdf8f6] text-stone-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-stone-200 z-30">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-3 min-w-0">
            <MoargeLogo variant="icon" size="md" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">moarge</div>
              <p className="text-sm font-semibold text-stone-900 truncate" title={salonName}>
                {salonName}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <LanguageSwitcher />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label={t("მთავარი ნავიგაცია", "Main navigation")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${
                  isActive ? "bg-rose-600 text-white" : "text-stone-600 hover:bg-rose-50 hover:text-rose-900"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-rose-500"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-rose-50/80 hover:bg-rose-100 text-rose-800 text-sm font-semibold border border-rose-200/70 transition"
            >
              <span>{t("ჩემი ჯავშნის გვერდი", "My booking page")}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          </div>
        </nav>

        <div className="p-4 border-t border-rose-100/80 bg-rose-50/30 space-y-2">
          <div className="px-3 py-1">
            <div className="text-sm font-semibold text-stone-900 truncate">{staffName}</div>
            <div className="text-xs text-stone-500 truncate">{staffEmail}</div>
            <p className={`mt-1.5 text-xs font-medium ${reminderStatus.tone === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
              {reminderStatus.text}
            </p>
          </div>
          {isPlatformOwner && (
            <Link href="/platform" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-white">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
              {t("პლატფორმის მართვა", "Platform admin")}
            </Link>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-stone-700 hover:text-rose-700 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {signingOut ? t("გასვლა...", "Signing out...") : t("გასვლა", "Sign out")}
          </button>
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-rose-100 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <MoargeLogo variant="icon" size="sm" />
            <span className="font-bold text-sm text-stone-900 truncate">{salonName}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-dashboard-menu"
              aria-label={mobileMenuOpen ? t("მენიუს დახურვა", "Close menu") : t("მენიუს გახსნა", "Open menu")}
              className="p-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-rose-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile menu: things that do not fit in the bottom bar */}
        {mobileMenuOpen && (
          <div id="mobile-dashboard-menu" className="lg:hidden bg-white border-b border-stone-200 px-4 py-3 shadow-lg space-y-1">
            <p className={`px-4 pb-2 text-xs font-medium ${reminderStatus.tone === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
              {reminderStatus.text}
            </p>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-between px-4 rounded-xl bg-rose-50 text-rose-800 text-sm font-semibold"
            >
              <span>{t("ჩემი ჯავშნის გვერდი", "My booking page")}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            {isPlatformOwner && (
              <Link href="/platform" className="flex min-h-11 items-center gap-3 px-4 rounded-xl text-sm font-medium text-stone-700 hover:bg-rose-50">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                {t("პლატფორმის მართვა", "Platform admin")}
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex min-h-11 items-center gap-3 px-4 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
              {signingOut ? t("გასვლა...", "Signing out...") : t("გასვლა", "Sign out")}
            </button>
          </div>
        )}

        <main className="flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 max-w-7xl w-full mx-auto">
          {readOnly && <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t("სატესტო პერიოდი დასრულდა. ანგარიში მხოლოდ სანახავადაა, მონაცემები შენახულია.", "The test period has ended. The account is view-only and your data is kept.")}{" "}
            {BILLING_CONFIG.billingEnabled
              ? <Link className="ml-1 underline" href="/billing">{t("გადახდის ნახვა", "View billing")}</Link>
              : <a className="ml-1 underline" href={`mailto:${SUPPORT_EMAIL}`}>{t("დაგვიკავშირდით", "Contact us")}</a>}
          </div>}
          {children}
        </main>
        <FeedbackButton />
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label={t("მთავარი ნავიგაცია", "Main navigation")}
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.href);
            return (
              <li key={item.href} className="flex-1 min-w-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition ${
                    isActive ? "text-rose-600" : "text-stone-500 hover:text-rose-700"
                  }`}
                >
                  <span className={`rounded-full px-3 py-1 ${isActive ? "bg-rose-50" : ""}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
