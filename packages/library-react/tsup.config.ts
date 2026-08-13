import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.tsx", "src/conversation-cache.ts"],
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	external: ["react", "react/jsx-runtime", "@tanstack/react-query"],
});
