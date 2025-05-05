import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 120 * 1000,
  retries: process.env.CI ? 1 : 0,
  testDir: "./apps/app/tests/e2e",
  globalSetup: path.resolve(__dirname, "playwright.global-setup.ts"),
  globalTeardown: path.resolve(__dirname, "playwright.global-teardown.ts"),
  use: {
    actionTimeout: 0,
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "pnpm --filter @assistant/app dev",
    url: "http://localhost:5173",
    cwd: __dirname,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
