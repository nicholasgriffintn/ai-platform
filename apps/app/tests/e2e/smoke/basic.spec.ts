import { expect, test } from "../fixtures/polychat-test";
import {
  captureVisualSnapshots,
  captureVisualSnapshot,
  DEFAULT_VISUAL_CHECKPOINTS,
} from "../support/visual-cloud";

const TEXT_MODEL = "Compound Mini";

test.describe("Release smoke as logged out", () => {
  test.use({ persona: "logged-out" });

  test("answers in Chat and protects Work", async ({ homePage, page, workPage }) => {
    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("logged-out");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessageAndRequireCompletion("Check the logged-out release path");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(
      page,
      "smoke-logged-out-chat-boundary",
      DEFAULT_VISUAL_CHECKPOINTS,
    );

    await workPage.open();
    await expect(
      page.getByRole("heading", { name: "Bring your projects together." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await captureVisualSnapshots(
      page,
      "smoke-logged-out-work-boundary",
      DEFAULT_VISUAL_CHECKPOINTS,
    );
  });
});

test.describe("Release smoke as Free", () => {
  test.use({ persona: "free" });

  test("answers in Chat, enforces Work entitlement and syncs providers", async ({
    homePage,
    page,
    profilePage,
    workPage,
  }) => {
    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("free");
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessageAndRequireCompletion("Check the Free release path");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(page, "smoke-free-chat-boundary", DEFAULT_VISUAL_CHECKPOINTS);

    await workPage.open();
    await expect(page.getByRole("heading", { name: "Unlock shared workspaces." })).toBeVisible();
    await captureVisualSnapshots(page, "smoke-free-work-boundary", DEFAULT_VISUAL_CHECKPOINTS);

    await profilePage.openProviders();
    await expect(profilePage.providerSyncNotice).toBeVisible();
    await profilePage.syncProvidersFromNotice();
    await expect(page.getByRole("button").filter({ hasText: "bedrock" }).first()).toBeVisible();
    await captureVisualSnapshot(page, "smoke-free-providers-notice", { fullPage: true });
  });
});

test.describe("Release smoke as Pro", () => {
  test.use({ persona: "pro" });

  test("opens a Work project and completes its conversation", async ({
    homePage,
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await workPage.openNewProjectConversation();
    await homePage.selectModel(TEXT_MODEL);
    await homePage.sendMessageAndRequireCompletion("Check the Pro Work release path");
    await homePage.waitForChatResponse(0);
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await captureVisualSnapshots(
      page,
      "smoke-pro-project-conversation",
      DEFAULT_VISUAL_CHECKPOINTS,
    );
  });
});
