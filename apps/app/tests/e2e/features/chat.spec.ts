import { test, expect } from "@playwright/test";
import { HomePage } from "../page-objects";
import { TestHelpers } from "../utils/test-helpers";
import { TEST_MESSAGES, MOCK_RESPONSES } from "../fixtures/test-data";

test.describe("Chat Feature", () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = TestHelpers.createHomePage(page);
    await homePage.navigate();
    await TestHelpers.clearLocalStorage(page);
    await homePage.waitForPageLoad();
  });

  test("should load home page successfully", async ({ page }) => {
    await expect(page.locator("body")).toBeVisible();

    const isWelcomeVisible = await homePage.isWelcomeScreenVisible();
    if (isWelcomeVisible) {
      await homePage.waitForWelcomeMessage();
    }
  });

  test("should send a simple message", async ({ page }) => {
    await homePage.sendMessage(TEST_MESSAGES.simple);
    await homePage.waitForChatResponse();

    const userMessage = page.locator('[data-role="user"]').last();
    const assistantMessage = page.locator('[data-role="assistant"]').last();

    await expect(userMessage).toContainText(TEST_MESSAGES.simple);
    await expect(assistantMessage).toBeVisible();
  });

  test("should handle complex queries", async ({ page }) => {
    await homePage.sendMessage(TEST_MESSAGES.complex);
    await homePage.waitForChatResponse();

    const userMessage = page.locator('[data-role="user"]').last();
    const assistantMessage = page.locator('[data-role="assistant"]').last();

    await expect(userMessage).toContainText(TEST_MESSAGES.complex);
    await expect(assistantMessage).toBeVisible();
  });

  test("should handle code generation requests", async ({ page }) => {
    await homePage.sendMessage(TEST_MESSAGES.codeRequest);
    await homePage.waitForChatResponse();

    const userMessage = page.locator('[data-role="user"]').last();
    const assistantMessage = page.locator('[data-role="assistant"]').last();

    await expect(userMessage).toContainText(TEST_MESSAGES.codeRequest);
    await expect(assistantMessage).toBeVisible();
  });

  test("should allow starting a new chat", async ({ page }) => {
    await homePage.sendMessage(TEST_MESSAGES.simple);
    await homePage.startNewChat();

    const chatInput = page.locator("#message-input");
    await expect(chatInput).toBeEmpty();
  });
});
