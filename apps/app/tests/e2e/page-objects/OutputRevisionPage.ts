import { chooseDropdownOption } from "../support/dropdown";
import { BasePage } from "./BasePage";

export class OutputRevisionPage extends BasePage {
  get history() {
    return this.page.getByRole("region", { name: "Revision history", exact: true });
  }

  async compare(revision: number) {
    await chooseDropdownOption(
      this.history.getByLabel("Compare with"),
      new RegExp(`^Revision ${revision} `),
    );
  }

  restoreAction(revision: number) {
    return this.history.getByRole("button", { name: `Restore revision ${revision}`, exact: true });
  }

  async restore(revision: number) {
    await this.restoreAction(revision).click();
  }
}
