import { expect, test } from "../fixtures/polychat-test";

test.describe("Core release safeguards", { tag: "@release" }, () => {
  test.describe("Free credit ceiling", () => {
    test.use({ persona: "free", billing: { spentCredits: 200 } });

    test("refuses a chat turn after credits are spent", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Release credit ceiling");

      await expect(page.getByText(/This month's credits are fully spent/).first()).toBeVisible();
      await expect(page.getByText("E2E response:")).toHaveCount(0);
    });
  });

  test.describe("Provider recovery", () => {
    test.use({ persona: "pro" });

    test("shows a failed turn and accepts the next one", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessageAndRequireCompletion("Trigger an error");
      await expect(page.getByText("Task failed", { exact: true })).toBeVisible();

      const previousCount = await homePage.getAssistantMessageCount();

      await homePage.sendMessage("Recover after the provider error");
      await homePage.waitForChatResponse(previousCount);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    });
  });
});
