import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_STATS, isDemoMode, resetDemoData, setDemoMode } from "../../lib/demo";
import { enqueueFailedRequest, pendingOfflineCount } from "../../lib/offline-queue";

describe("demo mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles and resets local demo flags", () => {
    expect(isDemoMode()).toBe(false);
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    expect(DEMO_STATS.todayCount).toBe(12);
    resetDemoData();
    expect(isDemoMode()).toBe(false);
  });
});

describe("offline queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores failed requests locally", () => {
    enqueueFailedRequest({ url: "/api/health", method: "GET" });
    expect(pendingOfflineCount()).toBe(1);
  });
});
