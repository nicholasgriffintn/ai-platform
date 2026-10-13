import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    content: "src/content/index.tsx",
    media: "src/media/index.tsx",
    music: "src/music/index.tsx",
  },
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  external: ["react", "react-dom", /^@strudel\//],
});
