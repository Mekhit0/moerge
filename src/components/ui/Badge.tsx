"use client";

import React from "react";
import { getAppointmentStatusLabel, useLanguage } from "@/lib/i18n";
import { cn } from "./cn";
import { statusTone } from "./status";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-600",
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
};

export function Badge({ tone = "neutral", className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone], className)} {...rest} />;
}

/** Visit status pill with the shared color and translated label. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { lang } = useLanguage();
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", statusTone(status), className)}>
      {getAppointmentStatusLabel(status, lang)}
    </span>
  );
}
