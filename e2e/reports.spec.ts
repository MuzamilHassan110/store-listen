import { expect, test } from "@playwright/test";

test.describe("reports", () => {
  test.skip(process.env.E2E !== "1", "Set E2E=1 and start the dashboard to run Playwright flows");

  test("opens the reports page", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/report|sign in/i).first()).toBeVisible();
  });
});
