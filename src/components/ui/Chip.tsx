import React from "react";
import { cn } from "./cn";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Optional color dot, e.g. a master's calendar color. */
  dotColor?: string;
}

/** Pill-shaped toggle for filters and quick choices (masters, categories, segments). */
export function Chip({ selected = false, dotColor, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        selected ? "border-brand bg-brand text-white" : "border-stone-200 bg-white text-stone-700 hover:border-rose-300",
        className
      )}
      {...rest}
    >
      {dotColor && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />}
      {children}
    </button>
  );
}

/** Horizontally scrolling row of chips that bleeds to the screen edge on phones. */
export function ChipRow({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)} {...rest} />;
}
