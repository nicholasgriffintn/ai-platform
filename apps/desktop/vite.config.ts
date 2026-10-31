import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

import packageJson from "./package.json" with { type: "json" };

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), react()],
  define: { __POLYCHAT_RELEASE__: JSON.stringify(`polychat-desktop@${packageJson.version}`) },
  clearScreen: false,
  server: { port: 5183, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022", minify: false },
  resolve: {
    conditions: command === "serve" ? ["polychat-source", ...defaultClientConditions] : undefined,
  },
}));
