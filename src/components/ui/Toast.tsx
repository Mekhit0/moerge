"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Above the phone bottom bar; centered on phones, bottom-right on desktop. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end">
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
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider.");
  return api;
}
