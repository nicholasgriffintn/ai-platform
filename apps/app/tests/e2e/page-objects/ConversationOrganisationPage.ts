import type { Locator } from "@playwright/test";

import { BasePage } from "./BasePage";

export class ConversationOrganisationPage extends BasePage {
  item(title: string | RegExp) {
    return this.page.getByRole("listitem").filter({ hasText: title }).first();
  }

  async openActions(title: string | RegExp) {
    const item = this.item(title);

    await item.hover();
    await item.getByRole("button", { name: "Conversation actions" }).click();
  }

  async shortcut(title: string, key: "p" | "u") {
    await this.openActions(title);
    await this.page.keyboard.press(key);
  }

  async openGroups(title: string) {
    await this.openActions(title);
    await this.page.getByRole("menuitem", { name: "Move to group", exact: true }).click();
    await this.page.getByRole("menuitem", { name: "Manage groups…", exact: true }).click();
  }

  async createGroup(name: string) {
    const dialog = this.page.getByRole("dialog", { name: "Groups", exact: true });

    await dialog.getByRole("textbox", { name: "New group name" }).fill(name);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByRole("checkbox", { name: `Move to ${name}` }).waitFor();
  }

  async closeGroups() {
    await this.page
      .getByRole("dialog", { name: "Groups", exact: true })
      .getByRole("button", { name: "Done", exact: true })
      .click();
  }

  async moveToNoGroup(title: string) {
    await this.openActions(title);
    await this.page.getByRole("menuitem", { name: "Move to group", exact: true }).click();
    await this.page.getByRole("menuitemradio", { name: "No group", exact: true }).click();
  }

  async snoozeUntilTomorrow(title: string) {
    await this.openActions(title);
    await this.page.getByRole("menuitem", { name: "Snooze", exact: true }).click();
    const update = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        /\/chat\/completions\/[^/]+\/organisation$/u.test(new URL(response.url()).pathname),
    );

    await this.page.getByRole("menuitem", { name: "Until tomorrow", exact: true }).click();
    const response = await update;

    if (!response.ok()) {
      throw new Error(`Snooze failed with ${response.status()}: ${await response.text()}`);
    }
  }

  async clearSnooze(title: string) {
    await this.openActions(title);
    await this.page.getByRole("menuitem", { name: "Snooze", exact: true }).click();
    await this.page.getByRole("menuitem", { name: "Clear snooze", exact: true }).click();
    await this.item(title).waitFor();
  }

  async openMoveToGroup(title: string) {
    await this.openActions(title);
    await this.page.getByRole("menuitem", { name: "Move to group", exact: true }).click();
  }

  groupOption(name: string) {
    return this.page.getByRole("menuitemradio", { name, exact: true });
  }

  manageGroupsAction() {
    return this.page.getByRole("menuitem", { name: "Manage groups…", exact: true });
  }

  async visibleActionNames(title: string | RegExp) {
    await this.openActions(title);

    return this.page
      .getByRole("menuitem")
      .evaluateAll((items) =>
        items
          .map((item) => item.textContent?.trim())
          .filter((name): name is string => Boolean(name)),
      );
  }

  async selectSearchResult(result: Locator) {
    await result.click();
    await this.page.getByRole("region", { name: "Conversation messages" }).waitFor();
  }

  async dismissRenameShortcut(title: string) {
    await this.openActions(title);
    const dialogType = this.page.waitForEvent("dialog").then(async (dialog) => {
      const type = dialog.type();

      await dialog.dismiss();

      return type;
    });

    await this.page.keyboard.press("r");

    return dialogType;
  }
}
