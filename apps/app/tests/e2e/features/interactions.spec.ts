import { expect, test } from "../fixtures/polychat-test";
import { InteractionPage } from "../page-objects/InteractionPage";
import { trackCompletionRequests } from "../support/chat-run-requests";

test.describe("Acknowledged conversation interactions", () => {
  test.use({ persona: "pro" });

  test("keeps approval retryable after a network failure and acknowledges the successful retry", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const interactions = new InteractionPage(page);
    const teammate = await polychatApi.createToolTeammate("Approval release check", [
      "request_approval",
    ]);

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    const request = await homePage.sendMessageAndReadCompletionRequest(
      "Request approval for the release check",
      `/teammates/${teammate.id}/completions`,
    );
    const completionId = homePage.completionIdFromRequest(request);

    await expect
      .poll(async () =>
        (await polychatApi.getConversation(completionId)).messages?.some(
          (message) => message.role === "tool" && message.name === "request_approval",
        ),
      )
      .toBe(true);
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

    const approvalSubmissions = trackCompletionRequests(
      page,
      `/teammates/${teammate.id}/completions`,
    );

    await interactions.doubleClickApproval("Approve");
    await expect(interactions.approvalAction("Approve")).toBeDisabled();
    await expect(interactions.approvalAction("Reject")).toBeDisabled();
    await expect(interactions.approval).toContainText("Submitting Approve");
    await expect(interactions.approval.getByRole("status")).toHaveText(
      /You chose Approve\.|This request has been answered\./,
      { timeout: 15_000 },
    );
    await expect(homePage.stopResponseButton).toBeHidden();
    expect(approvalSubmissions).toHaveLength(1);
  });

  test("keeps question answers editable after a network failure and sends them on retry", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const interactions = new InteractionPage(page);
    const teammate = await polychatApi.createToolTeammate("Questions release check", ["ask_user"]);

    await homePage.navigate(`/chat?teammate=${teammate.id}`);
    const request = await homePage.sendMessageAndReadCompletionRequest(
      "Ask questions for the release check",
      `/teammates/${teammate.id}/completions`,
    );
    const completionId = homePage.completionIdFromRequest(request);

    await expect
      .poll(async () =>
        (await polychatApi.getConversation(completionId)).messages?.some(
          (message) => message.role === "tool" && message.name === "ask_user",
        ),
      )
      .toBe(true);
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
