/**
 * Sends a page crash from the browser to our error log. Fire and forget: the error screen shows
 * either way, and a failed report is simply dropped.
 */
export function reportClientError(error: Error & { digest?: string }) {
  try {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${error.name || "Error"}: ${error.message || "Unknown error"}`.slice(0, 1000),
        path: window.location.pathname.slice(0, 300),
        digest: error.digest,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never cause a second error.
  }
}
