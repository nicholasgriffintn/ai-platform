import { requireSuccessfulResponse } from "../support/api-response";
import { BasePage } from "./BasePage";

export class ProjectEnvironmentPage extends BasePage {
  async openSettings() {
    const settings = this.page.getByRole("link", { name: "Project settings", exact: true });
    const edit = this.page.getByRole("button", { name: "Edit coding repository", exact: true });
    const connect = this.page.getByRole("button", { name: "Connect repository", exact: true });

    await edit.or(connect).or(settings).first().waitFor();
    if (await settings.isVisible()) {
      await settings.click();
    }

    await edit.or(connect).first().waitFor();
  }

  async cacheAction(action: "Rebuild" | "Delete") {
    await this.openSettings();
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname.endsWith("/environment-cache"),
    );

    await this.page.getByRole("button", { name: action, exact: true }).click();
    await requireSuccessfulResponse(await response, `${action} environment cache`);
  }

  async edit() {
    const edit = this.page.getByRole("button", { name: "Edit coding repository", exact: true });

    await this.openSettings();
    await edit.click();
  }

  async connect(repository: string) {
    await this.openSettings();
    await this.page.getByRole("button", { name: "Connect repository", exact: true }).click();
    await this.page
      .getByLabel("GitHub repository", { exact: true })
      .selectOption({ label: repository });
  }

  get deliveryPolicy() {
    return this.page.getByLabel("Delivery policy", { exact: true });
  }

  get reviewDestination() {
    return this.page.getByLabel("Review destination", { exact: true });
  }

  get targetBranch() {
    return this.page.getByLabel("Target branch", { exact: true });
  }

  get deliveryInstructions() {
    return this.page.getByRole("textbox", { name: "Delivery instructions", exact: true });
  }

  async disconnect() {
    await this.openSettings();
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PUT" &&
        /\/projects\/[^/]+$/.test(new URL(candidate.url()).pathname),
    );

    await this.page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await requireSuccessfulResponse(await response, "Disconnect coding environment");
    await this.page.getByRole("button", { name: "Connect repository", exact: true }).waitFor();
  }

  async configureSetup() {
    await this.page.getByLabel("Environment setup", { exact: true }).selectOption("polychat");
    await this.page.getByLabel("Runtime", { exact: true }).selectOption("node");
    await this.page.getByLabel("Runtime version", { exact: true }).fill("22");
    await this.page.getByLabel("Package manager", { exact: true }).selectOption("npm");
    await this.page
      .getByRole("group", { name: "Full setup", exact: true })
      .getByLabel("Command 1", { exact: true })
      .fill("node -e \"console.log('E2E_SETUP_READY')\"");
    const resume = this.page.getByRole("group", { name: "Lightweight resume", exact: true });

    await resume.getByRole("button", { name: "Add command", exact: true }).click();
    await resume
      .getByLabel("Command 1", { exact: true })
      .fill("node -e \"console.log('E2E_RESUME_READY')\"");
    await this.page.getByLabel("Setup timeout (seconds)", { exact: true }).fill("60");
  }

  async save() {
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PUT" &&
        /\/projects\/[^/]+$/.test(new URL(candidate.url()).pathname),
    );

    await this.page.getByRole("button", { name: "Save repository", exact: true }).click();
    await requireSuccessfulResponse(await response, "Save coding environment");

    await this.page.getByRole("button", { name: "Edit coding repository", exact: true }).waitFor();
  }

  async cancelEdit() {
    await this.page.getByRole("button", { name: "Cancel", exact: true }).click();
  }

  async removeSetup() {
    await this.page.getByLabel("Environment setup", { exact: true }).selectOption("none");
    await this.save();
  }
}
