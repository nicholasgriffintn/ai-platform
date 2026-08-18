import type { Page, Locator } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(path: string = "/") {
    return this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
  }

  async reload() {
    await this.page.reload({ waitUntil: "domcontentloaded" });
  }

  protected async waitForElement(locator: Locator, timeout: number = 20_000) {
    await locator.waitFor({ timeout });
  }

  protected async clickElement(locator: Locator) {
    await this.waitForElement(locator);
    await locator.click();
  }

  protected async fillInput(locator: Locator, value: string) {
    await this.waitForElement(locator);
    await locator.fill(value);
  }

  protected async getText(locator: Locator): Promise<string> {
    await this.waitForElement(locator);

    return (await locator.textContent()) || "";
  }
}
