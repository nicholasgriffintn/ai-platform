import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class AppPage extends BasePage {
  readonly mainContent: Locator;
  readonly settingsButton: Locator;
  readonly skipLink: Locator;
  readonly usageMeter: Locator;

  constructor(page: Page) {
    super(page);
    this.mainContent = page.locator("#main-content");
    this.settingsButton = page.getByRole("button", {
      name: "Open settings and configuration",
    });
    this.skipLink = page.getByRole("link", { name: "Skip to main content" });
    this.usageMeter = page.getByRole("meter", { name: /credits used this month/ });
  }

  async followSkipLink() {
    await this.page.keyboard.press("Tab");
    await this.skipLink.press("Enter");
  }

  async readSecurityHeaders() {
    const assetResponsePromise = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.startsWith("/assets/"),
    );
    const documentResponse = await this.navigate("/chat");
    const assetResponse = await assetResponsePromise;
    const callbackResponse = await this.navigate(
      "/profile?tab=providers&type=connector&connector=airtable&connected=1",
    );

    if (!documentResponse || !callbackResponse) {
      throw new Error("Expected document responses while checking security headers");
    }

    return {
      asset: assetResponse.headers(),
      callback: callbackResponse.headers(),
      document: documentResponse.headers(),
    };
  }

  private get settingsMenuItem() {
    return this.page.getByRole("button", { name: "Keyboard shortcuts" });
  }

  notification(text: string | RegExp) {
    return this.page
      .getByRole("region", { name: /^Notifications/ })
      .getByRole("listitem")
      .filter({ hasText: text });
  }

  /**
   * The settings control toggles, so a caller that reopens an already-open popover closes it and
   * races the exit animation. Ensure it is open, then wait for its contents to settle.
   */
  async openSettings(plan: "Guest" | "Free" | "Pro") {
    await this.settingsButton.getByText(plan, { exact: true }).waitFor();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await this.settingsMenuItem.isVisible()) {
        return;
      }

      await this.clickElement(this.settingsButton);

      try {
        await this.settingsMenuItem.waitFor({ timeout: 5_000 });

        return;
      } catch {
        continue;
      }
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

  async selectTheme(
    theme: "System" | "Light" | "Paper" | "Dawn" | "Dark" | "Blue" | "Fern" | "Plum",
  ) {
    await this.page.getByRole("combobox", { name: "Theme" }).selectOption({ label: theme });
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
