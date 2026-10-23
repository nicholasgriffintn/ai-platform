import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "./apps/app/tests/e2e/support/environment";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(configDir, ".env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : "50%",
  timeout: 30 * 1000,
  retries: 0,
  testDir: "./apps/app/tests/e2e",
  use: {
    actionTimeout: 10 * 1000,
    baseURL: E2E_APP_BASE_URL,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: {
      mode: process.env.CI ? "retain-on-failure" : "on",
      size: { width: 640, height: 480 },
      show: {
        actions: {
          duration: 500,
          position: "top-right",
          fontSize: 14,
        },
        test: {
          level: "step",
          position: "top-left",
          fontSize: 12,
        },
      },
    },
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
    ...(process.env.PVC_ENVIRONMENT && process.env.PVC_TOKEN
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
