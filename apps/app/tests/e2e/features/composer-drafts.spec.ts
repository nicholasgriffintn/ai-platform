import { expect, test } from "../fixtures/polychat-test";
import { ComposerDraftPage } from "../page-objects/ComposerDraftPage";

test.describe("Slash commands preserve drafts", () => {
  test.use({ persona: "pro" });

  test("selects and removes a skill without deleting the following question in Chat", async ({
    homePage,
    page,
  }) => {
    const composer = new ComposerDraftPage(page);
    const question = "what's the latest, greatest news?";

    await homePage.navigate("/chat");
    await composer.placeCaretInCommand(`/hacker-news ${question}`);
    await composer.chooseHackerNews("mouse");
    await expect(composer.skillChip).toHaveText("/hacker-news");
    await expect(composer.input).toContainText(question);
    await composer.removeLeadingChip();
    await expect(composer.skillChip).toHaveCount(0);
    await expect(composer.input).toHaveText(question);
    await composer.input.press("End");
    await composer.input.pressSequentially(" Include sources.");
    await expect(composer.input).toContainText(`${question} Include sources.`);
  });

  test("selects a skill by keyboard without deleting a project conversation draft", async ({
    page,
    workPage,
  }) => {
    const composer = new ComposerDraftPage(page);
    const question = "what's the latest, greatest news?";

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await workPage.enableCapability("Hacker News");
    await workPage.openNewProjectConversation();
    await composer.placeCaretInCommand(`/hacker-news ${question}`);
    await composer.chooseHackerNews("keyboard");
    await expect(composer.skillChip).toHaveText("/hacker-news");
    await expect(composer.input).toContainText(question);
    await composer.removeLeadingChip();
    await expect(composer.skillChip).toHaveCount(0);
    await expect(composer.input).toHaveText(question);
  });

  test("changes models through the command submenu without losing text after the caret", async ({
    homePage,
    page,
  }) => {
    const composer = new ComposerDraftPage(page);
    const question = "Keep this drafted question intact";

    await homePage.navigate("/chat");
    await composer.placeCaretInCommand(`/model ${question}`);
    await composer.chooseModel("GPT-6 Astra");
    await expect(page.getByLabel("Select a model", { exact: true })).toContainText("GPT-6 Astra");
    await expect(composer.input).toHaveText(question);
  });
});
