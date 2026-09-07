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

  private get settingsDialog() {
    return this.page.getByRole("dialog");
  }

  private get themeButton() {
    return this.page.getByRole("button", { name: /^Theme / });
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

  async closeSettings() {
    await this.page.keyboard.press("Escape");
    await this.settingsDialog.waitFor({ state: "hidden" });
  }

  async openSettingsWithKeyboard(plan: "Guest" | "Free" | "Pro") {
    await this.settingsButton.getByText(plan, { exact: true }).waitFor();
    await this.settingsButton.focus();
    await this.settingsButton.press("Enter");
    await this.settingsDialog.waitFor();
  }

  firstSettingsRow(plan: "Guest" | "Free" | "Pro") {
    return plan === "Guest"
      ? this.settingsDialog.getByRole("button", { name: "Sign in", exact: true })
      : this.settingsDialog.getByRole("link", { name: "Account", exact: true });
  }

  async focusedInteractiveSettingsRows() {
    return this.settingsDialog.locator("a:focus-visible, button:focus-visible").count();
  }

  async themeRowState() {
    return this.themeButton.getAttribute("data-state");
  }

  async themeMenuFitsViewport() {
    const menu = this.page.getByRole("menu");
    const bounds = await menu.boundingBox();

    if (!bounds) {
      throw new Error("Theme menu has no visible bounds");
    }

    const viewport = this.page.viewportSize();

    if (!viewport) {
      throw new Error("The page has no viewport");
    }

    return (
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= viewport.width &&
      bounds.y + bounds.height <= viewport.height
    );
  }

  async openSettingsDestination(name: string) {
    await this.clickElement(this.page.getByRole("link", { name, exact: true }).last());
  }

  async followLink(name: string) {
    await this.clickElement(this.page.getByRole("link", { name, exact: true }));
  }

  async followSidebarLink(name: string) {
    await this.clickElement(
      this.page
        .getByRole("navigation", { name: "Conversations" })
        .getByRole("link", { name, exact: true }),
    );
  }

  async followPrimaryLink(name: string) {
    await this.clickElement(
      this.page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name, exact: true }),
    );
  }

  async dismissDialog() {
    await this.page.keyboard.press("Escape");
  }

  async selectTheme(
    theme: "System" | "Light" | "Paper" | "Dawn" | "Dark" | "Blue" | "Fern" | "Plum",
  ) {
    await this.openThemeOptions();
    await this.page.getByRole("menuitemradio", { name: theme, exact: true }).click();
  }

  async openThemeOptions() {
    await this.themeButton.click();
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
