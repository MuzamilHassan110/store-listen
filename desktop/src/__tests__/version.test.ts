import { describe, expect, it } from "vitest";
import { compareVersions, isBelowMinimum } from "../lib/version";

describe("version compare", () => {
  it("orders dotted versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    expect(isBelowMinimum("0.9.0", "1.0.0")).toBe(true);
    expect(isBelowMinimum("1.0.0", "1.0.0")).toBe(false);
  });
});
