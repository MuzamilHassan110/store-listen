import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfflineBanner } from "../../components/OfflineBanner";

describe("OfflineBanner", () => {
  it("hides while the browser reports online", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a status banner when offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });
});
