import { BasePage } from "./BasePage";

export class SandboxPreviewPage extends BasePage {
  get serviceHeading() {
    return this.page.getByRole("heading", { name: "Sandbox service ready", exact: true });
  }

  async open(url: string) {
    return this.page.goto(url);
  }
}
