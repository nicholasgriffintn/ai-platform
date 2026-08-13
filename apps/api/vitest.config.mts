import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "**/dist/**", "**/*.d.ts", "**/types/**"],
		},
		pool: "threads",
	},
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
});
