import { readFile } from "node:fs/promises";
import path from "node:path";

import { workspaceSourceResolve } from "@ngriffin_uk/polychat-config/vitest/workspace";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...workspaceSourceResolve,
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
      exclude: ["node_modules/", "**/dist/**", "**/*.d.ts", "**/types/**"],
    },
    pool: "threads",
  },
  resolve: {
    ...workspaceSourceResolve.resolve,
    alias: {
      "~": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
