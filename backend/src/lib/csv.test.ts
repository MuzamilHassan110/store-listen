import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.js";

describe("toCsv", () => {
  it("quotes commas and quotes", () => {
    const csv = toCsv(["name", "note"], [["Ahmed, Khan", 'said "hello"']]);
    expect(csv).toContain('"Ahmed, Khan"');
    expect(csv).toContain('"said ""hello"""');
  });
});
