"use client";

import React, { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home, LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();
  useEffect(() => {
    console.error("Dashboard error:", error);
    reportClientError(error);
  }, [error]);

  async function handleSignOut() {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-xl shadow-rose-950/5 p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-900">
            {t("პანელი ვერ ჩაიტვირთა", "The dashboard could not load")}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-500 leading-relaxed">
            {t("მონაცემების ჩატვირთვისას შეფერხება მოხდა. სცადეთ ხელახლა.", "Something interrupted the data load. Please try again.")}
          </p>
          {error?.digest && (
            <p className="mt-3 text-xs text-stone-500">
              {t("შეცდომის კოდი:", "Error reference:")} <code>{error.digest}</code>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {t("ხელახლა ცდა", "Try again")}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-stone-500" />
            {t("სისტემაში ხელახლა შესვლა", "Sign in again")}
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 font-medium pt-1"
          >
            <Home className="w-3.5 h-3.5" />
            {t("მთავარ გვერდზე დაბრუნება", "Back to home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
