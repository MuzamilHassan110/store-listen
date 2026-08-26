import { expect, test } from "@playwright/test";

test.describe("conversations", () => {
  test.skip(process.env.E2E !== "1", "Set E2E=1 and start the dashboard to run Playwright flows");

  test("opens the conversation list", async ({ page }) => {
    await page.goto("/conversations");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/conversations|sign in/i).first()).toBeVisible();
  });
});
