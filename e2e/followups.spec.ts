import { expect, test } from "@playwright/test";

test.describe("follow-ups", () => {
  test.skip(process.env.E2E !== "1", "Set E2E=1 and start the dashboard to run Playwright flows");

  test("opens the follow-up list", async ({ page }) => {
    await page.goto("/followups");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/follow-up|sign in/i).first()).toBeVisible();
  });
});
