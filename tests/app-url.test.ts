import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl, getAppUrl } from "../src/lib/app-url";

describe("app URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the origin from NEXT_PUBLIC_APP_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.moarge.com/");
    expect(getAppUrl()).toBe("https://www.moarge.com");
    expect(appUrl("/book?salon=demo")).toBe("https://www.moarge.com/book?salon=demo");
    expect(appUrl("pricing")).toBe("https://www.moarge.com/pricing");
  });

  it("fails loudly when the variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() => getAppUrl()).toThrow(/Missing NEXT_PUBLIC_APP_URL/);
  });

  it("rejects values that are not http or https URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "moarge.com");
    expect(() => getAppUrl()).toThrow(/absolute URL/);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "ftp://moarge.com");
    expect(() => getAppUrl()).toThrow(/http or https/);
  });
});
