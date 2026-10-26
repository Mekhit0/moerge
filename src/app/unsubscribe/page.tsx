"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MailX, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";
import MoargeLogo from "@/components/MoargeLogo";

function UnsubscribeContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const channel = searchParams.get("channel") === "sms" ? "sms" : "email";

  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("");
  const [salonName, setSalonName] = useState<string>("moarge");

  async function handleConfirmUnsubscribe() {
    if (!token) {
      setStatus("error");
      setMessage(
        t(
          "ბმულში გამოწერის გაუქმების კოდი არ მოიძებნა.",
          "Missing unsubscribe token in URL."
        )
      );
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, channel }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus("error");
        setMessage(
          data.error ||
            t(
              "გამოწერის გაუქმების ბმული არასწორია ან ვადაგასულია.",
              "Invalid or expired unsubscribe link."
            )
        );
        return;
      }

      setSalonName(data.salon_name || "moarge");
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage(
        t(
          "მოთხოვნის დამუშავება ვერ მოხერხდა. გთხოვთ სცადოთ ხელახლა.",
          "Unable to process your request right now. Please try again."
        )
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#fdf8f6] flex flex-col items-center justify-center p-6">
      <div className="mb-4">
        <LanguageSwitcher />
      </div>
      <div className="max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-lg p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          {status === "done" ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          ) : (
            <MailX className="w-6 h-6" />
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <MoargeLogo size="sm" variant="full" />
        </div>

        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          {status === "done"
            ? t(
                "გამოწერა წარმატებით გაუქმდა",
                "You Have Been Unsubscribed"
              )
            : t(
                channel === "sms" ? "SMS შეტყობინებების გაუქმება" : "ელ-ფოსტის შეტყობინებების გაუქმება",
                channel === "sms" ? "Unsubscribe from SMS messages" : "Unsubscribe from email messages"
              )}
        </h1>

        {status === "idle" && (
          <>
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">
              {t(
                channel === "sms" ? "დააჭირეთ, რათა აღარ მიიღოთ SMS შეტყობინებები. მოლოდინში მყოფი შეტყობინებები გაუქმდება." : "დააჭირეთ, რათა აღარ მიიღოთ ელ-ფოსტის შეტყობინებები. მოლოდინში მყოფი წერილები გაუქმდება.",
                channel === "sms" ? "Click to stop SMS messages. Pending SMS notifications will be canceled." : "Click to stop email messages. Pending email notifications will be canceled."
              )}
            </p>
            {!token ? (
              <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                {t(
                  "ამ ბმულში გამოწერის გაუქმების ტოკენი არ არის მითითებული. გამოიყენეთ შეხსენების წერილის ბოლოში მოცემული პერსონალური ბმული.",
                  "No unsubscribe token was provided in this URL. Use the personalized link at the bottom of your reminder email."
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirmUnsubscribe}
                className="mt-6 w-full py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm transition cursor-pointer"
              >
                {t(
                  "დაადასტურეთ გამოწერის გაუქმება",
                  "Confirm One-Click Unsubscribe"
                )}
              </button>
            )}
          </>
        )}

        {status === "submitting" && (
          <p className="mt-4 text-sm text-stone-500">
            {t(
              "მიმდინარეობს პარამეტრების განახლება და შეხსენებების გაუქმება...",
              "Updating your email preferences and canceling pending reminders..."
            )}
          </p>
        )}

        {status === "done" && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm leading-relaxed">
            {t(
              channel === "sms" ? `თქვენი ნომერი აღარ მიიღებს SMS შეტყობინებებს სალონიდან „${salonName}“.` : `თქვენი ელ-ფოსტა აღარ მიიღებს შეტყობინებებს სალონიდან „${salonName}“.`,
              channel === "sms" ? `Your number will no longer receive SMS messages from ${salonName}.` : `Your email will no longer receive messages from ${salonName}.`
            )}
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 justify-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fdf8f6] text-stone-500 text-sm">
          იტვირთება... / Loading preferences...
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
