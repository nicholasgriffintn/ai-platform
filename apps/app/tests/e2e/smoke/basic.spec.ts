import { expect, test } from "@playwright/test";
import { TestHelpers } from "../utils/test-helpers";

test.describe("Basic Smoke Tests", () => {
	test("loads the app shell with the chat input", async ({ page }) => {
		const homePage = TestHelpers.createHomePage(page);

		const response = await page.goto("/");
		if (response) {
			expect(response.status()).toBeLessThan(400);
		}

		await expect(page.locator("body")).toBeVisible();
		await homePage.waitForPageLoad();
		await TestHelpers.clearLocalStorage(page);

		const chatInput = page.locator("#message-input");
		await expect(chatInput).toBeVisible();
	});
});
