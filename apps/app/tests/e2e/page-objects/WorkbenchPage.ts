import { BasePage } from "./BasePage";

export class WorkbenchPage extends BasePage {
  get dock() {
    return this.page.getByRole("complementary", { name: "Project workbench", exact: true });
  }

  async selectPane(name: "Activity" | "Changes" | "Files" | "Proof" | "Preview") {
    await this.page.getByRole("tab", { name, exact: true }).click();
  }

  get panel() {
    return this.page.getByRole("tabpanel");
  }

  get resizeHandle() {
    return this.page.getByRole("separator", { name: "Resize workbench panels", exact: true });
  }

  get mobileTrigger() {
    return this.page.getByRole("button", { name: "Workbench", exact: true });
  }

  get mobileDialog() {
    return this.page.getByRole("dialog", { name: "Project workbench", exact: true });
  }

  paneTab(name: "Activity" | "Changes" | "Files" | "Proof" | "Preview") {
    return this.page.getByRole("tab", { name, exact: true });
  }

  async collapse() {
    await this.page.getByRole("button", { name: "Collapse workbench panels", exact: true }).click();
  }

  async expand() {
    await this.page.getByRole("button", { name: "Open workbench panels", exact: true }).click();
  }

  async control(action: "Pause" | "Resume" | "Cancel") {
    await this.page.getByRole("button", { name: action, exact: true }).click();
  }

  service(name: string) {
    return this.page
      .getByRole("region", { name: "Project services", exact: true })
      .getByRole("listitem")
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  serviceLog(name: string, stream: "stdout" | "stderr") {
    const details = this.page.getByRole("group", {
      name: `Show ${name} ${stream} log`,
      exact: true,
    });

    return {
      toggle: details.getByText(`Show ${name} ${stream} log`, { exact: true }),
      output: details.getByRole("log", { name: `${name} ${stream} output`, exact: true }),
    };
  }

  async controlService(name: string, action: "Start" | "Stop" | "Restart") {
    await this.service(name)
      .getByRole("button", { name: `${action} ${name}`, exact: true })
      .click();
  }

  async resolveApproval(action: "Approve" | "Reject") {
    await this.page
      .getByRole("region", { name: "Pending command approvals", exact: true })
      .getByRole("button", { name: action, exact: true })
      .click();
  }

  get composer() {
    return this.page.getByRole("textbox", { name: "Message input", exact: true });
  }

  async addInstruction(content: string) {
    await this.composer.fill(content);
    await this.page.getByRole("button", { name: "Send instruction", exact: true }).click();
  }

  get previewFrame() {
    return this.page.frameLocator('iframe[title="fixture preview content"]');
  }

  async startPreview() {
    await this.page.getByRole("button", { name: "Start preview", exact: true }).click();
  }

  async reloadPreviewDocument() {
    const previewFrame = this.page.frames().find((frame) => {
      const hostname = new URL(frame.url()).hostname;

      return hostname.endsWith(".localhost");
    });

    if (!previewFrame) {
      throw new Error("The embedded preview frame is not available");
    }

    try {
      return await previewFrame.goto(previewFrame.url());
    } catch (error) {
      if (error instanceof Error && error.message.includes("ERR_BLOCKED_BY_RESPONSE")) {
        return null;
      }

      throw error;
    }
  }

  async previewViewport(name: "Fit" | "Mobile" | "Tablet" | "Desktop") {
    await this.page.getByRole("button", { name: `${name} viewport`, exact: true }).click();
  }

  async navigatePreview(route: string) {
    await this.page.getByLabel("Recorded route", { exact: true }).fill(route);
    await this.page.getByRole("button", { name: "Go", exact: true }).click();
  }

  async sendPreviewFeedback(annotation: string, elementReference: string) {
    await this.page.getByLabel("Element reference", { exact: false }).fill(elementReference);
    await this.page.getByLabel("Feedback", { exact: true }).fill(annotation);
    await this.page.getByRole("button", { name: "Send instruction", exact: true }).click();
  }

  async markPreviewRegion() {
    await this.page.getByRole("button", { name: "Mark region", exact: true }).click();
    const overlay = this.page.getByLabel("Drag over the preview to mark a feedback region", {
      exact: true,
    });

    await overlay.scrollIntoViewIfNeeded();
    const box = await overlay.boundingBox();

    if (!box) {
      throw new Error("The preview region overlay is not visible");
    }

    await this.page.mouse.move(box.x + 20, box.y + 20);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 120, box.y + 120, { steps: 5 });
    await this.page.mouse.up();
  }
}
