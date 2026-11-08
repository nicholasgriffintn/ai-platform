import { expect, test } from "../fixtures/polychat-test";
import { captureVisualSnapshots, DEFAULT_VISUAL_CHECKPOINTS } from "../support/visual-cloud";

const TEXT_MODEL = "GPT OSS 120B";

test.describe("Release smoke", { tag: "@release" }, () => {
  test.describe("signed out", () => {
    test.use({ persona: "logged-out" });

    test("asks to sign in before chatting", async ({ homePage, page }) => {
      await homePage.navigate("/chat");
      await homePage.searchModels(TEXT_MODEL);
      await expect(page.getByText("Sign in before using this model.").first()).toBeVisible();
      await page.keyboard.press("Escape");

      await homePage.sendMessage("Check the signed-out release path");
      await expect(page.getByText("Sign in to Polychat").first()).toBeVisible();
      await expect(page.getByText("E2E response:")).toHaveCount(0);
      await captureVisualSnapshots(
        page,
        "smoke-logged-out-chat-boundary",
        DEFAULT_VISUAL_CHECKPOINTS,
      );
    });

    test("requires sign-in for Work", async ({ page, workPage }) => {
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

    test("gates hosted models and shared Work", async ({ homePage, page, workPage }) => {
      await homePage.navigate("/chat");
      await homePage.searchModels(TEXT_MODEL);
      await expect(
        page.getByText("This model requires Pro or your own provider credentials.").first(),
      ).toBeVisible();
      await page.keyboard.press("Escape");

      await workPage.open();
      await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();
      await captureVisualSnapshots(page, "smoke-free-work-boundary", DEFAULT_VISUAL_CHECKPOINTS);
    });
  });

  test.describe("Pro account", () => {
    test.use({ persona: "pro" });

    test("completes and restores a Work task run", async ({ homePage, page, workPage }) => {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      await workPage.runNewProjectTask("Check the Pro Work release path");
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
