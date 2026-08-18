import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // The artefact sandbox pulls in Babel on demand, so it must stay a separate chunk.
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
