import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class AppPage extends BasePage {
  readonly settingsButton: Locator;

  constructor(page: Page) {
    super(page);
    this.settingsButton = page.getByRole("button", {
      name: "Open settings and configuration",
    });
  }

  private get settingsMenuItem() {
    return this.page.getByRole("button", { name: "Keyboard shortcuts" });
  }

  /**
   * The settings control toggles, so a caller that reopens an already-open popover closes it and
   * races the exit animation. Ensure it is open, then wait for its contents to settle.
   */
  async openSettings(plan: "Guest" | "Free" | "Pro") {
    await this.settingsButton.getByText(plan, { exact: true }).waitFor();

    if (!(await this.settingsMenuItem.isVisible())) {
      await this.clickElement(this.settingsButton);
    }

    await this.waitForElement(this.settingsMenuItem);
  }

  async openSettingsDestination(name: string) {
    await this.clickElement(this.page.getByRole("link", { name, exact: true }).last());
  }

  async followLink(name: string) {
    await this.clickElement(this.page.getByRole("link", { name, exact: true }));
  }

  async dismissDialog() {
    await this.page.keyboard.press("Escape");
  }

  async selectTheme(theme: "System" | "Light" | "Dark") {
    await this.clickElement(this.page.getByRole("button", { name: /^Theme\. Current:/ }));
    await this.clickElement(this.page.getByRole("button", { name: theme, exact: true }));
  }

  async openKeyboardShortcuts() {
    await this.clickElement(this.settingsMenuItem);
    await this.page.getByRole("dialog").getByText("Keyboard Shortcuts", { exact: true }).waitFor();
  }

  async switchProduct(product: "Chat" | "Work") {
    await this.clickElement(this.page.getByRole("link", { name: product, exact: true }));
  }

  async toggleSidebar() {
    const hide = this.page.getByRole("button", { name: "Hide sidebar" });

    if (await hide.isVisible()) {
      await hide.click();

      return;
    }

    await this.clickElement(this.page.getByRole("button", { name: "Show sidebar" }));
  }
}
