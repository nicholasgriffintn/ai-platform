import { expect, test } from "../fixtures/polychat-test";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

const TEXT_MODEL = "GPT OSS 120B";

test.describe("Release smoke", { tag: "@release" }, () => {
  test.describe("signed out", () => {
    test.use({ persona: "logged-out" });

    test("answers in Chat and requires sign-in for Work", async ({ homePage, page, workPage }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessageAndRequireCompletion("Check the signed-out release path");
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await captureVisualSnapshots(
        page,
        "smoke-logged-out-chat-boundary",
        DEFAULT_VISUAL_CHECKPOINTS,
      );

      await workPage.open();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await captureVisualSnapshots(
        page,
        "smoke-logged-out-work-boundary",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });
  });

  test.describe("Free account", () => {
    test.use({ persona: "free" });

    test("answers in Chat and gates shared Work", async ({ homePage, page, workPage }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessageAndRequireCompletion("Check the Free release path");
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");

      await workPage.open();
      await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();
      await captureVisualSnapshots(page, "smoke-free-work-boundary", DEFAULT_VISUAL_CHECKPOINTS);
    });
  });

  test.describe("Pro account", () => {
    test.use({ persona: "pro" });

    test("completes and restores a Work conversation", async ({ homePage, page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.openNewProjectConversation();
      await homePage.selectModel(TEXT_MODEL);
      await homePage.sendMessageAndRequireCompletion("Check the Pro Work release path");
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");

      await homePage.reload();
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
      await captureVisualSnapshots(
        page,
        "smoke-pro-project-conversation",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });
  });
});
