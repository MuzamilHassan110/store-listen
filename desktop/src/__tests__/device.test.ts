import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateDeviceId, getSalesmanId } from "../lib/device";

describe("desktop device helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a stable device id and reads an optional salesman id", () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(first).toBe(second);
    expect(getSalesmanId()).toBeNull();
    localStorage.setItem("storelisten_salesman_id", "s-1");
    expect(getSalesmanId()).toBe("s-1");
  });
});
