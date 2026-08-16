import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	fullyParallel: true,
	workers: 4,
	timeout: 30 * 1000,
	retries: process.env.CI ? 1 : 0,
	testDir: "./apps/app/tests/e2e",
	use: {
		actionTimeout: 10 * 1000,
		baseURL: "http://localhost:5173",
		permissions: ["clipboard-read", "clipboard-write"],
		trace: "on-first-retry",
		viewport: { width: 1280, height: 720 },
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: [
		{
			command: "node apps/app/tests/e2e/runtime/server.mjs",
			url: "http://localhost:8787/__e2e-ready",
			timeout: 120 * 1000,
			reuseExistingServer: false,
		},
		{
			command: "pnpm --filter @assistant/app serve:e2e",
			url: "http://localhost:5173/chat",
			timeout: 120 * 1000,
			reuseExistingServer: false,
		},
	],
	reporter: [
		["html", { open: "never" }],
		["json", { outputFile: "test-results/results.json" }],
		["junit", { outputFile: "test-results/results.xml" }],
	],
	projects: [
		{
			name: "desktop-chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
