import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { ARTICLES, article, readingMinutes } from "@/lib/articles";
import { seoPage } from "@/lib/seo-pages";
import { articleJsonLd, breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { currentOffer } from "@/lib/pricing";
import { KA_MONTHS } from "@/lib/dates";
import { MarketingFooter, MarketingHeader, SIGNUP_HREF } from "@/components/marketing/MarketingChrome";

// Only the articles in ARTICLES exist; any other address is a 404.
export const dynamicParams = false;
// Rebuilt every hour so the November wording switches to the trial wording on 1 December by itself.
export const revalidate = 3600;

export function generateStaticParams() {
  return ARTICLES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const item = article((await params).slug);
  if (!item) return {};
  return pageMetadata({ title: item.title, description: item.description, path: `/blog/${item.slug}` });
}

function kaDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${KA_MONTHS[month - 1]}, ${year}`;
}

/** One article, in Georgian, readable without JavaScript. */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const item = article((await params).slug);
  if (!item) notFound();
  const offer = currentOffer();
  const offerLine = offer.pilot ? "ნოემბერში უფასოდ, ბარათის გარეშე." : `${offer.trialDays} დღე უფასოდ, ბარათის გარეშე.`;
  const related = item.related.map((slug) => seoPage(slug)).filter((page) => page !== undefined);
  const others = ARTICLES.filter((other) => other.slug !== item.slug).slice(0, 3);
  const path = `/blog/${item.slug}`;
  const structured = [
    articleJsonLd({ path, title: item.h1, description: item.description, published: item.published, updated: item.updated }),
    breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: "სტატიები", path: "/blog" }, { name: item.h1, path }]),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-stone-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      {/* Articles are written in Georgian only, so there is nothing to switch. */}
      <MarketingHeader showLanguage={false} />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
            <Link href="/" className="hover:text-rose-700">moarge</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/blog" className="hover:text-rose-700">სტატიები</Link>
          </nav>
          <h1 className="mt-4 text-3xl font-black leading-[1.15] tracking-tight text-stone-900 sm:text-[2.6rem]">{item.h1}</h1>
          <p className="mt-3 text-sm text-stone-500">
            <time dateTime={item.updated}>{kaDate(item.updated)}</time> · {readingMinutes(item)} წუთი
          </p>
          <p className="mt-6 text-lg leading-relaxed text-stone-700">{item.lead}</p>

          {item.sections.map((section) => (
            <section key={section.heading} className="mt-9">
              <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">{section.heading}</h2>
              {section.paragraphs?.map((text) => <p key={text} className="mt-3 text-base leading-relaxed text-stone-700 sm:text-[1.0625rem]">{text}</p>)}
              {section.list && (
                <ul className="mt-3 space-y-2">
                  {section.list.map((text) => (
                    <li key={text} className="flex gap-3 text-base leading-relaxed text-stone-700 sm:text-[1.0625rem]">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" aria-hidden />{text}
                    </li>
                  ))}
                </ul>
              )}
              {section.after?.map((text) => <p key={text} className="mt-3 text-base leading-relaxed text-stone-700 sm:text-[1.0625rem]">{text}</p>)}
            </section>
          ))}

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-extrabold text-stone-900">moarge-ში</h2>
              <ul className="mt-3 border-t border-stone-200">
                {related.map((page) => (
                  <li key={page.slug} className="border-b border-stone-200">
                    <Link href={`/${page.slug}`} className="group flex min-h-13 items-center justify-between gap-3 font-semibold text-stone-800 transition hover:text-rose-700">
                      {page.label}<ArrowRight className="h-4 w-4 shrink-0 text-rose-600 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <section className="border-t border-stone-200/70 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-xl font-extrabold text-stone-900 sm:text-2xl">სხვა სტატიები</h2>
            <ul className="mt-4 grid grid-cols-1 gap-x-10 border-t border-stone-200 md:grid-cols-3 md:border-t-0">
              {others.map((other) => (
                <li key={other.slug} className="border-b border-stone-200 md:border-b-0 md:border-t">
                  <Link href={`/blog/${other.slug}`} className="group block py-4 transition">
                    <span className="block font-bold leading-snug text-stone-900 group-hover:text-rose-700">{other.h1}</span>
                    <span className="mt-1 block text-sm text-stone-500">{readingMinutes(other)} წუთი</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-12 flex flex-col gap-5 rounded-2xl bg-rose-600 px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">სცადეთ moarge</h2>
                <p className="mt-1.5 text-base text-rose-100">{`რეგისტრაციას რამდენიმე წუთი სჭირდება. ${offerLine}`}</p>
              </div>
              <Link href={SIGNUP_HREF} className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-rose-700 transition hover:bg-rose-50">
                დაიწყეთ უფასოდ<ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
