import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronRight, Plus } from "lucide-react";
import { SEO_PAGES, seoPage } from "@/lib/seo-pages";
import { articlesFor } from "@/lib/articles";
import { breadcrumbJsonLd, faqJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { CHEAPEST_MONTHLY_GEL, currentOffer } from "@/lib/pricing";
import { MarketingFooter, MarketingHeader, SIGNUP_HREF } from "@/components/marketing/MarketingChrome";
import ScenePreview from "@/components/marketing/ScenePreview";
import ProductScreenshot from "@/components/marketing/ProductScreenshot";
import { screenForScene } from "@/lib/screens";

// Only the pages listed in SEO_PAGES exist; any other address is a 404.
export const dynamicParams = false;
// Rebuilt every hour so the November wording switches to the trial wording on 1 December by itself.
export const revalidate = 3600;

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
  const offer = currentOffer();
  const offerLine = offer.pilot ? "ნოემბერში უფასოდ, ბარათის გარეშე." : `${offer.trialDays} დღე უფასოდ, ბარათის გარეშე.`;
  const related = page.related.map((slug) => seoPage(slug)).filter((item) => item !== undefined);
  const reading = articlesFor(page.slug);
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
        <section className="border-b border-stone-200/70">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div>
              <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
                <Link href="/" className="hover:text-rose-700">moarge</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{section}</span>
              </nav>
              <h1 className="mt-4 text-3xl font-black leading-[1.12] tracking-tight text-stone-900 sm:text-5xl">{page.h1}</h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">{page.lead}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <Link href={SIGNUP_HREF} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-rose-600 px-7 text-base font-bold text-white transition hover:bg-rose-700">
                  დაიწყეთ უფასოდ<ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/book" className="inline-flex min-h-11 items-center justify-center text-base font-semibold text-stone-800 underline decoration-rose-300 decoration-2 underline-offset-4 transition hover:decoration-rose-600">
                  ნახეთ ჯავშნის გვერდი
                </Link>
              </div>
              <p className="mt-5 text-sm text-stone-500">
                {offerLine}{" "}
                <Link href="/pricing" className="font-semibold text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-rose-700">{`ფასები ${CHEAPEST_MONTHLY_GEL} ₾-დან თვეში`}</Link>
              </p>
            </div>
            <ScenePreview scene={page.scene} />
          </div>
        </section>

        <section className="border-b border-stone-200/70 bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">ნაცნობია?</h2>
              <ul className="mt-5 space-y-3">
                {page.problems.map((problem) => (
                  <li key={problem} className="text-base text-stone-500 line-through decoration-stone-300">{problem}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {page.benefits.map((benefit) => (
                <article key={benefit.title} className="border-t border-stone-200 py-5">
                  <h3 className="flex items-center gap-2 font-bold text-stone-900"><Check className="h-5 w-5 shrink-0 text-emerald-600" />{benefit.title}</h3>
                  <p className="mt-1.5 text-base leading-relaxed text-stone-600">{benefit.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200/70 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl space-y-10 px-4 sm:px-6">
            {page.details.map((detail) => (
              <div key={detail.heading} className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr] lg:gap-14">
                <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">{detail.heading}</h2>
                <div className="space-y-3">
                  {detail.paragraphs.map((text) => <p key={text} className="text-base leading-relaxed text-stone-700 sm:text-[1.0625rem]">{text}</p>)}
                </div>
              </div>
            ))}
            <div className="flex justify-center pt-2">
              <ProductScreenshot screen={screenForScene(page.scene)} className="mx-auto" />
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">როგორ დავიწყოთ</h2>
            <ol className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
              {page.steps.map((step, index) => (
                <li key={step}>
                  <span className="text-4xl font-black tabular-nums text-rose-600">{index + 1}</span>
                  <p className="mt-2 text-base font-semibold leading-relaxed text-stone-800">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-stone-200/70 bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">კითხვები</h2>
            <div className="border-b border-stone-200">
              {page.faq.map((item) => (
                <details key={item.q} className="group border-t border-stone-200">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold text-stone-900 hover:text-rose-700">
                    {item.q}<Plus className="h-5 w-5 shrink-0 text-rose-600 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="pb-5 pr-8 text-base leading-relaxed text-stone-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-xl font-extrabold text-stone-900 sm:text-2xl">ასევე ნახეთ</h2>
            <ul className="mt-4 grid grid-cols-1 border-t border-stone-200 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4">
              {related.map((item) => (
                <li key={item.slug} className="border-b border-stone-200">
                  <Link href={`/${item.slug}`} className="group flex min-h-13 items-center justify-between gap-3 font-semibold text-stone-800 transition hover:text-rose-700">
                    {item.label}<ArrowRight className="h-4 w-4 shrink-0 text-rose-600 transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>

            {reading.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-extrabold text-stone-900 sm:text-2xl">სასარგებლო სტატიები</h2>
                <ul className="mt-4 grid grid-cols-1 border-t border-stone-200 sm:grid-cols-2 sm:gap-x-10">
                  {reading.map((item) => (
                    <li key={item.slug} className="border-b border-stone-200">
                      <Link href={`/blog/${item.slug}`} className="group flex min-h-13 items-center justify-between gap-3 py-2 font-semibold text-stone-800 transition hover:text-rose-700">
                        {item.h1}<ArrowRight className="h-4 w-4 shrink-0 text-rose-600 transition group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-12 flex flex-col gap-5 rounded-2xl bg-rose-600 px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">სცადეთ ამ კვირაში</h2>
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
