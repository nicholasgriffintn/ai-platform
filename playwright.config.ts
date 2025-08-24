import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @assistant/app dev",
    url: "http://localhost:5173",
    cwd: __dirname,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/results.xml" }],
  ],
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
