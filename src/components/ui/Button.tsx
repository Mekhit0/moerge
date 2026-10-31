import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-strong",
  secondary: "border border-stone-200 bg-white text-stone-800 hover:border-rose-300 hover:bg-brand-soft",
  ghost: "text-stone-700 hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

// Every size keeps a 44px+ touch target except "sm", which is for dense desktop rows.
const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "min-h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "min-h-14 px-6 text-base gap-2 rounded-2xl",
};

const BASE =
  "inline-flex items-center justify-center font-semibold transition active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

export function buttonClasses({ variant = "primary", size = "md", block = false, className }: {
  variant?: Variant; size?: Size; block?: boolean; className?: string;
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ variant, size, block, loading = false, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClasses({ variant, size, block, className })} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: React.ReactNode;
}

/** A link that looks like a button, for navigation actions. */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Exclude<Variant, "danger">;
}

/** Square button with only an icon. `label` is required so screen readers can name it. */
export function IconButton({ label, variant = "ghost", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={cn(BASE, VARIANTS[variant], "h-11 w-11 shrink-0 rounded-xl", className)} {...rest}>
      {children}
    </button>
  );
}
