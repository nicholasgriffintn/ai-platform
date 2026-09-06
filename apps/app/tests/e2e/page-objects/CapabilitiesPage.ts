import type { Locator, Page } from "@playwright/test";

import { E2E_API_BASE_URL } from "../support/environment";
import { BasePage } from "./BasePage";

export interface TeammateModelSettings {
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
    await this.navigate("/teammates");
    await this.page.getByRole("heading", { name: "Teammates & tools", level: 1 }).waitFor();
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
    await this.addMenuItem("New teammate").waitFor();
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
    await this.addMenuItem("New teammate").waitFor({ state: "hidden" });
  }

  async legacyTeamEndpointStatus() {
    return (await this.page.request.get(`${E2E_API_BASE_URL}/teammates/teams`)).status();
  }

  async startNewTeammate() {
    await this.clickElement(this.addMenu);
    await this.clickElement(this.page.getByRole("menuitem", { name: /^New teammate/ }));
    await this.page.getByRole("heading", { name: "New teammate", level: 1 }).waitFor();
  }

  async fillTeammateEditor(settings: {
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

  async createTeammate() {
    const created = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/teammates"),
    );

    await this.clickElement(
      this.page.getByRole("button", { name: "Create teammate", exact: true }),
    );
    const response = await created;

    if (!response.ok()) {
      throw new Error(
        `Teammate creation failed with ${response.status()}: ${await response.text()}`,
      );
    }

    await this.page.getByRole("button", { name: "Delete teammate", exact: true }).waitFor();
  }

  async readTeammateModelSettings(): Promise<TeammateModelSettings> {
    return {
      temperature: await this.page.getByLabel("Temperature", { exact: true }).inputValue(),
      maxSteps: await this.page.getByLabel("Max steps", { exact: true }).inputValue(),
    };
  }

  async updateTeammateDescription(description: string) {
    const saved = this.page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && /\/teammates\/[^/]+$/.test(response.url()),
    );

    await this.fillInput(this.page.getByLabel("Description", { exact: true }), description);
    await this.clickElement(this.page.getByRole("button", { name: "Save teammate", exact: true }));
    const response = await saved;

    if (!response.ok()) {
      throw new Error(`Teammate update failed with ${response.status()}: ${await response.text()}`);
    }
  }

  private async openCapabilityActions(name: string) {
    await this.clickElement(
      this.capabilityCard(name).getByRole("button", { name: "More actions" }),
    );
  }

  async editTeammateFromLibrary(name: string) {
    await this.openCapabilityActions(name);
    await this.clickElement(
      this.page.getByRole("menuitem", { name: "Edit teammate", exact: true }),
    );
    await this.page.getByRole("button", { name: "Delete teammate", exact: true }).waitFor();
  }

  async deleteTeammateFromLibrary(name: string) {
    await this.openCapabilityActions(name);
    await this.clickElement(
      this.page.getByRole("menuitem", { name: "Delete teammate", exact: true }),
    );
    const confirmation = this.page.getByRole("dialog", { name: "Delete teammate" });

    await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    await this.capabilityCard(name).waitFor({ state: "detached" });
  }
}
