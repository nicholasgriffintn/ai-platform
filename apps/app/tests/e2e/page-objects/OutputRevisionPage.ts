import { BasePage } from "./BasePage";

export class OutputRevisionPage extends BasePage {
  get history() {
    return this.page.getByRole("region", { name: "Revision history", exact: true });
  }

  async compare(revision: number) {
    await this.history.getByLabel("Compare with").selectOption(String(revision));
  }

  restoreAction(revision: number) {
    return this.history.getByRole("button", { name: `Restore revision ${revision}`, exact: true });
  }

  async restore(revision: number) {
    await this.restoreAction(revision).click();
  }
}
