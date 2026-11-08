"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { LegalDocument } from "@/lib/legal";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";

/** A legal page (privacy or terms) in the language the reader picked. */
export default function LegalView({ doc, other }: { doc: LegalDocument; other: { href: string; label: { ka: string; en: string } } }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen flex-col bg-ivory text-stone-900">
      <MarketingHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-stone-500">
            <Link href="/" className="hover:text-rose-700">moarge</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{t(doc.title.ka, doc.title.en)}</span>
          </nav>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">{t(doc.title.ka, doc.title.en)}</h1>
          <p className="mt-2 text-sm text-stone-500">{t("განახლებულია:", "Last updated:")} {t(doc.updated.ka, doc.updated.en)}</p>
          <p className="mt-6 text-base leading-relaxed text-stone-700 sm:text-[1.0625rem]">{t(doc.intro.ka, doc.intro.en)}</p>

          {doc.sections.map((section) => (
            <section key={section.title.en} id={section.id} className="mt-9 scroll-mt-24">
              <h2 className="text-xl font-extrabold tracking-tight text-stone-900">{t(section.title.ka, section.title.en)}</h2>
              {section.paragraphs?.map((text) => <p key={text.en} className="mt-3 text-base leading-relaxed text-stone-700">{t(text.ka, text.en)}</p>)}
              {section.list && (
                <ul className="mt-3 space-y-2">
                  {section.list.map((text) => (
                    <li key={text.en} className="flex gap-3 text-base leading-relaxed text-stone-700">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" aria-hidden />{t(text.ka, text.en)}
                    </li>
                  ))}
                </ul>
              )}
              {section.after?.map((text) => <p key={text.en} className="mt-3 text-base leading-relaxed text-stone-700">{t(text.ka, text.en)}</p>)}
            </section>
          ))}

          <p className="mt-12 border-t border-stone-200 pt-6 text-sm">
            <Link href={other.href} className="font-semibold text-rose-700 underline underline-offset-2">{t(other.label.ka, other.label.en)}</Link>
          </p>
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
