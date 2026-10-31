/** Shows a 6-digit booking code as "123 456" so it is easy to read out and type. */
export function formatBookingCode(code: string | null | undefined): string {
  return code ? `${code.slice(0, 3)} ${code.slice(3)}` : "";
}
