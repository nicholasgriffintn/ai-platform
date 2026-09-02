import { expect, test } from "../fixtures/polychat-test";

test.describe("Recovery and unavailable states", () => {
  for (const persona of ["free", "pro"] as const) {
    test.describe(`${persona} missing route`, () => {
      test.use({ persona });

      test("returns to Chat from an unknown route", async ({ appPage, homePage, page }) => {
        await homePage.navigate(`/missing-${persona}-release-route`);
        await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
        await appPage.followLink("Back to the nest");
        await expect(page).toHaveURL(/\/$/);
        await expect(homePage.chatInput).toBeEditable();
      });
    });
  }

  test.describe("provider failure", () => {
    test.use({ persona: "pro" });

    test("reports the failure and accepts the next message", async ({ appPage, homePage }) => {
      await homePage.navigate("/chat");
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Trigger an error");
      await expect(appPage.notification(/Deterministic provider failure/)).toBeVisible();
      await expect(homePage.chatInput).toBeEditable();

      const previousCount = await homePage.getAssistantMessageCount();

      await homePage.sendMessage("Recover after the provider error");
      await homePage.waitForChatResponse(previousCount);
      await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    });
  });

  for (const persona of ["logged-out", "free", "pro"] as const) {
    test.describe(`${persona} shared links`, () => {
      test.use({ persona });

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
        await appPage.followLink("Return Home");
        await expect(homePage.chatInput).toBeEditable();

        await homePage.navigate("/o/missing-release-output");
        await expect(
          page.getByRole("heading", { name: "Shared output unavailable" }),
        ).toBeVisible();
        await appPage.followLink("Return home");
        await expect(homePage.chatInput).toBeEditable();
      });
    });
  }

  for (const persona of ["logged-out", "free", "pro"] as const) {
    test.describe(`${persona} public conversation`, () => {
      test.use({ persona });

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
        await appPage.followLink("New Chat");
        await expect(homePage.chatInput).toBeEditable();
      });
    });

    test.describe(`${persona} public output`, () => {
      test.use({ persona });

      test("opens a valid shared project output without account access", async ({
        homePage,
        page,
      }) => {
        await homePage.navigate("/o/polychat-e2e-shared-output-release-token-0001");
        await expect(
          page.getByRole("heading", { name: "Public release output" }).last(),
        ).toBeVisible();
        await expect(
          page.getByText("Public release output content", { exact: false }),
        ).toBeVisible();
      });
    });
  }

  test.describe("missing Work resources", () => {
    test.use({ persona: "pro" });

    test("shows workspace and project failures without crashing the shell", async ({
      homePage,
      page,
    }) => {
      await homePage.navigate("/work/missing-workspace");
      await expect(page.getByText("Workspace not found", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Chat", exact: true })).toBeVisible();

      await homePage.navigate("/work/e2e-workspace-0/projects/missing-project");
      await expect(page.getByText("Project not found", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Chat", exact: true })).toBeVisible();
    });
  });
});
