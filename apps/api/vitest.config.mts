import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["./vitest.isolated.config.mts", "./vitest.shared.config.mts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "**/dist/**", "**/*.d.ts", "**/types/**"],
    },
  },
});
