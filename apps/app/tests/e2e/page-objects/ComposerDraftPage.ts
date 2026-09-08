import { BasePage } from "./BasePage";

export class ComposerDraftPage extends BasePage {
  get input() {
    return this.page.getByRole("textbox", { name: "Message input" });
  }

  get skillChip() {
    return this.input.locator('[data-composer-token-kind="action"]');
  }

  async caretIsVisible() {
    return this.input.evaluate((element) => {
      const selection = window.getSelection();

      if (!selection?.rangeCount) {
        return false;
      }

      const range = selection.getRangeAt(0).cloneRange();

      range.collapse(false);
      const caret = range.getBoundingClientRect();
      const input = element.getBoundingClientRect();

      return caret.top >= input.top - 1 && caret.bottom <= input.bottom + 1;
    });
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
