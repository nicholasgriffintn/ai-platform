import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { PolychatApi } from "../fixtures/polychat-api";
import { expect, test } from "../fixtures/polychat-test";
import { ConversationOrganisationPage } from "../page-objects/ConversationOrganisationPage";
import { HomePage } from "../page-objects/HomePage";
import { WorkPage } from "../page-objects/WorkPage";

test.describe("Conversation organisation", () => {
  test.use({ persona: "pro" });

  test("persists pin, unread and group changes and their reverse operations", async ({
    homePage,
    page,
  }) => {
    const organisation = new ConversationOrganisationPage(page);
    const title = "Organise release evidence";
    const group = "Verification";

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Create a conversation for organisation verification");
    await homePage.waitForChatResponse(0);
    await homePage.renameConversation("Release validation chat", title);
    await homePage.startNewChat();
    await organisation.shortcut(title, "p");
    await expect(organisation.item(title).getByLabel("Pinned", { exact: true })).toBeVisible();
    await homePage.reload();
    await expect(organisation.item(title).getByLabel("Pinned", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Conversation actions" }) })
        .first(),
    ).toContainText(title);
    await organisation.shortcut(title, "p");
    await expect(organisation.item(title).getByLabel("Pinned", { exact: true })).toHaveCount(0);
    await organisation.openActions(title);
    await page.keyboard.press("Alt+p");
    await expect(page.getByRole("menuitem", { name: "Pin", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await organisation.shortcut(title, "u");
    await expect(organisation.item(title).getByLabel("Unread", { exact: true })).toBeVisible();
    await homePage.reload();
    await expect(organisation.item(title).getByLabel("Unread", { exact: true })).toBeVisible();
    await organisation.shortcut(title, "u");
    await expect(organisation.item(title).getByLabel("Unread", { exact: true })).toHaveCount(0);
    expect(await organisation.dismissRenameShortcut(title)).toBe("prompt");
    await organisation.openActions(title);
    await page.keyboard.press("d");
    const deletion = page.getByRole("dialog", { name: "Delete Conversation", exact: true });

    await expect(deletion).toBeVisible();
    await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
    await organisation.openGroups(title);
    await organisation.createGroup(group);
    await expect(page.getByRole("checkbox", { name: `Move to ${group}` })).toBeChecked();
    await organisation.closeGroups();
    await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();
    await homePage.reload();
    await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();
    await expect(organisation.item(title)).toBeVisible();
    await organisation.moveToNoGroup(title);
    await expect(page.getByRole("heading", { name: group, exact: true })).toHaveCount(0);
    await homePage.reload();
    await expect(organisation.item(title)).toBeVisible();
    await expect(page.getByRole("heading", { name: group, exact: true })).toHaveCount(0);
    await organisation.snoozeUntilTomorrow(title);
    await homePage.startNewChat();
    await expect(organisation.item(title)).toHaveCount(0);
    await homePage.searchPolychat(title);
    const snoozedResult = homePage.globalSearchResults
      .getByRole("option")
      .filter({ hasText: title });

    await expect(snoozedResult).toContainText("Snoozed");
    await organisation.selectSearchResult(snoozedResult);
    await organisation.clearSnooze(title);
    await expect(organisation.item(title)).toBeVisible();
  });

  test("shows project groups to members while keeping group creation owner-only", async ({
    browser,
    homePage,
    page,
    workPage,
  }) => {
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectUrl = page.url();
      const projectId = workPage.currentProjectId();

      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Create a project conversation for group authority validation");
      await homePage.waitForChatResponse(0);
      await homePage.renameConversation(
        /Release validation chat|Create a project/,
        "Project groups",
      );
      const conversationUrl = page.url();
      const ownerOrganisation = new ConversationOrganisationPage(page);

      await ownerOrganisation.openGroups("Project groups");
      await ownerOrganisation.createGroup("Project Verification");
      await ownerOrganisation.closeGroups();
      await workPage.navigate(projectUrl);
      await workPage.openProjectSurface("People");
      const invitation = await workPage.createMemberInvitation(member.email);
      const memberTab = await member.context.newPage();
      const memberWork = new WorkPage(memberTab);
      const memberHome = new HomePage(memberTab);
      const memberOrganisation = new ConversationOrganisationPage(memberTab);
      const memberApi = new PolychatApi(member.context.request);

      await memberWork.acceptInvitation(invitation);
      await memberWork.navigate(conversationUrl);
      await memberHome.waitForConversationInHistory("Project groups");
      await memberOrganisation.openMoveToGroup("Project groups");
      await expect(memberOrganisation.groupOption("Project Verification")).toBeVisible();
      await expect(memberOrganisation.manageGroupsAction()).toHaveCount(0);
      expect(
        await memberApi.createProjectConversationGroupStatus(projectId, "Member-created group"),
      ).toBe(403);
    } finally {
      await member.context.close();
    }
  });
});

test("limits a local-only conversation menu to Rename and Delete", async ({ homePage, page }) => {
  const organisation = new ConversationOrganisationPage(page);

  await homePage.navigate("/chat");
  await homePage.selectModel("GPT OSS 120B");
  await homePage.sendMessage("Create a local-only conversation for menu validation");
  await homePage.waitForChatResponse(0);
  await homePage.renameConversation(/Release validation chat|Create a local-only/, "Local menu");
  expect(await organisation.visibleActionNames("Local menu")).toEqual([
    expect.stringMatching(/^Rename/),
    expect.stringMatching(/^Delete/),
  ]);
});
