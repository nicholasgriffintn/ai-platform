import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), react()],
  clearScreen: false,
  server: { port: 5183, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  resolve: {
    conditions: command === "serve" ? ["polychat-source", ...defaultClientConditions] : undefined,
  },
}));
