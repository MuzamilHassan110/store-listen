import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIsMobile } from "../../hooks/useIsMobile";

describe("useIsMobile", () => {
  it("reads the current matchMedia breakpoint", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("767"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);
  });
});
