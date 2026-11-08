import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { ARTICLES, readingMinutes } from "@/lib/articles";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";

export const metadata = pageMetadata({
  title: "სტატიები სალონის მფლობელებისთვის",
  description: "პრაქტიკული რჩევები სალონის მართვაზე: ონლაინ ჯავშანი, გაცდენილი ვიზიტები, საკომისიო, სერვისის ფასი და კლიენტების დაბრუნება.",
  path: "/blog",
});

/** The list of articles, newest first. */
export default function BlogIndexPage() {
  const items = [...ARTICLES].sort((a, b) => b.published.localeCompare(a.published));
  const structured = [breadcrumbJsonLd([{ name: "moarge", path: "/" }, { name: "სტატიები", path: "/blog" }])];

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-stone-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structured) }} />
      <MarketingHeader showLanguage={false} />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
            <Link href="/" className="hover:text-rose-700">moarge</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>სტატიები</span>
          </nav>
          <h1 className="mt-4 text-3xl font-black leading-[1.15] tracking-tight text-stone-900 sm:text-5xl">რჩევები სალონის მფლობელებისთვის</h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-600">როგორ შევამციროთ გაცდენები, დავთვალოთ საკომისიო და ფასები და დავაბრუნოთ კლიენტები. მოკლედ და საქმეზე.</p>

          <ul className="mt-10 border-t border-stone-200">
            {items.map((item) => (
              <li key={item.slug} className="border-b border-stone-200">
                <Link href={`/blog/${item.slug}`} className="group flex items-start justify-between gap-4 py-6">
                  <span>
                    <span className="block text-xl font-extrabold leading-snug tracking-tight text-stone-900 group-hover:text-rose-700">{item.h1}</span>
                    <span className="mt-2 block text-base leading-relaxed text-stone-600">{item.description}</span>
                    <span className="mt-2 block text-sm text-stone-500">{readingMinutes(item)} წუთი</span>
                  </span>
                  <ArrowRight className="mt-1.5 h-5 w-5 shrink-0 text-rose-600 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
