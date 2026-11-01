"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last resort when the root layout itself fails. It replaces the whole page, so it has its own
 * html and body and uses plain styles. The error is reported to Sentry when it is configured.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ka">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf8f6", fontFamily: "system-ui, sans-serif", color: "#1c1917" }}>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>დაფიქსირდა შეცდომა</h1>
          <p style={{ margin: "0 0 24px", color: "#78716c", fontSize: 14 }}>გვერდი ვერ ჩაიტვირთა. სცადეთ თავიდან. / Something went wrong. Please try again.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 24px", border: 0, borderRadius: 16, background: "#e11d48", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            თავიდან ცდა
          </button>
        </div>
      </body>
    </html>
  );
}
