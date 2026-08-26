import { expect, test } from "@playwright/test";

test.describe("login", () => {
  test.skip(process.env.E2E !== "1", "Set E2E=1 and start the dashboard to run Playwright flows");

  test("shows the StoreListen sign-in screen", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("StoreListen")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|add vite_supabase/i })).toBeVisible();
  });
});
