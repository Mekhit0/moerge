"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "./cn";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, options?: { tone?: ToastTone; action?: ToastItem["action"]; durationMs?: number }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES: Record<ToastTone, string> = {
  success: "text-emerald-600",
  error: "text-red-600",
  info: "text-brand",
};

/** Short confirmations after an action ("Saved", "Visit moved", with optional Undo). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  // Where toasts are rendered: the page, or the open sheet or dialog. A modal <dialog> sits above
  // everything and makes the rest of the page non-interactive, so a toast outside it could not be
  // seen or tapped (Undo would not work). Following the topmost open dialog avoids both problems.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const update = () => {
      const open = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
      setHost(open.length ? open[open.length - 1] : null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const show = useCallback<ToastApi["show"]>((message, options = {}) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone: options.tone ?? "info", action: options.action }]);
    window.setTimeout(() => dismiss(id), options.durationMs ?? (options.action ? 7000 : 4000));
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (message) => show(message, { tone: "success" }),
    error: (message) => show(message, { tone: "error", durationMs: 7000 }),
  }), [show]);

  // Top center, so a toast never covers the main button of a sheet or the phone tab bar.
  const region = (
      <div aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"}
              className="step-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl">
              <Icon className={cn("h-5 w-5 shrink-0", TONES[toast.tone])} aria-hidden="true" />
              <span className="min-w-0 flex-1">{toast.message}</span>
              {toast.action && (
                <button type="button" onClick={() => { toast.action?.onClick(); dismiss(toast.id); }} className="min-h-9 shrink-0 rounded-lg px-2 font-semibold text-rose-300 hover:text-rose-200">
                  {toast.action.label}
                </button>
              )}
              <button type="button" onClick={() => dismiss(toast.id)} aria-label={t("დახურვა", "Close")} className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted && createPortal(region, host ?? document.body)}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider.");
  return api;
}
