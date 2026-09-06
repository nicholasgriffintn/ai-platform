import { BasePage } from "./BasePage";

export class InteractionPage extends BasePage {
  get approval() {
    return this.page.getByRole("region", { name: "Approval required", exact: true });
  }

  get questions() {
    return this.page.getByRole("region", { name: "Questions from the agent", exact: true });
  }

  approvalAction(name: "Approve" | "Reject") {
    return this.approval.getByRole("button", { name, exact: true });
  }

  async setOffline(offline: boolean) {
    await this.page.context().setOffline(offline);
  }

  async chooseApproval(name: "Approve" | "Reject") {
    await this.approvalAction(name).click();
  }

  async doubleClickApproval(name: "Approve" | "Reject") {
    await this.approvalAction(name).dblclick();
  }

  async answerReleaseQuestions() {
    await this.questions.getByRole("button", { name: /Maintainers/ }).click();
    await this.questions
      .getByRole("textbox", { name: "Answer: Which detail should the report emphasise?" })
      .fill("Recover this interrupted stream with validation evidence");
  }

  async submitAnswers() {
    await this.questions.getByRole("button", { name: "Send answers", exact: true }).click();
  }
}
