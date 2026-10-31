import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "../src/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/settings/staff", "/dashboard")).toBe("/settings/staff");
    expect(safeRedirectPath("/reset-password", "/onboarding")).toBe("/reset-password");
  });

  it("falls back for missing or external targets", () => {
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("dashboard", "/dashboard")).toBe("/dashboard");
  });
});
