import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cloudflare/sandbox": fileURLToPath(
        new URL("./src/test/cloudflare-sandbox.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.integration.ts"],
    hookTimeout: 600_000,
    testTimeout: 600_000,
  },
});
