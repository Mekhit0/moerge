import React, { useId } from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full min-h-12 rounded-xl border bg-white px-4 text-base text-stone-900 placeholder:text-stone-400 transition " +
  "focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-500";

function controlClass(invalid: boolean, className?: string) {
  return cn(CONTROL, invalid ? "border-red-300 focus:border-red-400" : "border-stone-200 focus:border-rose-400", className);
}

/**
 * Label, control, hint and error in one place. Pass a render function to receive the control id
 * and accessibility props, so labels and messages are always connected.
 */
export function Field({ label, hint, error, optionalLabel, className, children }: {
  label: string;
  hint?: string;
  error?: string | null;
  /** Shown after the label, e.g. "(არასავალდებულო)". */
  optionalLabel?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-stone-700">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-stone-400">{optionalLabel}</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={controlClass(Boolean(rest["aria-invalid"]), className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={controlClass(Boolean(rest["aria-invalid"]), cn("appearance-none pr-10", className))} {...rest}>{children}</select>;
}

export function Textarea({ className, ...rest }: React.ComponentProps<"textarea">) {
  return <textarea className={controlClass(Boolean(rest["aria-invalid"]), cn("min-h-24 py-3", className))} {...rest} />;
}
