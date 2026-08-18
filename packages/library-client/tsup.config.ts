import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/project-scope.ts", "src/retry.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
