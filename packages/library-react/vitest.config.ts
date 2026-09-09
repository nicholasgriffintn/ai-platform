import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "test/**"],
    projects: [
      { test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] } },
      { test: { name: "react", environment: "jsdom", include: ["src/**/*.test.tsx"] } },
    ],
  },
});
