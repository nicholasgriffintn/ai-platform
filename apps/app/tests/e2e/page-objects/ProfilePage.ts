import type { Locator, Page } from "@playwright/test";

import { addVirtualAuthenticator } from "../support/virtual-authenticator";
import { BasePage } from "./BasePage";

export class ProfilePage extends BasePage {
  readonly search: Locator;
  readonly providerSyncNotice: Locator;

  constructor(page: Page) {
    super(page);
    this.search = page.getByRole("searchbox", { name: "Search providers" });
    this.providerSyncNotice = page.getByRole("alert", {
      name: "Provider catalogue needs syncing",
    });
  }

  async openProviders(type: "all" | "connector" = "all") {
    const suffix = type === "connector" ? "&type=connector" : "";

    await this.navigate(`/profile?tab=providers${suffix}`);
    await this.page.getByRole("heading", { name: "Available Providers" }).waitFor();
    await this.waitForElement(this.search);
  }

  async filterProviders(name: string) {
    await this.fillInput(this.search, name);
  }

  async syncProviders() {
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && candidate.url().endsWith("/user/sync-providers"),
    );

    await this.clickElement(this.page.getByRole("button", { name: "Sync Providers", exact: true }));
    if (!(await response).ok()) {
      throw new Error("Provider synchronisation failed");
    }
  }

  async syncProvidersFromNotice() {
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && candidate.url().endsWith("/user/sync-providers"),
    );

    await this.providerSyncNotice.getByRole("button", { name: "Sync providers now" }).click();
    if (!(await response).ok()) {
      throw new Error("Provider synchronisation failed");
    }

    await this.providerSyncNotice.waitFor({ state: "hidden" });
  }

  async openAccount() {
    await this.navigate("/profile?tab=account");
    await this.page.getByRole("heading", { name: "Account", exact: true }).waitFor();
  }

  async openTab(tab: string, heading: string) {
    await this.navigate(`/profile?tab=${tab}`);
    await this.page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
    await this.page
      .getByText("Loading profile data...", { exact: true })
      .waitFor({ state: "hidden" });
  }

  async logout() {
    await this.clickElement(this.page.getByRole("button", { name: "Logout", exact: true }));
  }

  async configureProvider(providerName: string, apiKey: string) {
    await this.fillInput(this.search, providerName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: providerName }).first(),
    );
    const dialog = this.page.getByRole("dialog", { name: `Configure ${providerName}` });

    await dialog.getByLabel("API Key").fill(apiKey);
    const response = this.waitForProviderMutation("POST");
    const refresh = this.waitForProviderRefresh();

    await dialog.getByRole("button", { name: "Save" }).click();
    await this.requireSuccessfulProviderMutation(response);
    await this.requireSuccessfulProviderMutation(refresh);
    await dialog.waitFor({ state: "hidden" });
  }

  async configureAwsProvider(providerName: string, accessKey: string, secretKey: string) {
    await this.fillInput(this.search, providerName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: providerName }).first(),
    );
    const dialog = this.page.getByRole("dialog", { name: `Configure ${providerName}` });

    await dialog.getByLabel("AWS Access Key ID", { exact: true }).fill(accessKey);
    await dialog.getByLabel("AWS Secret Access Key", { exact: true }).fill(secretKey);
    const response = this.waitForProviderMutation("POST");
    const refresh = this.waitForProviderRefresh();

    await dialog.getByRole("button", { name: "Save" }).click();
    await this.requireSuccessfulProviderMutation(response);
    await this.requireSuccessfulProviderMutation(refresh);
    await dialog.waitFor({ state: "hidden" });
  }

  async configureProviderFields(providerName: string, fields: Record<string, string>) {
    await this.fillInput(this.search, providerName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: providerName }).first(),
    );
    const dialog = this.page.getByRole("dialog", { name: `Configure ${providerName}` });

    for (const [label, value] of Object.entries(fields)) {
      await dialog.getByLabel(label, { exact: true }).fill(value);
    }

    const response = this.waitForProviderMutation("POST");
    const refresh = this.waitForProviderRefresh();

    await dialog.getByRole("button", { name: "Save" }).click();
    await this.requireSuccessfulProviderMutation(response);
    await this.requireSuccessfulProviderMutation(refresh);
    await dialog.waitFor({ state: "hidden" });
  }

  private waitForProviderMutation(method: "POST" | "DELETE") {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === method &&
        (response.url().endsWith("/user/store-provider-api-key") ||
          response.url().includes("/user/providers/")),
    );
  }

  private waitForProviderRefresh() {
    return this.page.waitForResponse(
      (response) =>
        response.request().method() === "GET" && response.url().endsWith("/user/providers"),
    );
  }

  private async requireSuccessfulProviderMutation(
    responsePromise: ReturnType<Page["waitForResponse"]>,
  ) {
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(
        `Provider mutation failed with ${response.status()}: ${await response.text()}`,
      );
    }
  }

  async removeProvider(providerName: string) {
    await this.fillInput(this.search, providerName);
    await this.clickElement(
      this.page.getByRole("button").filter({ hasText: providerName }).first(),
    );
    const dialog = this.page.getByRole("dialog", { name: `Configure ${providerName}` });

    await dialog.getByRole("button", { name: "Remove key" }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Delete Provider" });
    const response = this.waitForProviderMutation("DELETE");
    const refresh = this.waitForProviderRefresh();

    await confirmation.getByRole("button", { name: "Delete Provider" }).click();
    await this.requireSuccessfulProviderMutation(response);
    await this.requireSuccessfulProviderMutation(refresh);
    await confirmation.waitFor({ state: "hidden" });
  }

  async connectApiKeyConnector(connectorName: string, apiKey: string) {
    await this.fillInput(this.search, connectorName);
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
    await this.requireSuccessfulProviderMutation(response);
    await credentials.waitFor({ state: "hidden" });
  }

  async connectOAuthConnector(connectorName: string) {
    await this.fillInput(this.search, connectorName);
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
    await this.requireSuccessfulProviderMutation(startResponse);
    const authorizationPopup = await popup;

    if (!authorizationPopup.isClosed()) {
      await authorizationPopup.waitForEvent("close");
    }

    await this.page.getByText(`${connectorName} connected`, { exact: true }).waitFor();
  }

  async disconnectConnector(connectorName: string) {
    await this.fillInput(this.search, connectorName);
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
    await this.requireSuccessfulProviderMutation(response);
    await confirmation.waitFor({ state: "hidden" });
  }

  async createAndDeleteApiKey(name: string) {
    await this.openTab("api-keys", "API Keys");
    await this.page.getByLabel("Key Name (Optional)").fill(name);
    await this.page.getByRole("button", { name: "Generate Key" }).click();
    const created = this.page.getByRole("dialog", { name: `API Key Created: ${name}` });

    await created.getByRole("button", { name: "Done" }).click();
    await this.page.getByText(name, { exact: true }).waitFor();
    await this.page.getByRole("button", { name: `Delete API key ${name}` }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Delete API Key" });

    await confirmation.getByRole("button", { name: "Delete Key" }).click();
    await confirmation.waitFor({ state: "hidden" });
  }

  async exportChatHistory() {
    await this.openTab("history", "Chat History");
    const download = this.page.waitForEvent("download");

    await this.page.getByRole("button", { name: "Export JSON" }).click();

    return download;
  }

  async deleteAllLocalChats() {
    await this.openTab("history", "Chat History");
    await this.page.getByRole("button", { name: "Delete all local chats" }).click();
    const confirmation = this.page.getByRole("dialog", {
      name: "Delete All Local Conversations",
    });

    await confirmation.getByRole("button", { name: "Delete All Local" }).click();
    await confirmation.waitFor({ state: "hidden" });
  }

  async deleteAllRemoteChats() {
    await this.openTab("history", "Chat History");
    await this.page.getByRole("button", { name: "Delete all remote chats" }).click();
    const confirmation = this.page.getByRole("dialog", {
      name: "Delete All Remote Conversations",
    });

    await confirmation.getByRole("button", { name: "Delete All Remote" }).click();
    await confirmation.waitFor({ state: "hidden" });
  }

  async createAndDeleteSource(title: string, content: string) {
    await this.openTab("sources", "Sources");
    await this.page.getByRole("button", { name: "Add source" }).click();
    const addSource = this.page.getByRole("dialog", { name: "Add source" });

    await addSource.getByLabel("Title", { exact: true }).fill(title);
    await addSource.getByLabel("Content", { exact: true }).fill(content);
    await addSource.getByRole("button", { name: "Add source" }).click();
    await addSource.waitFor({ state: "hidden" });
    await this.page.getByText(title, { exact: true }).waitFor();
    await this.page.getByRole("button", { name: `Delete ${title}` }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Delete source" });

    await confirmation.getByRole("button", { name: "Delete source" }).click();
    await confirmation.waitFor({ state: "hidden" });
  }

  async updateCustomisation(settings: {
    nickname: string;
    jobRole: string;
    preferences: string;
    searchProvider: string;
  }) {
    await this.openTab("customisation", "Customise Chat");
    await this.page.getByLabel("Nickname", { exact: true }).fill(settings.nickname);
    await this.page.getByLabel("Job Role", { exact: true }).fill(settings.jobRole);
    await this.page.getByLabel("Preferences", { exact: true }).fill(settings.preferences);
    await this.page
      .getByLabel("Search Provider", { exact: true })
      .selectOption(settings.searchProvider);
    await this.page.getByRole("button", { name: "Save Settings" }).click();
    await this.page.getByText("Settings saved successfully!", { exact: true }).waitFor();
  }

  async createSourceCollectionWithSource(
    collectionName: string,
    sourceTitle: string,
    content: string,
  ) {
    await this.openTab("sources", "Sources");
    await this.page.getByRole("button", { name: "Create collection" }).click();
    const collectionDialog = this.page.getByRole("dialog", { name: "Create collection" });

    await collectionDialog.getByLabel("Name", { exact: true }).fill(collectionName);
    await collectionDialog.getByRole("button", { name: "Create collection" }).click();
    await collectionDialog.waitFor({ state: "hidden" });
    await this.page.getByRole("button", { name: new RegExp(`^${collectionName}`) }).waitFor();

    await this.page.getByRole("button", { name: "Add source" }).click();
    const sourceDialog = this.page.getByRole("dialog", { name: "Add source" });

    await sourceDialog.getByLabel("Title", { exact: true }).fill(sourceTitle);
    await sourceDialog.getByLabel("Content", { exact: true }).fill(content);
    await sourceDialog.getByRole("button", { name: "Add source" }).click();
    await sourceDialog.waitFor({ state: "hidden" });
    await this.page
      .getByLabel(`Add ${sourceTitle} to a collection`)
      .selectOption({ label: collectionName });
    await this.page.getByRole("button", { name: new RegExp(`^${collectionName}`) }).click();
    await this.page.getByText(sourceTitle, { exact: true }).waitFor();
  }

  async deleteSourceCollectionAndSource(collectionName: string, sourceTitle: string) {
    await this.page.getByRole("button", { name: "All sources", exact: true }).click();
    await this.page.getByRole("button", { name: `Delete ${sourceTitle}` }).click();
    const sourceConfirmation = this.page.getByRole("dialog", { name: "Delete source" });

    await sourceConfirmation.getByRole("button", { name: "Delete source" }).click();
    await sourceConfirmation.waitFor({ state: "hidden" });

    await this.page.getByRole("button", { name: `Delete ${collectionName}` }).click();
    const collectionConfirmation = this.page.getByRole("dialog", { name: "Delete collection" });

    await collectionConfirmation.getByRole("button", { name: "Delete collection" }).click();
    await collectionConfirmation.waitFor({ state: "hidden" });
  }

  async createAndDeletePasskey() {
    const removeVirtualAuthenticator = await addVirtualAuthenticator(this.page);

    try {
      await this.openTab("passkeys", "Passkeys");
      await this.page.getByRole("button", { name: "Add Passkey" }).first().click();
      const passkey = this.page
        .getByText(/Passkey$/, { exact: false })
        .filter({ hasNotText: "Add" })
        .first();

      await passkey.waitFor();
      await this.page.getByRole("button", { name: "Remove passkey" }).click();
      const confirmation = this.page.getByRole("dialog", { name: "Remove Passkey" });

      await confirmation.getByRole("button", { name: "Remove Passkey" }).click();
      await confirmation.waitFor({ state: "hidden" });
      await this.page.getByText("No passkeys added", { exact: true }).waitFor();
    } finally {
      await removeVirtualAuthenticator();
    }
  }

  async createAndDeleteSandboxConnection(installationId: string, privateKey: string) {
    await this.openTab("sandbox", "Sandbox");
    await this.page.getByRole("button", { name: "Add GitHub connection" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Add GitHub connection" });

    await dialog.getByRole("button", { name: "Configure manually" }).click();
    await dialog.getByLabel("Installation ID", { exact: true }).fill(installationId);
    await dialog.getByLabel("GitHub App ID", { exact: true }).fill("release-app");
    await dialog.getByLabel("GitHub App private key", { exact: true }).fill(privateKey);
    await dialog
      .getByLabel("Webhook secret (optional)", { exact: true })
      .fill("e2e-webhook-secret");
    await dialog
      .getByLabel("Allowed repositories (optional)", { exact: true })
      .fill("polychat/release-validation");
    const saveResponse = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/apps/sandbox/connections"),
    );

    await dialog.getByRole("button", { name: "Save connection" }).click();
    const response = await saveResponse;

    if (!response.ok()) {
      throw new Error(
        `Sandbox connection mutation failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await dialog.waitFor({ state: "hidden" });
    const connection = this.page.getByText(`Installation ${installationId}`, { exact: true });

    await connection.waitFor();

    await this.page.getByRole("button", { name: "Remove", exact: true }).click();
    const confirmation = this.page.getByRole("dialog", { name: "Delete connection" });

    await confirmation.getByRole("button", { name: "Delete connection" }).click();
    await confirmation.waitFor({ state: "hidden" });
    await connection.waitFor({ state: "detached" });
  }
}
