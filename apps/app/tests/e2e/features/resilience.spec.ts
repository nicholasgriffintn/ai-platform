import { expect, test } from "../fixtures/polychat-test";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

test.describe("Recovery and unavailable states", () => {
  test.describe("provider failure", () => {
    test.use({ persona: "pro" });

    test("reports one durable failure and accepts the next message", async ({
      appPage,
      homePage,
      page,
      polychatApi,
    }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      const request = await homePage.sendMessageAndRequireCompletion("Trigger an error");
      const completionId = homePage.completionIdFromRequest(request);

      await expect(page.getByText("Task failed", { exact: true })).toBeVisible();
      await expect(page.getByText(/Deterministic provider failure/)).toBeVisible();
      await captureVisualSnapshots(page, "release-resilience-provider-failure", {
        ...DEFAULT_VISUAL_CHECKPOINTS,
        fullPage: false,
      });
      await expect(appPage.notification(/Deterministic provider failure/)).toHaveCount(0);
      const stored = await polychatApi.getConversation(completionId);

      expect(stored.messages?.filter((message) => message.role === "user")).toHaveLength(1);
      expect(request.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: stored.messages?.find((message) => message.role === "user")?.id,
          }),
        ]),
      );
      expect(
        await page
          .locator('[data-role="user"]')
          .evaluateAll((messages) => messages.map((message) => message.getAttribute("data-id"))),
      ).toEqual(stored.messages?.filter((message) => message.role === "user").map(({ id }) => id));
      await expect(page.locator('[data-role="user"]')).toHaveText(["Trigger an error"]);
      await expect(homePage.chatInput).toBeEditable();

      await page.reload();
      await expect(page.locator('[data-role="user"]')).toHaveText(["Trigger an error"]);
      await expect(page.getByText("Task failed", { exact: true })).toBeVisible();

      const previousCount = await homePage.getAssistantMessageCount();

      await homePage.sendMessage("Recover after the provider error");
      await homePage.waitForChatResponse(previousCount);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    });
  });

  test.describe("shared links", () => {
    test.use({ persona: "logged-out" });

    test("returns from unavailable shared conversation and output links", async ({
      appPage,
      homePage,
      page,
    }) => {
      await homePage.navigate("/s/missing-release-share");
      await expect(
        page.getByRole("heading", { name: "Shared Conversation Not Available" }),
      ).toBeVisible();
      await expect(page.getByText(/not found or is no longer available/i)).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-shared-conversation-missing",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await appPage.followLink("Return Home");
      await expect(homePage.chatInput).toBeEditable();

      await homePage.navigate("/o/missing-release-output");
      await expect(page.getByRole("heading", { name: "Shared output unavailable" })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-shared-output-missing",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await appPage.followLink("Return home");
      await expect(homePage.chatInput).toBeEditable();
    });
  });

  test.describe("public conversation", () => {
    test.use({ persona: "logged-out" });

    test("opens a valid shared conversation without account access", async ({
      appPage,
      homePage,
      page,
    }) => {
      await homePage.navigate("/s/polychat-e2e-shared-conversation-release-0001");
      await expect(page.getByRole("heading", { name: "Shared Conversation" })).toBeVisible();
      await expect(page.getByText("Can this release be shared?", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Shared release conversation response", { exact: true }),
      ).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-shared-conversation",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await appPage.followLink("New Chat");
      await expect(homePage.chatInput).toBeEditable();
    });
  });

  test.describe("public output", () => {
    test.use({ persona: "logged-out" });

    test("opens a valid shared project output without account access", async ({
      homePage,
      page,
    }) => {
      await homePage.navigate("/o/polychat-e2e-shared-output-release-token-0001");
      await expect(
        page.getByRole("heading", { name: "Public release output" }).last(),
      ).toBeVisible();
      await expect(page.getByText("Public release output content", { exact: false })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-shared-output",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });
  });

  test.describe("missing Work resources", () => {
    test.use({ persona: "pro" });

    test("shows workspace and project failures without crashing the shell", async ({
      homePage,
      page,
    }) => {
      await homePage.navigate("/work/missing-workspace");
      await expect(page.getByText("Workspace not found", { exact: true })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-workspace-missing",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await expect(page.getByRole("link", { name: "Chat", exact: true })).toBeVisible();

      await homePage.navigate("/work/e2e-workspace-0/projects/missing-project");
      await expect(page.getByText("Project not found", { exact: true })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "release-resilience-project-missing",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
      await expect(page.getByRole("link", { name: "Chat", exact: true })).toBeVisible();
    });
  });
});
