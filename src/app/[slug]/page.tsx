import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, X } from "lucide-react";
import { SEO_PAGES, seoPage } from "@/lib/seo-pages";
import { breadcrumbJsonLd, faqJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { BILLING_CONFIG } from "@/lib/billing-plans";
import { MarketingFooter, MarketingHeader, SIGNUP_HREF } from "@/components/marketing/MarketingChrome";
import ScenePreview from "@/components/marketing/ScenePreview";

// Only the pages listed in SEO_PAGES exist; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = seoPage((await params).slug);
  if (!page) return {};
  return pageMetadata({ title: page.title, description: page.description, path: `/${page.slug}`, keywords: page.keywords });
}

/** A page for one salon type or one feature, in Georgian, readable without JavaScript. */
export default async function SeoLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = seoPage((await params).slug);
  if (!page) notFound();
  const section = page.kind === "feature" ? "შესაძლებლობები" : "სალონის ტიპები";
  const related = page.related.map((slug) => seoPage(slug)).filter((item) => item !== undefined);
  const structured = [
    breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: page.label, path: `/${page.slug}` }]),
    faqJsonLd(page.faq),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-stone-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      {/* These pages are written in Georgian only, so there is nothing to switch. */}
      <MarketingHeader showLanguage={false} />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-rose-100">
          <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-rose-200/35 blur-[120px]" />
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
                <Link href="/" className="hover:text-rose-700">moarge</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{section}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-semibold text-stone-700">{page.label}</span>
              </nav>
              <h1 className="text-3xl font-black leading-[1.15] tracking-tight text-stone-900 sm:text-5xl">{page.h1}</h1>
              <p className="max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">{page.lead}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={SIGNUP_HREF} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-7 text-base font-bold text-white shadow-xl shadow-rose-600/25 transition hover:bg-rose-700">
                  {`დაიწყეთ უფასოდ: ${BILLING_CONFIG.trialDays} დღე`}<ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/book" className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-stone-200 bg-white px-7 text-base font-semibold text-stone-900 transition hover:bg-rose-50/70">
                  ჯავშნის გვერდის მაგალითი
                </Link>
              </div>
              <p className="text-sm text-stone-500">ბარათი არ არის საჭირო · ქართულ ენაზე · მუშაობს ტელეფონზე</p>
            </div>
            <ScenePreview scene={page.scene} />
          </div>
        </section>

        <section className="border-b border-rose-100 bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">რა პრობლემას წყვეტს</h2>
              <ul className="mt-5 space-y-3">
                {page.problems.map((problem) => (
                  <li key={problem} className="flex items-start gap-2.5 text-stone-600"><X className="mt-1 h-4 w-4 shrink-0 text-red-500" />{problem}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {page.benefits.map((benefit) => (
                <article key={benefit.title} className="rounded-3xl border border-rose-100 bg-ivory p-5">
                  <h3 className="flex items-center gap-2 font-bold text-stone-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">როგორ მუშაობს</h2>
            <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {page.steps.map((step, index) => (
                <li key={step} className="relative rounded-3xl border border-rose-100 bg-white p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600 text-lg font-black text-white">{index + 1}</span>
                  <p className="mt-4 font-semibold text-stone-800">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-rose-100 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">ხშირად დასმული კითხვები</h2>
            <div className="mt-8 space-y-3">
              {page.faq.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-rose-100 bg-ivory">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 p-4 text-base font-bold text-stone-900 sm:p-5">
                    {item.q}<ChevronRight className="h-5 w-5 shrink-0 text-rose-600 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-4 pb-5 leading-relaxed text-stone-600 sm:px-5">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-xl font-extrabold text-stone-900 sm:text-2xl">ასევე ნახეთ</h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link key={item.slug} href={`/${item.slug}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white p-4 font-semibold text-stone-800 transition hover:border-rose-300 hover:shadow-md">
                  {item.label}<ArrowRight className="h-4 w-4 shrink-0 text-rose-600 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 py-14 text-white">
          <div className="mx-auto max-w-3xl space-y-5 px-4 text-center sm:px-6">
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl">მზად ხართ დაემშვიდობოთ რვეულს?</h2>
            <p className="text-base text-rose-100/80 sm:text-lg">{`რეგისტრაციას რამდენიმე წუთი სჭირდება. ${BILLING_CONFIG.trialDays} დღე უფასოა.`}</p>
            <Link href={SIGNUP_HREF} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-rose-950 shadow-xl transition hover:bg-rose-50 sm:w-auto">
              დაიწყეთ უფასოდ<ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
