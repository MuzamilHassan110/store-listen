import { beforeEach, describe, expect, it } from "vitest";
import { isSetupComplete, markSetupComplete, resetSetup } from "../lib/setup";
import { isLicenseValid, saveLicense } from "../lib/license";

describe("setup and license flags", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("marks setup complete", () => {
    expect(isSetupComplete()).toBe(false);
    markSetupComplete();
    expect(isSetupComplete()).toBe(true);
    resetSetup();
    expect(isSetupComplete()).toBe(false);
  });

  it("treats an existing recorder as already set up", () => {
    localStorage.setItem("storelisten_device_id", "dev-1");
    expect(isSetupComplete()).toBe(true);
  });

  it("treats an expired license as invalid", () => {
    saveLicense({
      license_key: "SL-TEST",
      plan_type: "trial",
      max_stores: 1,
      max_users: 3,
      max_devices: 1,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      is_active: true,
      organization_id: null,
      days_left: -1,
      valid: true,
      expired: false,
    });
    expect(isLicenseValid()).toBe(false);
  });
});
