import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices, type ReporterDescription } from "@playwright/test";
import dotenv from "dotenv";

import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "./apps/app/tests/e2e/support/environment";

const configDir = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(configDir, ".env"), quiet: true });

export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : "50%",
  timeout: 30 * 1000,
  retries: process.env.CI ? 1 : 0,
  testDir: "./apps/app/tests/e2e",
  use: {
    actionTimeout: 10 * 1000,
    baseURL: E2E_APP_BASE_URL,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  webServer: [
    {
      command: "node apps/app/tests/e2e/runtime/server.mjs",
      url: `${E2E_API_BASE_URL}/__e2e-ready`,
      timeout: 120 * 1000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      command: "pnpm --filter @assistant/app serve:e2e",
      url: `${E2E_APP_BASE_URL}/chat`,
      timeout: 120 * 1000,
      reuseExistingServer: false,
    },
  ],
  reporter: [
    ["line"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/results.xml" }],
    ...(process.env.PVC_ENVIRONMENT && process.env.PVC_SERVER_URL && process.env.PVC_TOKEN
      ? [["playwright-visual-cloud/reporter"] satisfies ReporterDescription]
      : []),
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
