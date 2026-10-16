import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title:
    "MOERGE | სალონის ჭკვიანი ჯავშნების და 21-დღიანი შეხსენების ეკოსისტემა",
  description:
    "MOERGE — საქართველოზე მორგებული ონლაინ ჯავშნების, კლიენტების მართვის და 21-დღიანი ავტომატური Resend ელ-ფოსტის შეხსენებების პლატფორმა ესთეტიკური და ეპილაციის სალონებისთვის.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka">
      <body className="min-h-screen bg-[#fdf8f6] text-stone-900 selection:bg-rose-200 selection:text-rose-950">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
