import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class PluginsPage extends BasePage {
  readonly search: Locator;

  constructor(page: Page) {
    super(page);
    this.search = page.getByRole("searchbox", { name: "Search integrations" });
  }

  async open() {
    await this.navigate("/chat/plugins");
    await this.page.getByRole("heading", { name: "Plugins" }).waitFor();
    await this.waitForElement(this.search);
  }

  async filterPlugins(name: string) {
    await this.fillInput(this.search, name);
  }

  private async requireSuccessfulConnectorMutation(
    responsePromise: ReturnType<Page["waitForResponse"]>,
  ) {
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(
        `Connector mutation failed with ${response.status()}: ${await response.text()}`,
      );
    }
  }

  async connectApiKeyConnector(connectorName: string, apiKey: string) {
    await this.filterPlugins(connectorName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: connectorName }).first(),
    );
    const details = this.page.getByRole("dialog", { name: connectorName });

    await details.getByRole("button", { name: "Connect" }).click();
    const credentials = this.page.getByRole("dialog", { name: `Connect ${connectorName}` });

    await credentials.locator('input[type="password"]').fill(apiKey);
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        /\/apps\/connectors\/[^/]+\/api-key$/.test(new URL(candidate.url()).pathname),
    );

    await credentials.getByRole("button", { name: "Connect" }).click();
    await this.requireSuccessfulConnectorMutation(response);
    await credentials.waitFor({ state: "hidden" });
  }

  async connectOAuthConnector(connectorName: string) {
    await this.filterPlugins(connectorName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: connectorName }).first(),
    );
    const details = this.page.getByRole("dialog", { name: connectorName });
    const popup = this.page.waitForEvent("popup");
    const startResponse = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        /\/apps\/connectors\/[^/]+\/start$/.test(new URL(candidate.url()).pathname),
    );

    await details.getByRole("button", { name: "Connect" }).click();
    await this.requireSuccessfulConnectorMutation(startResponse);
    const authorizationPopup = await popup;

    if (!authorizationPopup.isClosed()) {
      await authorizationPopup.waitForEvent("close");
    }

    await this.page.getByText(`${connectorName} connected`, { exact: true }).waitFor();
  }

  async disconnectConnector(connectorName: string) {
    await this.filterPlugins(connectorName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: connectorName }).first(),
    );
    const details = this.page.getByRole("dialog", { name: connectorName });

    await details.getByRole("button", { name: "Disconnect" }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Disconnect Connector" });
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "DELETE" &&
        /\/apps\/connectors\/[^/]+$/.test(new URL(candidate.url()).pathname),
    );

    await confirmation.getByRole("button", { name: "Disconnect Connector" }).click();
    await this.requireSuccessfulConnectorMutation(response);
    await confirmation.waitFor({ state: "hidden" });
  }
}
