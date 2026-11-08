"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const STORAGE_KEY = "moarge-cookie-notice";
// Signed-in screens have their own bottom prompt (app install); people there have already seen this.
const APP_PATHS = ["/dashboard", "/appointments", "/clients", "/settings", "/reports", "/billing", "/guide", "/platform", "/onboarding"];

/**
 * moarge only uses cookies and browser storage the site needs to work (sign-in, language, bot
 * protection), so this informs rather than asks. If analytics or ad pixels are ever added, this must
 * become a real choice that loads them only after consent.
 */
export default function CookieNotice() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(window.localStorage.getItem(STORAGE_KEY) !== "ok"); } catch { setShow(true); }
  }, []);

  if (!show || APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;

  function close() {
    setShow(false);
    try { window.localStorage.setItem(STORAGE_KEY, "ok"); } catch { /* it simply shows again next visit */ }
  }

  return (
    <aside role="region" aria-label={t("ქუქი-ფაილები", "Cookies")}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl sm:bottom-5 sm:flex-row sm:items-center">
      <Cookie className="hidden h-6 w-6 shrink-0 text-rose-600 sm:block" aria-hidden />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-stone-700">
        {t(
          "moarge იყენებს მხოლოდ აუცილებელ ქუქი-ფაილებს და ბრაუზერის მეხსიერებას: რომ ანგარიშში დარჩეთ, ენა დაიმახსოვროს და ფორმები ბოტებისგან დაიცვას. რეკლამა და თვალთვალი არ გვაქვს.",
          "moarge only uses the cookies and browser storage the site needs: to keep you signed in, remember your language and protect forms from bots. No ads, no tracking."
        )}{" "}
        <Link href="/privacy#cookies" className="font-semibold text-rose-700 underline underline-offset-2">{t("დაწვრილებით", "Learn more")}</Link>
      </p>
      <button type="button" onClick={close}
        className="min-h-11 shrink-0 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
        {t("გასაგებია", "Got it")}
      </button>
    </aside>
  );
}
