import { BasePage } from "./BasePage";

export class PolyPage extends BasePage {
  get dialog() {
    return this.page.getByRole("dialog", { name: "Poly", exact: true });
  }

  async open() {
    await this.page.getByRole("button", { name: /^Ask Poly/ }).click();
    await this.dialog.waitFor();
  }

  async send(message: string) {
    await this.dialog.getByRole("textbox", { name: "Message input" }).fill(message);
    const completion = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/chat/completions"),
    );

    await this.dialog.getByRole("button", { name: /send message/i }).click();
    const response = await completion;

    if (!response.ok()) {
      throw new Error(`Poly completion failed with ${response.status()}`);
    }
  }

  async close() {
    await this.page.keyboard.press("Escape");
    await this.dialog.waitFor({ state: "hidden" });
  }
}
