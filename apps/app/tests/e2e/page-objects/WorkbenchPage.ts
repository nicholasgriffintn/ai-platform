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

  async control(action: "Pause" | "Resume" | "Cancel") {
    await this.page.getByRole("button", { name: action, exact: true }).click();
  }

  async openSteering() {
    await this.page.getByRole("button", { name: "Steer", exact: true }).click();
  }

  async addInstruction(content: string) {
    await this.page.getByRole("textbox", { name: "Run instruction", exact: true }).fill(content);
    await this.page.getByRole("button", { name: "Add instruction", exact: true }).click();
  }

  get previewFrame() {
    return this.page.frameLocator('iframe[title="fixture preview content"]');
  }

  async startPreview() {
    await this.page.getByRole("button", { name: "Start preview", exact: true }).click();
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
