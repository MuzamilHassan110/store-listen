import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "../../components/States";

describe("EmptyState", () => {
  it("renders title, hint, and optional action", async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Nothing here" hint="Record a conversation first." action={{ label: "Go", onClick }} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Record a conversation first.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
