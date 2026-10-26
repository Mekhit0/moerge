"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstallPrompt() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onInstall);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setShowIosHelp(ios && !standalone);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  const dashboardPath = ["/dashboard", "/appointments", "/clients", "/settings", "/reports", "/email-history"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!dashboardPath || dismissed || (!installEvent && !showIosHelp)) return null;
  return <aside className="fixed bottom-3 left-3 right-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-rose-200 bg-white p-3 shadow-xl sm:bottom-5">
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><Download className="h-5 w-5" /></div>
    <div className="min-w-0 flex-1 text-xs">
      <strong className="block text-sm">{t("დააინსტალირეთ moarge", "Install moarge")}</strong>
      <span className="text-stone-500">{showIosHelp ? t("Safari-ში დააჭირეთ გაზიარებას და აირჩიეთ მთავარ ეკრანზე დამატება.", "In Safari, tap Share, then Add to Home Screen.") : t("სწრაფი წვდომა თქვენი სალონის პანელზე.", "Quick access to your salon dashboard.")}</span>
    </div>
    {installEvent && <button type="button" onClick={async () => { await installEvent.prompt(); const result = await installEvent.userChoice; if (result.outcome === "accepted") setInstallEvent(null); }} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white">{t("დაყენება", "Install")}</button>}
    <button type="button" aria-label={t("დახურვა", "Dismiss")} onClick={() => setDismissed(true)} className="rounded-lg p-1 text-stone-400"><X className="h-4 w-4" /></button>
  </aside>;
}
