import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { siteMetadata, siteViewport } from "@/lib/metadata";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import CookieNotice from "@/components/CookieNotice";
import { ToastProvider } from "@/components/ui/Toast";

export const viewport = siteViewport;
export const metadata = siteMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" className="scroll-smooth">
      <body className="min-h-screen bg-ivory text-stone-900 selection:bg-rose-200 selection:text-rose-950 antialiased overflow-x-hidden">
        <LanguageProvider><ToastProvider><PwaInstallPrompt />{children}<CookieNotice /></ToastProvider></LanguageProvider>
      </body>
    </html>
  );
}
