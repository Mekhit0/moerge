"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, Mail, Phone } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";
import { COMPANY_SHORT_NAME, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/contact";
import { SEO_PAGES } from "@/lib/seo-pages";

export const SIGNUP_HREF = "/login?mode=signup";
export const DEMO_BOOKING_HREF = "/book";

/** Top bar of the public pages. On the home page the links scroll; elsewhere they lead home. */
export function MarketingHeader({ onHome = false, showLanguage = true }: { onHome?: boolean; showLanguage?: boolean }) {
  const { t } = useLanguage();
  const base = onHome ? "" : "/";
  return (
    <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur border-b border-stone-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="moarge">
          <MoargeLogo size="md" variant="icon" />
          <span className="text-xl sm:text-2xl font-black tracking-[0.06em] text-stone-900">MOARGE</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-stone-600" aria-label={t("გვერდის ნავიგაცია", "Page navigation")}>
          <a href={`${base}#features`} className="hover:text-rose-600 transition">{t("შესაძლებლობები", "Features")}</a>
          <a href={`${base}#how`} className="hover:text-rose-600 transition">{t("როგორ მუშაობს", "How it works")}</a>
          <a href={`${base}#pilot`} className="hover:text-rose-600 transition">{t("სატესტო თვე", "Test month")}</a>
          <a href={`${base}#faq`} className="hover:text-rose-600 transition">{t("კითხვები", "FAQ")}</a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {showLanguage && <LanguageSwitcher />}
          <Link href="/login" className="hidden sm:inline-flex min-h-10 items-center px-4 rounded-xl text-sm font-semibold text-stone-700 hover:bg-rose-50 transition">
            {t("შესვლა", "Sign in")}
          </Link>
          <Link href={SIGNUP_HREF} className="inline-flex min-h-10 items-center gap-1.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition">
            {t("დაწყება", "Start")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Footer of the public pages, with links to every feature and salon type page.
 * On phones each group folds into one row so the footer stays short; on wide screens all are open.
 */
export function MarketingFooter({ onHome = false }: { onHome?: boolean }) {
  const { t } = useLanguage();
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const base = onHome ? "" : "/";
  const columns = [
    {
      title: t("შესაძლებლობები", "Features"),
      links: SEO_PAGES.filter((page) => page.kind === "feature").map((page) => ({ href: `/${page.slug}`, label: page.label })),
    },
    {
      title: t("სალონის ტიპები", "Salon types"),
      links: SEO_PAGES.filter((page) => page.kind === "solution").map((page) => ({ href: `/${page.slug}`, label: page.label })),
    },
    {
      title: t("სალონებისთვის", "For salons"),
      links: [
        { href: SIGNUP_HREF, label: t("რეგისტრაცია", "Sign up") },
        { href: "/login", label: t("შესვლა", "Sign in") },
        { href: `${base}#pilot`, label: t("სატესტო თვე", "Test month") },
        { href: `${base}#faq`, label: t("კითხვები", "FAQ") },
      ],
    },
    {
      title: t("კლიენტებისთვის", "For clients"),
      links: [
        { href: "/manage-booking", label: t("ჩემი ჯავშანი", "My booking") },
        { href: DEMO_BOOKING_HREF, label: t("ჯავშნის მაგალითი", "Booking example") },
        { href: "/terms", label: t("წესები და პირობები", "Terms") },
        { href: "/privacy", label: t("კონფიდენციალურობა", "Privacy") },
      ],
    },
  ];

  return (
    <footer className="bg-ivory border-t border-stone-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6 lg:pt-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:gap-10">
          <Link href="/" className="flex items-center gap-2.5 self-start" aria-label="moarge">
            <MoargeLogo size="sm" variant="icon" />
            <span className="text-lg font-black tracking-[0.06em] text-stone-900">MOARGE</span>
          </Link>

          <nav aria-label={t("ფუტერის ბმულები", "Footer links")} className="border-t border-stone-200 lg:grid lg:grid-cols-4 lg:gap-12 lg:border-t-0">
            {columns.map((column) => {
              const open = openColumn === column.title;
              return (
                <div key={column.title} className="border-b border-stone-200 lg:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenColumn(open ? null : column.title)}
                    aria-expanded={open}
                    className="flex min-h-12 w-full items-center justify-between text-left text-sm font-bold text-stone-900 lg:pointer-events-none lg:min-h-0 lg:text-xs lg:uppercase lg:tracking-wide lg:text-stone-400"
                  >
                    {column.title}
                    <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform lg:hidden ${open ? "rotate-180" : ""}`} />
                  </button>
                  <ul className={`${open ? "grid" : "hidden"} grid-cols-2 gap-x-4 gap-y-1 pb-3 text-sm lg:mt-4 lg:grid lg:grid-cols-1 lg:gap-y-2.5 lg:pb-0`}>
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="inline-flex min-h-9 items-center text-stone-600 transition hover:text-rose-700 lg:min-h-0">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-sm text-stone-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:mt-10 lg:border-t lg:border-stone-200 lg:pt-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <a href={`tel:${SUPPORT_PHONE_TEL}`} className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-stone-700 hover:text-rose-700"><Phone className="h-4 w-4 text-rose-600" />{SUPPORT_PHONE_DISPLAY}</a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-9 min-w-0 items-center gap-1.5 font-semibold text-stone-700 hover:text-rose-700"><Mail className="h-4 w-4 shrink-0 text-rose-600" /><span className="truncate">{SUPPORT_EMAIL}</span></a>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} {COMPANY_SHORT_NAME}. {t("ყველა უფლება დაცულია.", "All rights reserved.")}</p>
        </div>
      </div>
    </footer>
  );
}
