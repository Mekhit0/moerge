"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarOff, Clock, CreditCard, History, Scissors, Store, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function SettingsNav({ canManageData }: { canManageData: boolean }) {
  const { t } = useLanguage();
  const pathname = usePathname();

  const items = [
    { href: "/settings", label: t("სალონი", "Salon"), icon: Store },
    { href: "/settings/services", label: t("სერვისები და ფასები", "Services and prices"), icon: Scissors },
    { href: "/settings/staff", label: t("სპეციალისტები", "Staff"), icon: Users },
    { href: "/settings/schedules", label: t("სამუშაო საათები", "Working hours"), icon: Clock },
    { href: "/settings/time-off", label: t("დასვენების დღეები", "Days off"), icon: CalendarOff },
    { href: "/settings/notifications", label: t("შეხსენებები", "Reminders"), icon: Bell },
    { href: "/email-history", label: t("გაგზავნილი შეხსენებები", "Sent reminders"), icon: History },
    ...(canManageData ? [{ href: "/billing", label: t("გადახდა", "Billing"), icon: CreditCard }] : []),
  ];

  return (
    <nav aria-label={t("პარამეტრების განყოფილებები", "Settings sections")} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-2 border-b border-stone-200 pb-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  active
                    ? "bg-rose-600 text-white"
                    : "border border-stone-200 bg-white text-stone-600 hover:bg-rose-50 hover:text-rose-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-rose-500"}`} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
