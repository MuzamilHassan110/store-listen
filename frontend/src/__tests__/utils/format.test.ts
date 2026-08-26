import { describe, expect, it } from "vitest";
import { formatDuration, formatHours, formatDueLabel } from "../../lib/format";

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(null)).toBe("0:00");
  });
});

describe("formatHours", () => {
  it("converts seconds to hours", () => {
    expect(formatHours(3600)).toBe("1.0h");
    expect(formatHours(undefined)).toBe("0.0h");
  });
});

describe("formatDueLabel", () => {
  it("handles missing dates", () => {
    expect(formatDueLabel(null)).toBe("No due date");
  });
});
