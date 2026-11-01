"use client";

import React, { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
    reportClientError(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-900">
            დაფიქსირდა შეცდომა
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-stone-500 leading-relaxed">
            აპლიკაციის ჩატვირთვისას მოხდა გაუთვალისწინებელი შეფერხება.
          </p>
          {error?.message && (
            <div className="mt-4 p-3 rounded-xl bg-stone-50 text-[11px] font-mono text-stone-600 border border-stone-200 text-left overflow-auto max-h-28">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            სცადეთ ხელახლა
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 font-medium pt-1"
          >
            <Home className="w-3.5 h-3.5" />
            მთავარ გვერდზე დაბრუნება
          </Link>
        </div>
      </div>
    </div>
  );
}
