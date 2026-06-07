import { defineConfig } from "vitest/config";
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    projects: ["apps/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["apps/*/src/**/*.{js,ts,tsx}"],
      exclude: [
        "apps/*/src/**/*.d.ts",
        "apps/*/src/**/*.test.{js,ts,tsx}",
        "apps/*/src/**/__test__/**",
        "apps/*/src/**/test/**",
        "apps/*/node_modules/**",
      ],
    },
    browser: {
      provider: playwright(),
      instances: [{ browser: 'chromium' }]
    },
  },
});
