import React from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Segmented control for switching views inside one screen (day / week, list segments). */
export function Tabs<T extends string>({ items, value, onChange, label, className }: {
  items: TabItem<T>[]; value: T; onChange: (value: T) => void; label: string; className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-stone-100 p-1 no-scrollbar", className)}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              selected ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900"
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs", selected ? "bg-brand-soft text-brand-strong" : "bg-stone-200 text-stone-600")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
