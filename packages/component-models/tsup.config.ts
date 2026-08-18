import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // Each provider icon is loaded on demand, so the icon chunks must stay separate.
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
