import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", records: "src/Records/index.ts" },
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  loader: { ".png": "copy" },
});
