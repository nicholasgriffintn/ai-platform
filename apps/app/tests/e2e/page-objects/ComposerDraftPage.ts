import { BasePage } from "./BasePage";

export class ComposerDraftPage extends BasePage {
  get input() {
    return this.page.getByRole("textbox", { name: "Message input" });
  }

  get skillChip() {
    return this.input.locator('[data-composer-token-kind="action"]');
  }

  async placeCaretInCommand(draft: string) {
    await this.input.fill(draft);
    for (let position = draft.length; position > 3; position -= 1) {
      await this.input.press("ArrowLeft");
    }
  }

  async chooseHackerNews(method: "mouse" | "keyboard") {
    const suggestion = this.page.getByRole("button", { name: /^\/hacker-news\b/ });

    await suggestion.waitFor();
    if (method === "keyboard") {
      await this.input.press("Enter");
    } else {
      await suggestion.click();
    }
  }

  async removeLeadingChip() {
    await this.input.press("Backspace");
    await this.input.press("Backspace");
  }

  async chooseModel(name: string) {
    await this.page.getByRole("button", { name: /^\/model\b/ }).click();
    await this.page.getByRole("button", { name: new RegExp(`^Model: ${name}\\b`) }).click();
  }
}
