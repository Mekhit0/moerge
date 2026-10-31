/**
 * Returns `value` only when it is a same-site path such as "/settings/staff".
 * Rejects absolute URLs, protocol-relative URLs ("//evil.com") and backslash tricks,
 * so a link cannot send a signed-in user to another site.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
