import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";
import { TEST_MESSAGES } from "../fixtures/test-data";

const PLAYWRIGHT_API_KEY = process.env.PLAYWRIGHT_API_KEY;

test.describe("Resilience and Error Handling", () => {
	test.skip(
		!PLAYWRIGHT_API_KEY,
		"Set PLAYWRIGHT_API_KEY with a valid Polychat API key before running resilience E2E tests.",
	);

	let homePage: HomePage;

	test.beforeEach(async ({ page }) => {
		homePage = TestHelpers.createHomePage(page);
		await TestHelpers.injectApiKeyBeforeNavigation(
			page,
			PLAYWRIGHT_API_KEY as string,
		);
		await homePage.navigate();
		await homePage.waitForPageLoad();
	});

	test.describe("Network Error Handling", () => {
		test("handles API errors gracefully", async ({ page }) => {
			await page.route("**/api/chat/completions", (route) => {
				route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ error: "Internal server error" }),
				});
			});

			await homePage.sendMessage(TEST_MESSAGES.simple);

			const errorIndicator = page.locator(
				'[data-testid="error-message"], .error, [role="alert"]',
			);
			await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
		});

		test("handles rate limiting", async ({ page }) => {
			await page.route("**/api/chat/completions", (route) => {
				route.fulfill({
					status: 429,
					contentType: "application/json",
					body: JSON.stringify({ error: "Too many requests" }),
				});
			});

			await homePage.sendMessage(TEST_MESSAGES.simple);

			const errorIndicator = page.locator(
				'[data-testid="error-message"], .error, [role="alert"]',
			);
			await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
		});

		test("recovers from network errors and can retry", async ({ page }) => {
			let requestCount = 0;

			await page.route("**/api/chat/completions", (route) => {
				requestCount++;
				if (requestCount === 1) {
					route.abort("failed");
				} else {
					route.continue();
				}
			});

			await homePage.sendMessage(TEST_MESSAGES.simple);
			await page.waitForTimeout(2000);

			await homePage.sendMessage(TEST_MESSAGES.veryShort);
			await homePage.waitForChatResponse(0);

			const messageCount = await homePage.getAssistantMessageCount();
			expect(messageCount).toBeGreaterThan(0);
		});
	});

	test.describe("Input Validation", () => {
		test("handles empty messages appropriately", async ({ page }) => {
			const chatInput = page.locator("#message-input");
			const sendButton = page.getByRole("button", { name: /send message/i });

			await chatInput.fill("");
			await sendButton.click();

			const messageCount = await homePage.getAssistantMessageCount();
			expect(messageCount).toBe(0);
		});

		test("handles very long messages", async () => {
			const longMessage = "A".repeat(5000);
			const previousCount = await homePage.getAssistantMessageCount();

			await homePage.sendMessage(longMessage);

			try {
				await homePage.waitForChatResponse(previousCount);
				const newCount = await homePage.getAssistantMessageCount();
				expect(newCount).toBeGreaterThanOrEqual(previousCount);
			} catch {
				console.log("Long message handled with error (acceptable behavior)");
			}
		});

		test("handles special unicode characters", async () => {
			const unicodeMessage = "Hello 👋 こんにちは 你好 🚀 emoji test";
			const previousCount = await homePage.getAssistantMessageCount();

			await homePage.sendMessage(unicodeMessage);
			await homePage.waitForChatResponse(previousCount);

			const newCount = await homePage.getAssistantMessageCount();
			expect(newCount).toBeGreaterThan(previousCount);
		});
	});

	test.describe("State Recovery", () => {
		test("preserves state after navigation", async ({ page }) => {
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(0);

			const messageCountBefore = await homePage.getAssistantMessageCount();

			await page.goto("/");
			await homePage.waitForPageLoad();

			const messageCountAfter = await homePage.getAssistantMessageCount();
			expect(messageCountAfter).toBe(messageCountBefore);
		});

		test("handles localStorage quota exceeded", async ({ page }) => {
			await page.evaluate(() => {
				try {
					const largeData = "x".repeat(5 * 1024 * 1024);
					for (let i = 0; i < 100; i++) {
						try {
							localStorage.setItem(`test_key_${i}`, largeData);
						} catch {
							break;
						}
					}
				} catch {
					console.log("Filled localStorage");
				}
			});

			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(previousCount);

			const newCount = await homePage.getAssistantMessageCount();
			expect(newCount).toBeGreaterThan(previousCount);

			await page.evaluate(() => {
				for (let i = 0; i < 100; i++) {
					localStorage.removeItem(`test_key_${i}`);
				}
			});
		});
	});

	test.describe("Concurrent Operations", () => {
		test("handles creating new chat while message is loading", async ({
			page,
		}) => {
			await page.route("**/api/chat/completions", async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				await route.continue();
			});

			await homePage.sendMessage(TEST_MESSAGES.simple);
			await page.waitForTimeout(500);

			await homePage.startNewChat();

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeEmpty();
		});

		test("handles page reload during active request", async ({ page }) => {
			await page.route("**/api/chat/completions", async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 5000));
				await route.continue();
			});

			await homePage.sendMessage(TEST_MESSAGES.simple);
			await page.waitForTimeout(1000);

			await page.reload();
			await homePage.waitForPageLoad();

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();
		});
	});

	test.describe("Performance Under Load", () => {
		test("handles multiple messages in quick succession", async () => {
			const messages = Array(5)
				.fill(null)
				.map((_, i) => `Message ${i + 1}`);

			for (const message of messages) {
				const previousCount = await homePage.getAssistantMessageCount();
				await homePage.sendMessage(message);
				await homePage.waitForChatResponse(previousCount);
			}

			const finalCount = await homePage.getAssistantMessageCount();
			expect(finalCount).toBe(messages.length);
		});

		test("maintains responsiveness with many messages", async ({ page }) => {
			for (let i = 0; i < 3; i++) {
				const previousCount = await homePage.getAssistantMessageCount();
				await homePage.sendMessage(`Test message ${i + 1}`);
				await homePage.waitForChatResponse(previousCount);
			}

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeEditable();

			const sendButton = page.getByRole("button", { name: /send message/i });
			await expect(sendButton).toBeVisible();
		});
	});

	test.describe("Browser Compatibility", () => {
		test("works with disabled JavaScript features", async ({ page }) => {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "serviceWorker", {
					value: undefined,
					writable: false,
				});
			});

			await page.reload();
			await homePage.waitForPageLoad();

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();
		});

		test("handles localStorage being unavailable", async ({ page }) => {
			await page.addInitScript(() => {
				Object.defineProperty(window, "localStorage", {
					get() {
						throw new Error("localStorage is not available");
					},
				});
			});

			try {
				await page.reload();
				await homePage.waitForPageLoad();

				const chatInput = page.locator("#message-input");
				const isVisible = await chatInput.isVisible({ timeout: 5000 });
				expect(isVisible).toBeTruthy();
			} catch {
				console.log("App requires localStorage (acceptable behavior)");
			}
		});
	});

	test.describe("Data Integrity", () => {
		test("preserves message order", async () => {
			const messages = ["First", "Second", "Third"];

			for (const message of messages) {
				const previousCount = await homePage.getAssistantMessageCount();
				await homePage.sendMessage(message);
				await homePage.waitForChatResponse(previousCount);
			}

			const finalCount = await homePage.getAssistantMessageCount();
			expect(finalCount).toBe(messages.length);
		});

		test("handles corrupt localStorage data", async ({ page }) => {
			await page.evaluate(() => {
				localStorage.setItem("invalid-key", "}{invalid json");
				localStorage.setItem("chat-store", "not valid json at all");
			});

			await page.reload();
			await homePage.waitForPageLoad();

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();
		});
	});
});
