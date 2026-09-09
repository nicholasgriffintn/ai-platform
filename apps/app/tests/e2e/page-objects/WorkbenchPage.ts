import { chooseDropdownOption } from "../support/dropdown";
import { BasePage } from "./BasePage";

export class WorkbenchPage extends BasePage {
  get status() {
    return this.page.getByRole("status").filter({
      has: this.page.locator("span").filter({
        hasText:
          /^(Ready|Queued|Preparing|Running|Paused|Waiting for approval|Waiting for input|Ready for review|Completed|Failed|Cancelled)$/,
      }),
    });
  }

  get statusDetail() {
    return this.status.locator("span.text-muted-foreground");
  }

  async statusDetailIsTruncated() {
    return this.statusDetail.evaluate((element) => element.scrollWidth > element.clientWidth);
  }

  async statusStripHasPageBackground() {
    return this.status.locator("..").evaluate((element) => {
      return getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)";
    });
  }

  async statusStripHasAttentionBackground() {
    return this.status.locator("..").evaluate((element) => {
      return getComputedStyle(element).backgroundColor !== "rgba(0, 0, 0, 0)";
    });
  }

  get dock() {
    return this.page.getByRole("complementary", { name: "Project workbench", exact: true });
  }

  async selectPane(name: "Activity" | "Changes" | "Files" | "Proof" | "Preview") {
    await this.paneTab(name).click();
  }

  get panel() {
    return this.page.locator('[role="tabpanel"]:visible');
  }

  get conversation() {
    return this.page.getByRole("main", { name: "Conversation", exact: true });
  }

  get activityEntries() {
    return this.page
      .getByRole("list", { name: "Conversation and run activity", exact: true })
      .locator(":scope > li");
  }

  get activityTitles() {
    return this.activityEntries.locator(":scope > div > div:first-child > p:first-child");
  }

  activityEntry(title: string) {
    return this.activityEntries.filter({ has: this.page.getByText(title, { exact: true }) });
  }

  get changedFilesNavigation() {
    return this.panel.getByRole("navigation", { name: "Changed files", exact: true });
  }

  get changedFileSearch() {
    return this.panel.getByRole("searchbox", { name: "Find changed file", exact: true });
  }

  get previousChangedFile() {
    return this.panel.getByRole("button", { name: "Previous changed file", exact: true });
  }

  get nextChangedFile() {
    return this.panel.getByRole("button", { name: "Next changed file", exact: true });
  }

  changesIn(path: string) {
    return this.panel.getByRole("region", { name: `Changes in ${path}`, exact: true });
  }

  artifact(name: string) {
    return this.panel.getByRole("button", { name, exact: true });
  }

  changedFileEvidence(path: string) {
    return this.panel.getByRole("button", { name: `Open ${path}`, exact: true });
  }

  artifactPreview(name: string) {
    return this.panel.getByRole("region", { name: `Preview of ${name}`, exact: true });
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
    return this.page.locator('[role="tab"]:visible').filter({ hasText: name });
  }

  panePanel(name: "Activity" | "Changes" | "Files" | "Proof" | "Preview") {
    return this.page.getByRole("tabpanel", { name, exact: true });
  }

  async hasVisibleKeyboardFocus() {
    return this.page.evaluate(() => {
      const element = document.activeElement;

      if (!(element instanceof HTMLElement) || !element.matches(":focus-visible")) {
        return false;
      }

      const style = getComputedStyle(element);

      return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    });
  }

  async collapse() {
    await this.page.getByRole("button", { name: "Collapse workbench panels", exact: true }).click();
  }

  async expand() {
    await this.page.getByRole("button", { name: "Open workbench panels", exact: true }).click();
  }

  async control(action: "Pause" | "Resume" | "Cancel") {
    await this.controlButton(action).click();
  }

  controlButton(action: "Pause" | "Resume" | "Cancel" | "Continue") {
    return this.page.getByRole("button", { name: action, exact: true });
  }

  controlLabel(action: "Pause" | "Resume" | "Cancel" | "Continue") {
    return this.controlButton(action).locator("span").filter({ hasText: action }).last();
  }

  async controlPresentation(action: "Pause" | "Resume" | "Cancel" | "Continue") {
    const [title, labelVisible] = await Promise.all([
      this.controlButton(action).getAttribute("title"),
      this.controlLabel(action).isVisible(),
    ]);

    return { action, title, labelVisible };
  }

  service(name: string) {
    return this.page
      .getByRole("region", { name: "Project services", exact: true })
      .getByRole("listitem")
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  serviceOutput(name: string) {
    const entry = this.page
      .getByRole("region", { name: "Conversation and run timeline", exact: true })
      .getByRole("listitem")
      .filter({ has: this.page.getByText(`Service running · ${name}`, { exact: true }) });

    return {
      toggle: entry.getByText(/output updates/),
      output: entry.locator("pre"),
    };
  }

  proofService(name: string) {
    return this.page
      .getByRole("list", { name: "Declared service outcomes", exact: true })
      .getByRole("listitem")
      .filter({ has: this.page.getByText(name, { exact: true }) });
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
    return this.page.frameLocator('iframe[title="fixture preview content"]:visible');
  }

  get previewFrameElement() {
    return this.page.locator('iframe[title="fixture preview content"]:visible');
  }

  get previewShell() {
    return this.page.locator('section[aria-label="Service preview"]:visible');
  }

  get previewAttackResults() {
    return this.previewFrame.locator("#sandbox-attack-results");
  }

  async selectPreviewService(serviceName: string) {
    await chooseDropdownOption(
      this.previewShell.getByLabel("Declared service", { exact: true }),
      new RegExp(`^${serviceName} `),
    );
  }

  async startPreview() {
    const preview = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/previews"),
    );

    await this.previewShell.getByRole("button", { name: "Start preview", exact: true }).click();

    return preview;
  }

  async refreshPreview() {
    const preview = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/previews"),
    );

    await this.previewShell.getByRole("button", { name: "Refresh", exact: true }).click();

    return preview;
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
    await this.previewViewportButton(name).click();
  }

  previewViewportButton(name: "Fit" | "Mobile" | "Tablet" | "Desktop") {
    return this.previewShell.getByRole("button", { name: `${name} viewport`, exact: true });
  }

  async openPreviewExternally() {
    const popup = this.page.context().waitForEvent("page");

    await this.previewShell.getByRole("button", { name: "Open externally", exact: true }).click();

    return popup;
  }

  async navigatePreview(route: string) {
    await this.previewShell.getByLabel("Recorded route", { exact: true }).fill(route);
    await this.previewShell.getByRole("button", { name: "Go", exact: true }).click();
  }

  async sendPreviewFeedback(annotation: string, elementReference: string) {
    const preview = this.previewShell;

    await preview.getByLabel("Element reference", { exact: false }).fill(elementReference);
    await preview.getByLabel("Feedback", { exact: true }).fill(annotation);
    await preview.getByRole("button", { name: "Send instruction", exact: true }).click();
  }

  async markPreviewRegion() {
    await this.previewShell.getByRole("button", { name: "Mark region", exact: true }).click();
    const overlay = this.previewShell.getByLabel(
      "Drag over the preview to mark a feedback region",
      {
        exact: true,
      },
    );

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
