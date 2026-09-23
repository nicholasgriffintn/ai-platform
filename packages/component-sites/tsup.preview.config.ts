import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "preview-runtime": "src/preview-runtime.tsx" },
  format: ["iife"],
  platform: "browser",
  target: "es2022",
  splitting: false,
  sourcemap: true,
  clean: false,
  minify: true,
  noExternal: [/.*/],
  outExtension: () => ({ js: ".global.js" }),
});
