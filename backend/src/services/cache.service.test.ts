import { describe, expect, it } from "vitest";
import { cacheGet, cacheInvalidate, cacheSet, cacheWrap } from "./cache.service.js";

describe("cache.service", () => {
  it("stores and expires values", async () => {
    cacheSet("demo:a", 1, 50);
    expect(cacheGet<number>("demo:a")).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cacheGet<number>("demo:a")).toBeUndefined();
  });

  it("wraps a factory and can invalidate by prefix", async () => {
    let calls = 0;
    const first = await cacheWrap("wrap:x", 10_000, async () => {
      calls += 1;
      return "ok";
    });
    const second = await cacheWrap("wrap:x", 10_000, async () => {
      calls += 1;
      return "nope";
    });
    expect(first).toBe("ok");
    expect(second).toBe("ok");
    expect(calls).toBe(1);
    expect(cacheInvalidate("wrap:")).toBeGreaterThan(0);
  });
});
