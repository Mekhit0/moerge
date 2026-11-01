"use client";

import React from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/80">
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
          <Link href={SIGNUP_HREF} className="inline-flex min-h-10 items-center gap-1.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition">
            {t("დაწყება", "Start")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Footer of the public pages, with links to every feature and salon type page. */
export function MarketingFooter({ onHome = false }: { onHome?: boolean }) {
  const { t } = useLanguage();
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
    <footer className="bg-ivory border-t border-rose-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm space-y-4">
            <MoargeLogo size="md" variant="full" />
            <p className="text-base text-stone-600 leading-relaxed">
              {t(
                "სალონის მართვის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტების ბაზა და შემოსავალი საქართველოს სალონებისთვის.",
                "Salon software: online booking, a calendar, a client base and earnings for salons in Georgia."
              )}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a href={`tel:${SUPPORT_PHONE_TEL}`} className="group inline-flex min-h-12 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 text-sm font-semibold text-stone-800 shadow-xs transition hover:border-rose-300 hover:shadow-sm">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white"><Phone className="h-4 w-4" /></span>
                {SUPPORT_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="group inline-flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 text-sm font-semibold text-stone-800 shadow-xs transition hover:border-rose-300 hover:shadow-sm">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white"><Mail className="h-4 w-4" /></span>
                <span className="truncate">{SUPPORT_EMAIL}</span>
              </a>
            </div>
          </div>

          <nav aria-label={t("ფუტერის ბმულები", "Footer links")} className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-10">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{column.title}</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-stone-700 transition hover:text-rose-600">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-rose-100 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {COMPANY_SHORT_NAME}. {t("ყველა უფლება დაცულია.", "All rights reserved.")}</p>
          <p>Managed by {COMPANY_SHORT_NAME}</p>
        </div>
      </div>
    </footer>
  );
}
