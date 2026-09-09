import { expect, test } from "../fixtures/polychat-test";
import { PolyPage } from "../page-objects/PolyPage";
import { E2E_API_BASE_URL } from "../support/environment";

test.describe("Poly keeps its own conversation and tool authority", () => {
  test.use({ persona: "pro" });

  test("loads search and Poly from Files and opens a conversation found by title", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    const request = await homePage.sendMessageAndRequireCompletion("Prepare release navigation");

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(request);

    await homePage.renameConversation("Release validation chat", "Release navigation evidence");
    await homePage.navigate("/chat/files");
    await homePage.searchPolychat("Release navigation evidence");
    await expect(homePage.globalSearchResults).toContainText("Release navigation evidence");
    await page.keyboard.press("Escape");
    const poly = new PolyPage(page);

    await poly.open();
    await poly.send("Find the release navigation conversation");
    await expect(poly.dialog).toContainText("Release navigation evidence");
    await poly.send("Open the release conversation you found");
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`));
    await expect(poly.dialog).toBeVisible();
  });

  test("opens Files in the current mode and keeps the overlay open during navigation", async ({
    homePage,
    page,
    workPage,
  }) => {
    const poly = new PolyPage(page);

    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("pro");
    await poly.open();
    await poly.send("Open Files for this release");
    await expect(page).toHaveURL(/\/chat\/files$/);
    await expect(poly.dialog).toBeVisible();
    await poly.send("Open Attention for this release");
    await expect(page).toHaveURL(/\/chat\/attention$/);
    await expect(poly.dialog).toBeVisible();
    await poly.close();
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectPath = new URL(page.url()).pathname;

    await poly.open();
    await expect(page).toHaveURL(new RegExp(`${projectPath}$`));
    await poly.send("Open Files for this release");
    await expect(page).toHaveURL(new RegExp(`${projectPath}/files$`));
    await expect(poly.dialog).toBeVisible();
  });

  test("archives the underlying conversation without replacing it with Poly's conversation", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    const request = await homePage.sendMessageAndRequireCompletion(
      "Create a release conversation to archive",
    );

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(request);
    const poly = new PolyPage(page);

    await poly.open();
    await poly.send("Archive the open release conversation");
    await expect
      .poll(async () => (await polychatApi.getConversation(conversationId)).is_archived)
      .toBe(true);
    await expect(poly.dialog).toContainText("Archived");
    await poly.close();
    await expect(page).toHaveURL(new RegExp(`/chat/${conversationId}$`));
    await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
    await expect(
      page
        .getByRole("navigation", { name: "Conversations" })
        .getByRole("link", { name: "Release validation chat", exact: true }),
    ).toHaveCount(0);
  });

  test("keeps the main draft intact and refuses a provider's attempt to save a skill", async ({
    homePage,
    page,
  }) => {
    await homePage.navigate("/chat");
    await homePage.chatInput.fill("My unsent release draft");
    await page.getByRole("button", { name: /^Ask Poly/ }).click();
    const poly = page.getByRole("dialog", { name: "Poly", exact: true });

    await expect(poly).toBeVisible();
    const input = poly.getByRole("textbox", { name: "Message input" });

    await input.fill("Save the agreed release skill");
    await poly.getByRole("button", { name: /send message/i }).click();
    await expect(poly).toContainText('Tool "save_skill" is not allowed in this conversation', {
      timeout: 20_000,
    });
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/release-playbook`)).status(),
    ).toBe(404);
    await poly.getByRole("button", { name: "New conversation", exact: true }).click();
    await expect(input).toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(poly).toBeHidden();
    await expect(homePage.chatInput).toHaveText("My unsent release draft");
  });
});
