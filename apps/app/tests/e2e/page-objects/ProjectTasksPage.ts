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

  async createBacklogTask(objective: string) {
    await this.page.getByRole("button", { name: "Add a task", exact: true }).first().click();
    const dialog = this.page.getByRole("dialog", { name: "Add work to the agent queue" });

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
    await this.page.getByRole("dialog", { name: "Configure the agent pipeline" }).waitFor();
  }

  async nameStage(index: number, name: string) {
    await this.page
      .getByRole("dialog", { name: "Configure the agent pipeline" })
      .getByLabel("Stage name", { exact: true })
      .nth(index)
      .fill(name);
  }

  async addStage(name: string) {
    const dialog = this.page.getByRole("dialog", { name: "Configure the agent pipeline" });

    await dialog.getByRole("button", { name: "Add stage", exact: true }).click();
    await dialog.getByLabel("Stage name", { exact: true }).last().fill(name);
  }

  async savePipeline() {
    const dialog = this.page.getByRole("dialog", { name: "Configure the agent pipeline" });

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
    await this.page.getByRole("heading", { name: "Tasks", level: 1 }).waitFor();
  }
}
