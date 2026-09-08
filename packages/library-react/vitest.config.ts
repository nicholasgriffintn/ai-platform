import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    projects: [
      { test: { name: "node", environment: "node", include: ["src/**/*.test.ts"] } },
      { test: { name: "react", environment: "jsdom", include: ["src/**/*.test.tsx"] } },
    ],
  },
});
