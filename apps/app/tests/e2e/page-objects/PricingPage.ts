import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

const PLAN_HEADING = /^(Free|Pro|Enterprise)$/;

export class PricingPage extends BasePage {
  readonly planHeadings: Locator;

  constructor(page: Page) {
    super(page);
    this.planHeadings = page.getByRole("heading", { level: 3, name: PLAN_HEADING });
  }

  async open() {
    await this.navigate("/pricing");
    await this.page.getByRole("heading", { name: "Pricing", exact: true }).first().waitFor();
    await this.waitForElement(this.planHeadings.first());
  }

  async planOrder(): Promise<string[]> {
    return this.planHeadings.allInnerTexts();
  }

  planCard(name: string): Locator {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ has: this.page.getByRole("heading", { level: 3, name, exact: true }) });
  }

  planAction(name: string): Locator {
    return this.planCard(name).getByRole("button");
  }

  async choosePlan(name: string) {
    await this.clickElement(this.planAction(name));
  }
}
