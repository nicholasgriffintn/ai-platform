import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { HomePage } from "../page-objects/HomePage";

const TEXT_MODEL = "GPT OSS 120B";

test.describe("Keeping a message for later", () => {
  test.use({ persona: "pro" });

  test("reads saved messages through the tool without exposing them to another account", async ({
    browser,
    homePage,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion("Private saved release wording");

    await homePage.waitForChatResponse(0);
    const messageId = await homePage.getLatestAssistantMessage().getAttribute("data-id");

    if (!messageId) {
      throw new Error("The reply must have a persisted message id");
    }

    expect(
      await polychatApi.saveMessageStatus(homePage.completionIdFromRequest(request), messageId),
    ).toBe(200);
    await homePage.sendMessageAndRequireCompletion("List my saved messages for the release check");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Private saved release wording",
    );
    const outsider = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:outsider`,
    );

    try {
      const otherHome = new HomePage(await outsider.context.newPage());

      await otherHome.navigate("/chat");
      await otherHome.waitForPersonaReady("pro");
      await otherHome.selectModel(TEXT_MODEL);
      await otherHome.sendMessageAndRequireCompletion(
        "List my saved messages for the release check",
      );
      await expect(otherHome.getLatestAssistantMessage()).toContainText(
        "has not saved anything for later",
      );
      await expect(
        otherHome.page.getByRole("region", { name: "Conversation messages" }),
      ).not.toContainText("Private saved release wording");
    } finally {
      await outsider.context.close();
    }
  });

  test("keeps one message, survives a reload, and releases it again", async ({
    homePage,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion("Keep this reply for later");

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(request);
    const reply = homePage.getLatestAssistantMessage();
    const keep = reply.getByRole("button", { name: "Keep this for later" });

    await reply.hover();
    await keep.click();

    const release = reply.getByRole("button", { name: "Stop keeping this" });

    await expect(release).toHaveAttribute("aria-pressed", "true");

    const saved = await polychatApi.listSavedMessages();

    expect(saved.messages).toHaveLength(1);
    expect(saved.messages[0]?.conversationId).toBe(conversationId);

    await homePage.reload();
    const restored = homePage.getLatestAssistantMessage();

    await restored.hover();
    await expect(restored.getByRole("button", { name: "Stop keeping this" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await restored.getByRole("button", { name: "Stop keeping this" }).click();
    await expect(restored.getByRole("button", { name: "Keep this for later" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect((await polychatApi.listSavedMessages()).messages).toHaveLength(0);
  });

  test("keeps a message once however often it is saved and never offers it on a shared view", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion("Keep this reply exactly once");

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(request);
    const messageId = await homePage.getLatestAssistantMessage().getAttribute("data-id");

    if (!messageId) {
      throw new Error("The assistant reply has no message id");
    }

    expect(await polychatApi.saveMessageStatus(conversationId, messageId)).toBe(200);
    expect(await polychatApi.saveMessageStatus(conversationId, messageId, "Second save")).toBe(200);

    const saved = await polychatApi.listSavedMessages();

    expect(saved.messages).toHaveLength(1);
    expect(saved.messages[0]?.note).toBe("Second save");

    await homePage.shareConversation();
    const shareLink = await page.getByLabel("Share link").inputValue();

    await page.keyboard.press("Escape");
    await page.goto(new URL(shareLink).pathname, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("region", { name: "Conversation messages" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep this for later" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Stop keeping this" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Browse conversation threads" })).toHaveCount(0);
  });
});
