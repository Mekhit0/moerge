import React from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-stone-200 bg-white p-4 sm:p-5", className)} {...rest} />;
}

/** Card title row with an optional action on the right (a link or small button). */
export function CardHeader({ title, description, action, className }: {
  title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-stone-900 sm:text-lg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small number tile for dashboards: label, value, optional hint and icon. */
export function StatCard({ label, value, hint, icon, className }: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
      </div>
      {icon && <span className="hidden shrink-0 rounded-xl bg-brand-soft p-3 text-brand-strong sm:block">{icon}</span>}
    </div>
  );
}
