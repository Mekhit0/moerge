"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  MailCheck,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoergeLogo from "./MoergeLogo";

interface AppShellProps {
  salonName: string;
  timezone: string;
  autoRemindersEnabled: boolean;
  dryRunMode: boolean;
  staffName: string;
  staffEmail: string;
  children: React.ReactNode;
}

export default function AppShell({
  salonName,
  timezone,
  autoRemindersEnabled,
  dryRunMode,
  staffName,
  staffEmail,
  children,
}: AppShellProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const navItems = [
    {
      href: "/dashboard",
      label: t("მთავარი პანელი", "Dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/clients",
      label: t("კლიენტები", "Clients"),
      icon: Users,
    },
    {
      href: "/appointments",
      label: t("ვიზიტები და ჯავშნები", "Appointments"),
      icon: CalendarCheck2,
    },
    {
      href: "/email-history",
      label: t("ავტომატური შეხსენებები", "Automated Reminders"),
      icon: MailCheck,
    },
    {
      href: "/settings",
      label: t("პარამეტრები", "Settings"),
      icon: Settings,
    },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-[#fdf8f6] text-stone-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-rose-100/80 shadow-sm z-30">
        <div className="p-6 border-b border-rose-100/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <MoergeLogo variant="icon" size="md" />
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 flex items-center gap-1.5">
                  <span>MOERGE</span>
                  <span className="text-stone-300">•</span>
                  <span>{t("სალონის სისტემა", "Salon Suite")}</span>
                </div>
                <h1 className="text-base font-bold text-stone-900 truncate" title={salonName}>
                  {salonName}
                </h1>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <LanguageSwitcher />
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-[11px] font-medium truncate">
              <Clock className="w-3 h-3 text-rose-600 shrink-0" />
              {timezone}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {dryRunMode ? (
              <span
                title={t(
                  "სატესტო რეჟიმი ჩართულია: ელ-ფოსტა სიმულირდება რეალურ კლიენტებთან გაგზავნის გარეშე.",
                  "Dry-run mode is enabled: emails are simulated safely without emailing real clients."
                )}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium"
              >
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                {t("სატესტო რეჟიმი (Dry-Run)", "Dry-Run Mode")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {t("აქტიური Resend", "Live Resend")}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${
                  isActive
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                    : "text-stone-600 hover:bg-rose-50/80 hover:text-rose-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-white" : "text-rose-500"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-rose-100/80">
            <Link
              href="/book"
              target="_blank"
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-rose-50/80 hover:bg-rose-100 text-rose-800 text-xs font-semibold border border-rose-200/70 transition"
            >
              <span>{t("ონლაინ ჩაწერის ფორმა", "Public Booking Form")}</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-rose-600">
                /book &nearr;
              </span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-rose-100/80 bg-rose-50/30">
          <div className="px-3 py-2">
            <div className="text-xs font-semibold text-stone-900 truncate">
              {staffName}
            </div>
            <div className="text-xs text-stone-500 truncate">{staffEmail}</div>
            <div className="mt-1.5 text-[11px] text-stone-500">
              {t("ავტო-შეხსენება:", "Auto-Reminders:")}{" "}
              <strong
                className={
                  autoRemindersEnabled ? "text-emerald-700" : "text-amber-700"
                }
              >
                {autoRemindersEnabled
                  ? t("ჩართულია", "Enabled")
                  : t("დაპაუზებულია", "Paused")}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-stone-700 hover:text-rose-700 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {signingOut
              ? t("გასვლა...", "Signing Out...")
              : t("სისტემიდან გასვლა", "Sign Out")}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-rose-100 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <MoergeLogo variant="icon" size="sm" />
            <div className="min-w-0">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600">
                MOERGE
              </div>
              <span className="font-bold text-xs text-stone-900 truncate max-w-[170px] block">
                {salonName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-rose-50"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-rose-100 px-4 py-4 space-y-2 shadow-lg">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
                    isActive
                      ? "bg-rose-600 text-white"
                      : "text-stone-700 hover:bg-rose-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/book"
              target="_blank"
              className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold"
            >
              <span>{t("ონლაინ ჩაწერის ფორმა (/book)", "Public Booking Form (/book)")}</span>
              <span>&nearr;</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
              {t("გასვლა", "Sign Out")} ({staffEmail})
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
