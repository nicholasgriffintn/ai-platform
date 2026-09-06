import { expect, test } from "../fixtures/polychat-test";
import { InteractionPage } from "../page-objects/InteractionPage";

test.describe("Acknowledged conversation interactions", () => {
  test.use({ persona: "pro" });

  test("keeps approval retryable after a network failure and acknowledges the successful retry", async ({
    homePage,
    page,
  }) => {
    const interactions = new InteractionPage(page);

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Request approval for the release check");
    await expect(interactions.approval).toBeVisible();
    await expect(homePage.stopResponseButton).toBeHidden();
    await interactions.setOffline(true);
    try {
      await interactions.chooseApproval("Approve");
      await expect(interactions.approval.getByRole("alert")).toHaveText(
        "Approval was not submitted. Try again.",
        { timeout: 15_000 },
      );
      await expect(interactions.approvalAction("Approve")).toBeEnabled();
      await expect(interactions.approval).not.toContainText("You chose Approve.");
    } finally {
      await interactions.setOffline(false);
    }

    let approvalSubmissions = 0;

    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/chat/completions") {
        approvalSubmissions += 1;
      }
    });
    await interactions.doubleClickApproval("Approve");
    await expect(interactions.approvalAction("Approve")).toBeDisabled();
    await expect(interactions.approvalAction("Reject")).toBeDisabled();
    await expect(interactions.approval).toContainText("Submitting Approve");
    await expect(interactions.approval.getByRole("status")).toHaveText(
      /You chose Approve\.|This request has been answered\./,
      { timeout: 15_000 },
    );
    await expect(homePage.stopResponseButton).toBeHidden();
    expect(approvalSubmissions).toBe(1);
  });

  test("keeps question answers editable after a network failure and sends them on retry", async ({
    homePage,
    page,
  }) => {
    const interactions = new InteractionPage(page);

    await homePage.navigate("/chat");
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion("Ask questions for the release check");
    await expect(interactions.questions).toBeVisible();
    await expect(homePage.stopResponseButton).toBeHidden();
    await interactions.answerReleaseQuestions();
    await interactions.setOffline(true);
    try {
      await interactions.submitAnswers();
      await expect(interactions.questions.getByRole("alert")).toHaveText(
        "Answers were not submitted. Try again.",
        { timeout: 15_000 },
      );
      await expect(interactions.questions.getByRole("textbox")).toHaveValue(
        "Recover this interrupted stream with validation evidence",
      );
      await expect(interactions.questions).not.toContainText("Answers sent.");
    } finally {
      await interactions.setOffline(false);
    }

    await interactions.submitAnswers();
    await expect(
      interactions.questions.getByRole("button", { name: "Send answers", exact: true }),
    ).toBeDisabled();
    await expect(interactions.questions).toContainText("Sending answers");
    await expect(interactions.questions).toContainText("Answers sent.", { timeout: 15_000 });
  });
});
