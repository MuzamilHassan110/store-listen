import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
  },
  webServer:
    process.env.E2E === "1"
      ? {
          command: "npm run dev",
          cwd: "frontend",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 120_000,
        }
      : undefined,
});
