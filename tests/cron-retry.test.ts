import { describe, expect, it, vi } from "vitest";
import { cleanErrorText } from "@/lib/error-log";
import { claimWithRetry } from "@/lib/notifications";

const failed = { data: null, error: { message: "timed out" } };
const worked = { data: [], error: null };

describe("claimWithRetry", () => {
  it("does not repeat a read that worked", async () => {
    const claim = vi.fn(async () => worked);
    await expect(claimWithRetry(claim, () => true, 0)).resolves.toBe(worked);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("recovers when the second read works", async () => {
    const claim = vi.fn<() => Promise<typeof failed | typeof worked>>().mockResolvedValueOnce(failed).mockResolvedValueOnce(worked);
    await expect(claimWithRetry(claim, () => true, 0)).resolves.toBe(worked);
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("tries only once more, then returns the error", async () => {
    const claim = vi.fn(async () => failed);
    await expect(claimWithRetry(claim, () => true, 0)).resolves.toBe(failed);
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("does not retry when there is no time left", async () => {
    const claim = vi.fn(async () => failed);
    await expect(claimWithRetry(claim, () => false, 0)).resolves.toBe(failed);
    expect(claim).toHaveBeenCalledTimes(1);
  });
});

describe("cleanErrorText with an HTML error page", () => {
  const page = `<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]--> <html class="no-js" lang="en-US"> <head> <title>supabase.co | 522: Connection timed out</title> <meta charset="UTF-8" /></head><body>${"x".repeat(2000)}</body></html>`;

  it("keeps only the page title after the message prefix", () => {
    expect(cleanErrorText(`Message queue failed: ${page}`, 500)).toBe("Message queue failed: supabase.co | 522: Connection timed out");
  });

  it("still says what happened when the page has no title", () => {
    expect(cleanErrorText("Billing cycle failed: <html><body>Bad gateway</body></html>", 500)).toBe("Billing cycle failed: HTML error page");
  });

  it("leaves normal messages alone", () => {
    expect(cleanErrorText("Could not read the uBill SMS balance", 500)).toBe("Could not read the uBill SMS balance");
  });
});
