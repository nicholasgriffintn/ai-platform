import { teammateResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { WorkbenchPage } from "../page-objects";
import { HomePage } from "../page-objects/HomePage";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

const TEXT_MODEL = "GPT OSS 120B";

test.describe("Conversation and teammate continuity", () => {
  test.use({ persona: "pro" });
  test.setTimeout(120_000);

  test("keeps context unobtrusive and resolves a real concurrent edit", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("pro");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion(
      "Create a durable conversation for the context acceptance flow",
    );
    const conversationId = homePage.completionIdFromRequest(request);
    const workbench = new WorkbenchPage(page);

    await expect(page.getByRole("button", { name: "Open workbench panels" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Conversation workbench" })).toHaveCount(
      0,
    );

    await workbench.expand();
    await expect(page.getByRole("heading", { name: "Conversation context" })).toBeVisible();
    await page.getByRole("button", { name: "Create one now" }).click();
    await expect
      .poll(async () => Boolean((await polychatApi.getConversationBrief(conversationId)).document))
      .toBe(true);

    const initial = await polychatApi.getConversationBrief(conversationId);

    if (!initial.document) {
      throw new Error("Conversation context was not created");
    }

    const editor = page.getByLabel("Working context", { exact: true });
    const localDraft = "# Objective\n\nKeep my concurrent local correction.";

    await editor.fill(localDraft);
    await polychatApi.updateConversationBrief(conversationId, {
      content: "# Objective\n\nA correction saved on another device.",
      expectedRevision: initial.document.revision,
    });
    await page.getByRole("button", { name: "Save a revision" }).click();

    await expect(page.getByText("This document changed elsewhere", { exact: true })).toBeVisible();
    await expect(editor).toHaveValue(localDraft);
    await page.getByRole("button", { name: "Keep my edits" }).click();
    await page.getByRole("button", { name: "Save a revision" }).click();

    await expect
      .poll(async () => (await polychatApi.getConversationBrief(conversationId)).document?.content)
      .toBe(localDraft);
  });

  test("hydrates delegated work after reconnect and supports both follow-up modes", async ({
    homePage,
    page,
    polychatApi,
  }) => {
    const teammateResponse = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        name: "Continuity acceptance teammate",
        kind: "colleague",
        model: "groq-openai-gpt-oss-120b",
      },
    });

    await requireSuccessfulResponse(teammateResponse, "Create continuity teammate");
    const teammate = teammateResponseSchema.parse(await teammateResponse.json());

    await homePage.navigate("/chat");
    await homePage.waitForPersonaReady("pro");
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion(
      `Delegate release continuity to teammate ${teammate.id}`,
    );
    const parentConversationId = homePage.completionIdFromRequest(request);
    const parentPath = new URL(page.url()).pathname;

    const reopenedPage = await page.context().newPage();
    const reopenedHome = new HomePage(reopenedPage);

    await page.close();
    await reopenedHome.navigate("/chat");
    await expect
      .poll(async () => (await polychatApi.getDelegations(parentConversationId)).delegations[0])
      .toMatchObject({ state: "done", waitFor: "none" });

    const first = (await polychatApi.getDelegations(parentConversationId)).delegations[0];

    if (!first?.result) {
      throw new Error("Offline delegation did not persist a result");
    }

    await reopenedHome.navigate(parentPath);
    const delivered = reopenedPage.getByRole("region", { name: "Delegated work" }).filter({
      hasText: "Produce the offline release continuity result.",
    });

    await expect(delivered).toContainText("done", { timeout: 30_000 });
    await expect(delivered).toContainText("E2E response:");

    const childBrief = await polychatApi.getConversationBrief(first.childConversationId);

    if (!childBrief.document) {
      throw new Error("Delegated conversation has no bound context");
    }

    await polychatApi.updateConversationBrief(first.childConversationId, {
      content: "# Objective\n\nCorrected child continuity note E2E",
      expectedRevision: childBrief.document.revision,
    });
    await delivered.getByRole("button", { name: "Continue with new budget" }).click();
    const resumePrompt = (await reopenedHome.chatInput.textContent()) ?? "";

    expect(resumePrompt).toContain(first.childConversationId);
    await reopenedHome.sendMessage(resumePrompt);

    await expect
      .poll(async () => (await polychatApi.getDelegations(parentConversationId)).delegations.length)
      .toBe(2);
    await expect
      .poll(async () => (await polychatApi.getDelegations(parentConversationId)).delegations[1])
      .toMatchObject({
        state: "done",
        childConversationId: first.childConversationId,
        predecessorDelegationId: first.id,
        continuationMode: "resume",
      });

    const continued = (await polychatApi.getDelegations(parentConversationId)).delegations[1];

    if (!continued) {
      throw new Error("Resumed delegation was not persisted");
    }

    expect(continued.id).not.toBe(first.id);
    expect(continued.result?.summary).toContain("corrected child continuity note");

    const continuedDelivery = reopenedPage
      .getByRole("region", { name: "Delegated work" })
      .filter({ hasText: "Confirm the corrected child context." });

    await continuedDelivery.getByRole("button", { name: "Start fresh from brief" }).click();
    const freshPrompt = (await reopenedHome.chatInput.textContent()) ?? "";

    expect(freshPrompt).toContain(first.childConversationId);
    await reopenedHome.sendMessage(freshPrompt);

    await expect
      .poll(async () => (await polychatApi.getDelegations(parentConversationId)).delegations.length)
      .toBe(3);
    await expect
      .poll(async () => (await polychatApi.getDelegations(parentConversationId)).delegations[2])
      .toMatchObject({
        state: "done",
        predecessorDelegationId: continued.id,
        continuationMode: "fresh",
      });

    const fresh = (await polychatApi.getDelegations(parentConversationId)).delegations[2];

    expect(fresh?.childConversationId).not.toBe(first.childConversationId);
  });

  test("cancels delegated work and refuses continuation after project access is revoked", async ({
    homePage,
    page,
    polychatApi,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const teammateResponse = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        name: "Cancellation boundary teammate",
        kind: "colleague",
        model: "groq-openai-gpt-oss-120b",
        workspace_id: workspaceId,
      },
    });

    await requireSuccessfulResponse(teammateResponse, "Create cancellation boundary teammate");
    const teammate = teammateResponseSchema.parse(await teammateResponse.json());
    const attached = await polychatApi.addProjectCapability(projectId, "teammate", teammate.id);

    expect(attached.status).toBe(200);
    expect((await polychatApi.addProjectCapability(projectId, "tool", "delegate")).status).toBe(
      200,
    );
    const projectCapability = await polychatApi.getProjectCapability(
      projectId,
      "teammate",
      teammate.id,
    );

    if (!projectCapability) {
      throw new Error("Project teammate capability was not persisted");
    }

    await workPage.openNewProjectConversation();
    await homePage.selectModel(TEXT_MODEL);
    const request = await homePage.sendMessageAndRequireCompletion(
      `Delegate cancellable continuity to teammate ${teammate.id}`,
    );
    const parentConversationId = homePage.completionIdFromRequest(request);

    await expect
      .poll(
        async () => (await polychatApi.getDelegations(parentConversationId)).delegations[0]?.state,
        { timeout: 15_000 },
      )
      .toMatch(/^(queued|running)$/);
    await polychatApi.cancelConversationDelegations(parentConversationId);
    await expect
      .poll(
        async () => (await polychatApi.getDelegations(parentConversationId)).delegations[0]?.state,
        { timeout: 20_000 },
      )
      .toBe("cancelled");

    await polychatApi.removeProjectCapability(projectId, projectCapability.id);
    const cancelled = page.getByRole("region", { name: "Delegated work" }).filter({
      hasText: "Keep this cancellable delegated stream active until it is stopped.",
    });

    await expect(cancelled).toContainText("cancelled");
    await cancelled.getByRole("button", { name: "Continue with new budget" }).click();
    const continuationPrompt = (await homePage.chatInput.textContent()) ?? "";

    expect(continuationPrompt).toContain(teammate.id);
    await homePage.sendMessageAndRequireCompletion(continuationPrompt);
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "That teammate is not available in this project",
      { timeout: 15_000 },
    );
    expect((await polychatApi.getDelegations(parentConversationId)).delegations).toHaveLength(1);
  });
});
