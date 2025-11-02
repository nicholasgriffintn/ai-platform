import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "**/dist/**", "**/*.d.ts", "**/types/**"],
			thresholds: {
				global: {
					branches: 70,
					functions: 70,
					lines: 70,
					statements: 70,
				},
			},
		},
		pool: "threads",
		poolOptions: {
			threads: {
				singleThread: false,
				useAtomics: true,
			},
		},
	},
});
