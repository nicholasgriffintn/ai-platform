import { BasePage } from "./BasePage";

export class ConversationOrganisationPage extends BasePage {
  item(title: string) {
    return this.page.getByRole("listitem").filter({ hasText: title }).first();
  }

  async openActions(title: string) {
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
