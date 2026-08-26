import { describe, expect, it } from "vitest";
import { generateLicenseKey, normalizeLicenseKey, PLAN_LIMITS } from "./license.service.js";

describe("license.service", () => {
  it("generates StoreListen key blocks", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^SL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(normalizeLicenseKey(" sl-abcd ")).toBe("SL-ABCD");
    expect(PLAN_LIMITS.trial.days).toBe(14);
  });
});
