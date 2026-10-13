import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  splitting: true,
  sourcemap: true,
  external: ["react", "react-dom"],
});
