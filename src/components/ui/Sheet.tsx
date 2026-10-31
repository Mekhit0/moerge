"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "./cn";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared behavior for Sheet and Dialog, built on the native <dialog> element so focus trapping,
 * Escape to close and the backdrop come from the browser.
 */
function useNativeDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    // Keep the page behind still while the panel is open.
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = previous; };
  }, [open]);
  return ref;
}

function OverlayBody({ title, description, footer, children, onClose }: Omit<OverlayProps, "open" | "className">) {
  const { t } = useLanguage();
  return (
    <div className="flex max-h-[inherit] min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t("დახურვა", "Close")}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="border-t border-stone-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  );
}

function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>, onClose: () => void) {
  if (event.target === event.currentTarget) onClose();
}

/**
 * Panel for viewing or editing one thing (a visit, a client, a new booking) without leaving the page.
 * Slides up from the bottom on phones and in from the right on tablets and desktops.
 */
export function Sheet({ open, onClose, className, ...body }: OverlayProps) {
  const ref = useNativeDialog(open);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => closeOnBackdrop(event, onClose)}
      className={cn(
        "sheet-panel m-0 mt-auto max-h-[92dvh] w-full max-w-none flex-col rounded-t-3xl bg-white p-0 text-stone-900 shadow-2xl open:flex",
        "md:ml-auto md:mt-0 md:h-dvh md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-3xl",
        className
      )}
    >
      {open && <OverlayBody onClose={onClose} {...body} />}
    </dialog>
  );
}

/** Centered window for short confirmations and small forms. */
export function Dialog({ open, onClose, className, ...body }: OverlayProps) {
  const ref = useNativeDialog(open);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => closeOnBackdrop(event, onClose)}
      className={cn("dialog-panel m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md flex-col rounded-3xl bg-white p-0 text-stone-900 shadow-2xl open:flex", className)}
    >
      {open && <OverlayBody onClose={onClose} {...body} />}
    </dialog>
  );
}
