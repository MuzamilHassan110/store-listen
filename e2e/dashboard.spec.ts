import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test.skip(process.env.E2E !== "1", "Set E2E=1 and start the dashboard to run Playwright flows");

  test("redirects guests to login or renders the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    const login = page.getByText(/sign in to the dashboard/i);
    const heading = page.getByRole("heading", { name: /dashboard/i });
    await expect(login.or(heading)).toBeVisible();
  });
});
