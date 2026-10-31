/**
 * Canonical public URL of the app (for example https://www.moarge.com), read from
 * NEXT_PUBLIC_APP_URL. Used for SEO metadata and every link we send to clients.
 * Throws when the variable is missing or invalid; there is no fallback domain.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL environment variable.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be an absolute URL such as https://www.moarge.com.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use http or https.");
  }
  return url.origin;
}

export function appUrl(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
