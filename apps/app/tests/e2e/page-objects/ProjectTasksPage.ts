import { BasePage } from "./BasePage";

export class ProjectTasksPage extends BasePage {
  get plan() {
    return this.page.getByRole("region", { name: "Plan stage evidence", exact: true });
  }

  async openBoard() {
    await this.page.getByRole("link", { name: "Tasks", exact: true }).first().click();
    await this.page.waitForURL(/\/tasks$/);
    await this.page.getByRole("heading", { name: "Work queue", exact: true }).waitFor();
  }

  get emptyQueue() {
    return this.page
      .getByText("The queue is empty", { exact: true })
      .locator("xpath=ancestor::div[1]");
  }

  get noMatches() {
    return this.page
      .getByText("No work matches", { exact: true })
      .locator("xpath=ancestor::div[1]");
  }

  private pipelineDialog() {
    return this.page.getByRole("dialog", { name: "Configure the teammate pipeline" });
  }

  private stageFieldValues(label: string) {
    return this.pipelineDialog()
      .getByLabel(label, { exact: true })
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement | HTMLSelectElement).value),
      );
  }

  stageNames() {
    return this.stageFieldValues("Stage name");
  }

  stageModes() {
    return this.stageFieldValues("Operating mode");
  }

  stageHandoffs() {
    return this.stageFieldValues("When the goal completes");
  }

  suggestedPipelineButton() {
    return this.pipelineDialog().getByRole("button", {
      name: "Use suggested pipeline",
      exact: true,
    });
  }

  async useSuggestedPipeline() {
    await this.suggestedPipelineButton().click();
  }

  async closePipeline() {
    await this.page.keyboard.press("Escape");
    await this.pipelineDialog().waitFor({ state: "hidden" });
  }

  async filterQueueTo(status: string) {
    await this.page.getByLabel("Filter work by status", { exact: true }).selectOption(status);
  }

  async borderWidthOf(locator: import("@playwright/test").Locator) {
    return locator.evaluate((element) => window.getComputedStyle(element).borderTopWidth);
  }

  async createBacklogTask(objective: string) {
    await this.page.getByRole("button", { name: "Add a task", exact: true }).first().click();
    const dialog = this.page.getByRole("dialog", { name: "Add work to the teammate queue" });

    await dialog.getByLabel("Objective", { exact: true }).fill(objective);
    await dialog.getByRole("button", { name: "Save to backlog", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  async openTask(objective: string) {
    await this.page.getByRole("link", { name: objective, exact: true }).click();
    await this.page.getByRole("heading", { name: objective, level: 1 }).waitFor();
  }

  async configurePipeline() {
    await this.page
      .getByRole("button", { name: "Configure", exact: true })
      .or(this.page.getByRole("button", { name: "Build pipeline", exact: true }))
      .first()
      .click();
    await this.page.getByRole("dialog", { name: "Configure the teammate pipeline" }).waitFor();
  }

  async nameStage(index: number, name: string) {
    await this.page
      .getByRole("dialog", { name: "Configure the teammate pipeline" })
      .getByLabel("Stage name", { exact: true })
      .nth(index)
      .fill(name);
  }

  async addStage(name: string) {
    const dialog = this.page.getByRole("dialog", { name: "Configure the teammate pipeline" });

    await dialog.getByRole("button", { name: "Add stage", exact: true }).click();
    await dialog.getByLabel("Stage name", { exact: true }).last().fill(name);
  }

  async savePipeline() {
    const dialog = this.page.getByRole("dialog", { name: "Configure the teammate pipeline" });

    await dialog.getByRole("button", { name: "Save pipeline", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  }

  async cancel() {
    await this.page.getByRole("button", { name: "Cancel task", exact: true }).click();
  }

  async start() {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/tasks\/[^/]+\/start$/.test(new URL(response.url()).pathname),
    );

    await this.page.getByRole("button", { name: "Run", exact: true }).click();

    return responsePromise;
  }

  async reopen() {
    await this.page.getByRole("button", { name: "Reopen task", exact: true }).click();
  }

  async answerQuestions() {
    await this.page.getByRole("link", { name: "Answer questions", exact: true }).click();
  }

  async delete() {
    await this.page.getByRole("button", { name: "Delete task", exact: true }).click();
    await this.page
      .getByRole("dialog", { name: "Delete task?", exact: true })
      .getByRole("button", { name: "Delete task", exact: true })
      .click();
    await this.page.getByRole("button", { name: "Add a task", exact: true }).waitFor();
  }
}
