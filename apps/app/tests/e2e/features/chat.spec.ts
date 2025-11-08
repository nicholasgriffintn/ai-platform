import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";
import { TEST_MESSAGES } from "../fixtures/test-data";

const PLAYWRIGHT_API_KEY = process.env.PLAYWRIGHT_API_KEY;

type PromptCheck = {
	name: string;
	message: string;
	expectations: Array<string | RegExp>;
};

const CORE_PROMPTS: PromptCheck[] = [
	{
		name: "deterministic acknowledgement",
		message:
			"Respond with the exact text 'PLAYWRIGHT_HELLO'. Do not include any other characters.",
		expectations: [/PLAYWRIGHT_HELLO/],
	},
	{
		name: "structured summary",
		message:
			"Return valid JSON that includes the keys status and summary. Set status to \"ok\" and include the text 'e2e-check' inside the summary value. Reply with JSON only.",
		expectations: [/\"status\"\s*:\s*\"ok\"/i, /e2e-check/i],
	},
	{
		name: "code generation",
		message:
			"Write a concise TypeScript function named addNumbers that sums two numbers. Include the exact snippet 'function addNumbers'.",
		expectations: [/function addNumbers/i, /\+\s*b/],
	},
];

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

	test("allows starting a new chat after API interaction", async ({ page }) => {
		const previousCount = await homePage.getAssistantMessageCount();
		await homePage.sendMessage(TEST_MESSAGES.simple);
		await homePage.waitForChatResponse(previousCount);
		await homePage.startNewChat();

		const chatInput = page.locator("#message-input");
		await expect(chatInput).toBeEmpty();
	});
});
