import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";
import {
	TEST_MESSAGES,
	CHAT_TEST_SCENARIOS,
	CORE_PROMPTS,
} from "../fixtures/test-data";

const PLAYWRIGHT_API_KEY = process.env.PLAYWRIGHT_API_KEY;

test.describe("Chat Feature", () => {
	test.skip(
		!PLAYWRIGHT_API_KEY,
		"Set PLAYWRIGHT_API_KEY with a valid Polychat API key before running chat E2E tests.",
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

	test.describe("Basic Chat Interactions", () => {
		test("responds to core prompts via live API", async () => {
			for (const prompt of CORE_PROMPTS) {
				await test.step(`Prompt: ${prompt.name}`, async () => {
					const previousCount = await homePage.getAssistantMessageCount();

					await homePage.sendMessage(prompt.message);
					await homePage.waitForChatResponse(previousCount);

					const assistantMessage = homePage.getLatestAssistantMessage();
					for (const expectation of prompt.expectations) {
						await expect(assistantMessage).toContainText(expectation, {
							timeout: 60000,
						});
					}
				});
			}
		});

		test("handles different message types", async () => {
			const messageTests = [
				{ type: "simple", message: TEST_MESSAGES.simple },
				{ type: "very short", message: TEST_MESSAGES.veryShort },
				{ type: "multiline", message: TEST_MESSAGES.multiline },
				{ type: "special characters", message: TEST_MESSAGES.withSpecialChars },
			];

			for (const { type, message } of messageTests) {
				await test.step(`Handles ${type} message`, async () => {
					const previousCount = await homePage.getAssistantMessageCount();
					await homePage.sendMessage(message);
					await homePage.waitForChatResponse(previousCount);

					const newCount = await homePage.getAssistantMessageCount();
					expect(newCount).toBeGreaterThan(previousCount);
				});
			}
		});

		test("allows starting a new chat after API interaction", async ({
			page,
		}) => {
			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(previousCount);
			await homePage.startNewChat();

			const chatInput = page.locator("#message-input");
			await expect(chatInput).toBeEmpty();
		});
	});

	test.describe("Multi-turn Conversations", () => {
		test("maintains context across multiple messages", async () => {
			let previousCount = await homePage.getAssistantMessageCount();

			for (const turn of CHAT_TEST_SCENARIOS.multiTurn) {
				await test.step(`Turn: ${turn.message}`, async () => {
					await homePage.sendMessage(turn.message);
					await homePage.waitForChatResponse(previousCount);

					const assistantMessage = homePage.getLatestAssistantMessage();
					await expect(assistantMessage).toContainText(turn.expectation, {
						timeout: 60000,
					});

					previousCount = await homePage.getAssistantMessageCount();
				});
			}
		});

		test("handles code refinement across turns", async () => {
			let previousCount = await homePage.getAssistantMessageCount();

			for (const turn of CHAT_TEST_SCENARIOS.codeGeneration) {
				await test.step(`Turn: ${turn.message}`, async () => {
					await homePage.sendMessage(turn.message);
					await homePage.waitForChatResponse(previousCount);

					const assistantMessage = homePage.getLatestAssistantMessage();
					await expect(assistantMessage).toContainText(turn.expectation, {
						timeout: 60000,
					});

					previousCount = await homePage.getAssistantMessageCount();
				});
			}
		});

		test("handles format changes across turns", async () => {
			let previousCount = await homePage.getAssistantMessageCount();

			for (const turn of CHAT_TEST_SCENARIOS.structuredData) {
				await test.step(`Turn: ${turn.message}`, async () => {
					await homePage.sendMessage(turn.message);
					await homePage.waitForChatResponse(previousCount);

					const assistantMessage = homePage.getLatestAssistantMessage();
					await expect(assistantMessage).toContainText(turn.expectation, {
						timeout: 60000,
					});

					previousCount = await homePage.getAssistantMessageCount();
				});
			}
		});
	});

	test.describe("Chat Management", () => {
		test("can create multiple new chats", async ({ page }) => {
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(0);
			await homePage.startNewChat();

			let chatInput = page.locator("#message-input");
			await expect(chatInput).toBeEmpty();

			await homePage.sendMessage(TEST_MESSAGES.veryShort);
			await homePage.waitForChatResponse(0);
			await homePage.startNewChat();

			chatInput = page.locator("#message-input");
			await expect(chatInput).toBeEmpty();
		});

		test("new chat starts fresh without previous context", async () => {
			let previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage("My favorite color is blue");
			await homePage.waitForChatResponse(previousCount);

			await homePage.startNewChat();
			previousCount = await homePage.getAssistantMessageCount();
			expect(previousCount).toBe(0);

			await homePage.sendMessage("What is my favorite color?");
			await homePage.waitForChatResponse(0);

			const response = homePage.getLatestAssistantMessage();
			await expect(response).not.toContainText(/blue/i);
		});
	});

	test.describe("Response Handling", () => {
		test("displays assistant responses correctly", async () => {
			const previousCount = await homePage.getAssistantMessageCount();
			await homePage.sendMessage(TEST_MESSAGES.simple);
			await homePage.waitForChatResponse(previousCount);

			const message = homePage.getLatestAssistantMessage();
			await expect(message).toBeVisible();
			await expect(message).toHaveAttribute("data-role", "assistant");
		});

		test("handles rapid consecutive messages", async () => {
			const messages = [
				TEST_MESSAGES.veryShort,
				TEST_MESSAGES.simple,
				TEST_MESSAGES.followUp,
			];

			for (let i = 0; i < messages.length; i++) {
				const previousCount = await homePage.getAssistantMessageCount();
				await homePage.sendMessage(messages[i]);
				await homePage.waitForChatResponse(previousCount);

				const newCount = await homePage.getAssistantMessageCount();
				expect(newCount).toBe(i + 1);
			}
		});
	});
});
