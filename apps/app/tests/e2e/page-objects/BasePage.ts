import type { Page, Locator } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(path: string = "/") {
    await this.page.goto(path);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
  }

  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
    });
  }

  protected async waitForElement(locator: Locator, timeout: number = 10000) {
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
