/**
 * SMS through uBill (https://documenter.getpostman.com/view/13830965/TVmV6ZWT).
 * The API key and the approved sender's brand ID come from the environment only.
 */

const UBILL_API = "https://api.ubill.dev/v1/sms";
const REQUEST_TIMEOUT_MS = 15_000;

/** Below this many SMS on the moarge uBill account the platform owner gets an alert. */
export const UBILL_LOW_BALANCE = 500;

/** What one SMS part costs us at uBill (10 ₾ for 1000). */
export const SMS_PROVIDER_COST_GEL = 0.01;

/**
 * How many billed SMS a text takes. Plain Latin text fits 160 characters (153 per part when
 * split); anything else, Georgian letters included, is Unicode: 70, or 67 per part.
 * Keep in sync with public.sms_segments() in the database.
 */
export function smsParts(text: string): number {
  if (!text) return 0;
  const length = Array.from(text).length;
  if (/^[A-Za-z0-9 @$_!"#%&'()*+,./:;<=>?\n\r-]*$/.test(text)) return length <= 160 ? 1 : Math.ceil(length / 153);
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

/** uBill wants international format without + or 00: 995XXXXXXXXX. */
export function ubillNumber(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^00/, "");
}

export class UbillError extends Error {
  constructor(message: string, readonly statusCode: number, readonly ubillStatus: number | null = null) {
    super(message);
  }
}

// uBill's statusID for a send: 0 sent, 40 out of SMS, 99 general error. The rest are request
// problems that will not fix themselves on a retry.
const SEND_ERRORS: Record<number, { message: string; retry: boolean }> = {
  10: { message: "uBill: sender name not found", retry: false },
  20: { message: "uBill: no phone number", retry: false },
  30: { message: "uBill: empty message", retry: false },
  40: { message: "uBill: the moarge SMS balance is empty", retry: true },
  50: { message: "uBill: no valid phone number", retry: false },
  60: { message: "uBill: invalid send time", retry: false },
  90: { message: "uBill: malformed request", retry: false },
  99: { message: "uBill: general error", retry: true },
};

function ubillConfig(options: { apiKey?: string; brandId?: string }) {
  const apiKey = (options.apiKey ?? process.env.UBILL_API_KEY)?.trim();
  const brandId = (options.brandId ?? process.env.UBILL_BRAND_ID)?.trim();
  if (!apiKey || !brandId || !/^\d+$/.test(brandId)) {
    throw new UbillError("UBILL_API_KEY and UBILL_BRAND_ID must be configured.", 503);
  }
  return { apiKey, brandId: Number(brandId) };
}

/** Sends one text to one number. Returns uBill's message ID. */
export async function sendUbillSms(input: { number: string; text: string }, options: { apiKey?: string; brandId?: string; fetcher?: typeof fetch } = {}) {
  const { apiKey, brandId } = ubillConfig(options);
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${UBILL_API}/send`, {
      method: "POST",
      headers: { key: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ brandID: brandId, numbers: [ubillNumber(input.number)], text: input.text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new UbillError("uBill could not be reached.", 503);
  }
  const payload = await response.json().catch(() => ({})) as { statusID?: number; smsID?: string | number; message?: string };
  if (response.ok && payload.statusID === 0 && payload.smsID != null) return { id: String(payload.smsID) };
  if (!response.ok) throw new UbillError(`uBill answered HTTP ${response.status}.`, response.status === 429 || response.status >= 500 ? 503 : 422);
  const known = payload.statusID != null ? SEND_ERRORS[payload.statusID] : undefined;
  const retry = known ? known.retry : true;
  throw new UbillError(known?.message ?? `uBill rejected the SMS (status ${payload.statusID ?? "unknown"}).`, retry ? 503 : 422, payload.statusID ?? null);
}

/** How many SMS are left on the moarge uBill account. */
export async function ubillBalance(options: { apiKey?: string; fetcher?: typeof fetch } = {}): Promise<number> {
  const apiKey = (options.apiKey ?? process.env.UBILL_API_KEY)?.trim();
  if (!apiKey) throw new UbillError("UBILL_API_KEY is not configured.", 503);
  const fetcher = options.fetcher ?? fetch;
  // uBill documents the key as a query parameter for this call. The URL is never logged.
  const response = await fetcher(`${UBILL_API}/balance?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({})) as { statusID?: number; sms?: number };
  if (!response.ok || payload.statusID !== 0 || typeof payload.sms !== "number") throw new UbillError("Could not read the uBill balance.", 503);
  return payload.sms;
}
