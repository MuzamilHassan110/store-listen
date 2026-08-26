import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../contexts/LanguageContext";
import Login from "../../pages/Login";

vi.mock("../../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: null,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    session: null,
    loading: false,
    twoFactorRequired: false,
    signIn: vi.fn(),
    completeTwoFactor: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("Login page", () => {
  it("renders the sign-in form", () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Login />
        </LanguageProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("StoreListen")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
