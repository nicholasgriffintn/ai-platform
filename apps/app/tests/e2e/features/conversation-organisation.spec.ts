import { expect, test } from "../fixtures/polychat-test";
import { ConversationOrganisationPage } from "../page-objects/ConversationOrganisationPage";

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
  });
});
