import { readFile } from "node:fs/promises";
import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "skill-markdown",
      enforce: "pre",
      async load(id) {
        if (!id.endsWith(".md")) {
          return null;
        }

        return `export default ${JSON.stringify(await readFile(id, "utf8"))};`;
      },
    },
  ],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "**/dist/**",
        "**/*.d.ts",
        "**/types/**",
        "**/data-model/models/families/**",
      ],
    },
    pool: "threads",
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
