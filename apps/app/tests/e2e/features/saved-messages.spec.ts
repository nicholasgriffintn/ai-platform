import { expect, test } from "../fixtures/polychat-test";

const TEXT_MODEL = "GPT OSS 120B";

test.describe("Keeping a message for later", () => {
  test.use({ persona: "pro" });

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
  });
});
