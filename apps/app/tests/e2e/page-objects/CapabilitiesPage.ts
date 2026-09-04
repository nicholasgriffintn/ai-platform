import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export interface AgentModelSettings {
  temperature: string;
  maxSteps: string;
}

export class CapabilitiesPage extends BasePage {
  readonly addMenu: Locator;

  constructor(page: Page) {
    super(page);
    this.addMenu = page.getByRole("button", { name: "Add to this library" });
  }

  async open() {
    await this.navigate("/chat/capabilities");
    await this.page.getByRole("heading", { name: "Capabilities", level: 1 }).waitFor();
  }

  capabilityCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ has: this.page.getByRole("heading", { name, exact: true }) });
  }

  addMenuItem(label: string) {
    return this.page.getByRole("menuitem", { name: new RegExp(`^${label}`) });
  }

  async openAddMenuWithKeyboard() {
    await this.addMenu.focus();
    await this.addMenu.press("Enter");
    await this.addMenuItem("New agent").waitFor();
  }

  async moveAddMenuSelection() {
    await this.page.keyboard.press("ArrowDown");
  }

  async selectAddMenuItemWithKeyboard() {
    await this.page.keyboard.press("Enter");
  }

  async dismissDialog() {
    await this.page.keyboard.press("Escape");
  }

  async closeAddMenuWithKeyboard() {
    await this.page.keyboard.press("Escape");
    await this.addMenuItem("New agent").waitFor({ state: "hidden" });
  }

  async legacyTeamEndpointStatus() {
    return (await this.page.request.get("http://localhost:8787/v1/agents/teams")).status();
  }

  async startNewAgent() {
    await this.clickElement(this.addMenu);
    await this.clickElement(this.page.getByRole("menuitem", { name: /^New agent/ }));
    await this.page.getByRole("heading", { name: "New agent", level: 1 }).waitFor();
  }

  async fillAgentEditor(settings: {
    name: string;
    description: string;
    systemPrompt: string;
    temperature: string;
    maxSteps: string;
  }) {
    await this.fillInput(this.page.getByLabel("Name", { exact: true }), settings.name);
    await this.fillInput(
      this.page.getByLabel("Description", { exact: true }),
      settings.description,
    );
    await this.fillInput(
      this.page.getByLabel("System prompt", { exact: true }),
      settings.systemPrompt,
    );
    await this.fillInput(
      this.page.getByLabel("Temperature", { exact: true }),
      settings.temperature,
    );
    await this.fillInput(this.page.getByLabel("Max steps", { exact: true }), settings.maxSteps);
  }

  async createAgent() {
    const created = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/agents"),
    );

    await this.clickElement(this.page.getByRole("button", { name: "Create agent", exact: true }));
    const response = await created;

    if (!response.ok()) {
      throw new Error(`Agent creation failed with ${response.status()}: ${await response.text()}`);
    }

    await this.page.getByRole("button", { name: "Delete agent", exact: true }).waitFor();
  }

  async readAgentModelSettings(): Promise<AgentModelSettings> {
    return {
      temperature: await this.page.getByLabel("Temperature", { exact: true }).inputValue(),
      maxSteps: await this.page.getByLabel("Max steps", { exact: true }).inputValue(),
    };
  }

  async updateAgentDescription(description: string) {
    const saved = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && /\/agents\/[^/]+$/.test(response.url()),
    );

    await this.fillInput(this.page.getByLabel("Description", { exact: true }), description);
    await this.clickElement(this.page.getByRole("button", { name: "Save agent", exact: true }));
    const response = await saved;

    if (!response.ok()) {
      throw new Error(`Agent update failed with ${response.status()}: ${await response.text()}`);
    }
  }

  private async openCapabilityActions(name: string) {
    await this.clickElement(
      this.capabilityCard(name).getByRole("button", { name: "More actions" }),
    );
  }

  async editAgentFromLibrary(name: string) {
    await this.openCapabilityActions(name);
    await this.clickElement(this.page.getByRole("menuitem", { name: "Edit agent", exact: true }));
    await this.page.getByRole("button", { name: "Delete agent", exact: true }).waitFor();
  }

  async deleteAgentFromLibrary(name: string) {
    await this.openCapabilityActions(name);
    await this.clickElement(this.page.getByRole("menuitem", { name: "Delete agent", exact: true }));
    const confirmation = this.page.getByRole("dialog", { name: "Delete agent" });

    await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    await this.capabilityCard(name).waitFor({ state: "detached" });
  }
}
