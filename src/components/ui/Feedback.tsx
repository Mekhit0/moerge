import React from "react";
import { cn } from "./cn";

/** Gray placeholder block shown while data loads, sized like the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-stone-200/70", className)} />;
}

/** What to show when a list is empty: what is missing and the one action that fixes it. */
export function EmptyState({ icon, title, text, action, className }: {
  icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      {icon && <span className="mb-3 text-rose-200 [&>svg]:h-10 [&>svg]:w-10">{icon}</span>}
      <p className="font-semibold text-stone-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

type AlertTone = "info" | "success" | "warning" | "error";

const ALERT_TONES: Record<AlertTone, string> = {
  info: "border-stone-200 bg-white text-stone-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

/** Inline message inside a page or form. Errors are announced to screen readers immediately. */
export function Alert({ tone = "info", className, children }: { tone?: AlertTone; className?: string; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl border p-4 text-sm", ALERT_TONES[tone], className)}>
      {children}
    </div>
  );
}
