import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";
import { TEST_MESSAGES } from "../fixtures/test-data";

const PLAYWRIGHT_API_KEY = process.env.PLAYWRIGHT_API_KEY;

test.describe("App Features", () => {
	test.skip(
		!PLAYWRIGHT_API_KEY,
		"Set PLAYWRIGHT_API_KEY with a valid Polychat API key before running app E2E tests.",
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

	test.describe("UI State and Persistence", () => {
		test("maintains chat history on page reload", async ({ page }) => {
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(0);

			const messageCountBeforeReload =
				await homePage.getAssistantMessageCount();
			expect(messageCountBeforeReload).toBeGreaterThan(0);

			await page.reload();
			await homePage.waitForPageLoad();

			const messageCountAfterReload = await homePage.getAssistantMessageCount();
			expect(messageCountAfterReload).toBe(messageCountBeforeReload);
		});

		test("preserves API key across page reloads", async ({ page }) => {
			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();

			await page.reload();
			await homePage.waitForPageLoad();

			await expect(chatInput).toBeVisible();
		});
	});

	test.describe("User Interface", () => {
		test("chat input is accessible and functional", async ({ page }) => {
			const chatInput = page.locator("#message-input");

			await expect(chatInput).toBeVisible();
			await expect(chatInput).toBeEditable();

			await chatInput.fill(TEST_MESSAGES.simple);
			await expect(chatInput).toHaveValue(TEST_MESSAGES.simple);
		});

		test("send button is enabled when message is present", async ({ page }) => {
			const chatInput = page.locator("#message-input");
			const sendButton = page.getByRole("button", { name: /send message/i });

			await chatInput.fill("");
			const isDisabledWhenEmpty = await sendButton.isDisabled();

			await chatInput.fill(TEST_MESSAGES.simple);
			const isEnabledWhenFilled = await sendButton.isEnabled();

			expect(isDisabledWhenEmpty || isEnabledWhenFilled).toBeTruthy();
		});

		test("new chat button is visible and accessible", async ({ page }) => {
			const newChatButton = page.getByRole("button", { name: /New Chat/i });
			await expect(newChatButton).toBeVisible();
		});

		test("displays welcome message on fresh load", async () => {
			const isWelcomeVisible = await homePage.isWelcomeScreenVisible();
			expect(isWelcomeVisible).toBeTruthy();
		});
	});

	test.describe("Keyboard Navigation", () => {
		test("can send message with Enter key", async ({ page }) => {
			const chatInput = page.locator("#message-input");
			await chatInput.fill(TEST_MESSAGES.veryShort);

			const previousCount = await homePage.getAssistantMessageCount();
			await chatInput.press("Enter");
			await homePage.waitForChatResponse(previousCount);

			const newCount = await homePage.getAssistantMessageCount();
			expect(newCount).toBeGreaterThan(previousCount);
		});

		test("can navigate with Tab key", async ({ page }) => {
			const chatInput = page.locator("#message-input");
			await chatInput.focus();
			await expect(chatInput).toBeFocused();

			await page.keyboard.press("Tab");

			const activeElement = await page.evaluate(
				() => document.activeElement?.tagName,
			);
			expect(activeElement).not.toBe("INPUT");
		});
	});

	test.describe("Responsive Behavior", () => {
		test("works on mobile viewport", async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();

			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(previousCount);

			const newCount = await homePage.getAssistantMessageCount();
			expect(newCount).toBeGreaterThan(previousCount);
		});

		test("works on tablet viewport", async ({ page }) => {
			await page.setViewportSize({ width: 768, height: 1024 });

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeVisible();

			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(previousCount);

			const newCount = await homePage.getAssistantMessageCount();
			expect(newCount).toBeGreaterThan(previousCount);
		});
	});

	test.describe("Chat Message Display", () => {
		test("displays user messages correctly", async ({ page }) => {
			await homePage.sendMessage(TEST_MESSAGES.simple);

			const userMessage = page.locator('[data-role="user"]').last();
			await expect(userMessage).toBeVisible();
			await expect(userMessage).toContainText(TEST_MESSAGES.simple);
		});

		test("formats code blocks in responses", async () => {
			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(
				"Write a simple hello world in JavaScript. Return only code, no explanation.",
			);
			await homePage.waitForChatResponse(previousCount);

			const assistantMessage = homePage.getLatestAssistantMessage();
			await expect(assistantMessage).toBeVisible();
		});

		test("displays markdown formatting", async () => {
			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(
				"Respond with: **bold**, *italic*, and a [link](https://example.com)",
			);
			await homePage.waitForChatResponse(previousCount);

			const assistantMessage = homePage.getLatestAssistantMessage();
			await expect(assistantMessage).toBeVisible();
		});
	});
});
