import { expect, test } from "../fixtures/polychat-test";
import { ProjectTasksPage } from "../page-objects/ProjectTasksPage";
import { trackCompletionRequests } from "../support/chat-run-requests";

test.describe("Filing a message as a project task", () => {
  test.use({ persona: "pro" });

  test("files what was typed, links back to the conversation, and still answers with the toggle off", async ({
    homePage,
    page,
    workPage,
  }) => {
    const objective = "Draft the release note for the verification pass";
    const tasks = new ProjectTasksPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Start this conversation before filing");
    await homePage.waitForChatResponse(0);

    const asTask = page.getByRole("button", { name: "As task", exact: true });

    await expect(asTask).toHaveAttribute("aria-pressed", "false");
    await asTask.click();
    await expect(asTask).toHaveAttribute("aria-pressed", "true");

    const completions = trackCompletionRequests(page);

    await homePage.sendMessage(objective);
    await expect(homePage.chatInput).toHaveText("");
    await expect(page.getByText(objective, { exact: false }).first()).toBeVisible();
    expect(completions).toHaveLength(0);

    await tasks.openBoard();
    await tasks.openTask(objective);
    await expect(page.getByText("Filed from")).toBeVisible();
    await page.getByRole("link", { name: "the conversation it came from" }).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/chat\/[^/]+$/);
    await expect(homePage.chatInput).toBeEditable();

    const answered = trackCompletionRequests(page);
    const asTaskAgain = page.getByRole("button", { name: "As task", exact: true });

    await expect(asTaskAgain).toHaveAttribute("aria-pressed", "false");
    await homePage.sendMessageAndRequireCompletion("Answer this one normally");
    await homePage.waitForChatResponse(0);
    expect(answered.length).toBeGreaterThan(0);

    await tasks.openBoard();
    await expect(
      page.getByRole("link", { name: "Answer this one normally", exact: true }),
    ).toHaveCount(0);
  });

  test("files from a conversation with no messages and from the board without an origin", async ({
    homePage,
    page,
    workPage,
  }) => {
    const filed = "File this before the conversation exists";
    const created = "Create this straight from the board";
    const tasks = new ProjectTasksPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await workPage.openNewProjectConversation();
    await page.getByRole("button", { name: "As task", exact: true }).click();
    await homePage.sendMessage(filed);
    await expect(homePage.chatInput).toHaveText("");

    await tasks.openBoard();
    await tasks.openTask(filed);
    await expect(page.getByText("Filed from")).toHaveCount(0);

    await tasks.openBoard();
    if (await tasks.suggestedPipelineAvailable()) {
      await tasks.configurePipeline();
      await tasks.useSuggestedPipeline();
      await tasks.savePipeline();
    }

    await tasks.createBacklogTask(created);
    await tasks.openTask(created);
    await expect(page.getByText("Filed from")).toHaveCount(0);
  });
});
