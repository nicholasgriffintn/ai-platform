import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only workspaces with their own Vitest config; `packages/config` ships presets and uses node:test.
    projects: ["apps/*", "packages/*/vitest.config.{ts,mts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["apps/*/src/**/*.{js,ts,tsx}", "packages/*/src/**/*.{js,ts,tsx}"],
      exclude: [
        "apps/*/src/**/*.d.ts",
        "apps/*/src/**/*.test.{js,ts,tsx}",
        "apps/*/src/**/__test__/**",
        "apps/*/src/**/test/**",
        "apps/*/node_modules/**",
        "packages/*/src/**/*.d.ts",
        "packages/*/src/**/*.test.{js,ts,tsx}",
        "packages/*/src/**/test/**",
        "packages/*/node_modules/**",
      ],
    },
    browser: {
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
