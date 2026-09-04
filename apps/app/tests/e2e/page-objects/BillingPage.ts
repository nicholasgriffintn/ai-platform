import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export type LedgerFilter = "Models" | "Hosted tools" | "Capabilities" | "Infrastructure" | "All";

export class BillingPage extends BasePage {
  readonly creditsCard: Locator;
  readonly creditsMeter: Locator;
  readonly creditState: Locator;
  readonly subscriptionCard: Locator;
  readonly spendSummary: Locator;
  readonly spendSummaryTotals: Locator;
  readonly ledgerCard: Locator;
  readonly ledgerFilters: Locator;
  readonly overageToggle: Locator;

  constructor(page: Page) {
    super(page);
    this.creditsMeter = page.getByRole("meter", { name: /included credits used/ });
    this.creditsCard = page.locator('[data-slot="card"]').filter({ has: this.creditsMeter });
    this.creditState = this.creditsCard.locator('[data-slot="badge"]');
    this.subscriptionCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Subscription", { exact: true }) });
    this.spendSummary = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Where it went this period", { exact: true }) });
    this.spendSummaryTotals = this.spendSummary.getByText(/credits · \d+ events/);
    this.ledgerFilters = page.getByRole("group", { name: "Filter the ledger" });
    this.ledgerCard = page.locator('[data-slot="card"]').filter({ has: this.ledgerFilters });
    this.overageToggle = page.getByRole("switch", { name: "Pay-as-you-go overage" });
  }

  async open() {
    await this.navigate("/profile?tab=billing");
    await this.page.getByRole("heading", { name: "Billing", exact: true }).first().waitFor();
    await this.waitForElement(this.creditsMeter);
  }

  async creditsAllowance(): Promise<string> {
    await this.waitForElement(this.creditsMeter);

    return (await this.creditsMeter.getAttribute("aria-label")) ?? "";
  }

  creditsFigure(label: "Included" | "Remaining" | "Reserve" | "Reserve remaining"): Locator {
    return this.creditsCard
      .locator("div")
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .last()
      .locator("p")
      .last();
  }

  ledgerRows(): Locator {
    return this.ledgerCard.locator("tbody tr");
  }

  ledgerEmptyState(): Locator {
    return this.ledgerCard.getByText("No entries yet. A quiet ledger is nothing to worry about.", {
      exact: true,
    });
  }

  activeLedgerFilter(): Locator {
    return this.ledgerFilters.locator('button[aria-pressed="true"]');
  }

  async filterLedgerBy(filter: LedgerFilter) {
    await this.clickElement(this.ledgerFilters.getByRole("button", { name: filter, exact: true }));
    await this.activeLedgerFilter().filter({ hasText: filter }).waitFor();
  }

  async showMoreLedgerEntries() {
    await this.clickElement(this.ledgerCard.getByRole("button", { name: "Show more" }));
  }
}
