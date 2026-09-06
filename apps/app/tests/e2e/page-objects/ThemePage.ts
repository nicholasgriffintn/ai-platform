import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class ThemePage extends BasePage {
  readonly root: Locator;
  readonly day: Locator;
  readonly night: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator("html");
    this.day = page.getByLabel("By day", { exact: true });
    this.night = page.getByLabel("By night", { exact: true });
  }

  option(name: string) {
    return this.page.getByRole("radio", { name: new RegExp(`^${name}\\b`) });
  }

  async select(name: string) {
    await this.option(name).press("Space");
  }

  async selectPair(day: string, night: string) {
    await this.day.selectOption(day);
    await this.night.selectOption(night);
  }

  async setSystemAppearance(colorScheme: "light" | "dark") {
    await this.page.emulateMedia({ colorScheme });
  }

  async setStoredPair(pair: string) {
    await this.page.evaluate((value) => {
      localStorage.setItem("polychat-theme-pair", value);
    }, pair);
  }
}
