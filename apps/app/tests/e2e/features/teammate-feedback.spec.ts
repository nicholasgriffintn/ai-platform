import {
  authoredSkillDocumentSchema,
  capabilityCatalogResponseSchema,
  teammateResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { HomePage } from "../page-objects/HomePage";
import { WorkPage } from "../page-objects/WorkPage";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Teammate feedback and invocation behaviour", () => {
  test.use({ persona: "pro" });

  test("hires into a project, replaces one person's verdict and counts distinct authorised people", async ({
    browser,
    page,
    workPage,
    homePage,
    capabilitiesPage,
    polychatApi,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const projectPath = new URL(page.url()).pathname;
    const headers = { origin: E2E_APP_BASE_URL };

    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${projectId}/teammates`);
    await capabilitiesPage.openAddMenuWithKeyboard();
    await capabilitiesPage.selectAddMenuItemWithKeyboard();
    const dialog = page.getByRole("dialog", { name: "Hire a teammate" });

    await dialog.getByLabel("Name", { exact: true }).fill("Review colleague");
    await dialog
      .getByLabel("Describe the job", { exact: true })
      .fill("Review the release evidence.");
    const hiring = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/teammates/hire"),
    );

    await dialog.getByRole("button", { name: "Hire", exact: true }).click();
    const hiredResponse = await hiring;

    expect(hiredResponse.status()).toBe(200);
    const teammate = teammateResponseSchema.parse(await hiredResponse.json());

    expect(teammate).toMatchObject({
      owner_scope_type: "workspace",
      owner_scope_id: workspaceId,
      kind: "colleague",
    });
    await dialog.waitFor({ state: "hidden" });
    expect((await polychatApi.addProjectCapability(projectId, "tool", "save_skill")).status).toBe(
      200,
    );
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${projectId}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toBeVisible();
    await workPage.navigate(projectPath);
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    const completion = await homePage.sendMessageAndRequireCompletion("Review scorecard evidence");

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(completion);

    await homePage.sendMessageAndRequireCompletion("Save the agreed release skill");
    await expect(homePage.getLatestAssistantMessage()).toContainText(
      "Saved release-playbook to this project",
    );
    const skillResponse = await page.request.get(
      `${E2E_API_BASE_URL}/projects/${projectId}/skills/release-playbook`,
    );

    await requireSuccessfulResponse(skillResponse, "Read project-owned skill");
    expect(authoredSkillDocumentSchema.parse(await skillResponse.json()).scope).toEqual({
      type: "project",
      projectId,
    });
    expect(
      (await page.request.get(`${E2E_API_BASE_URL}/skills/documents/release-playbook`)).status(),
    ).toBe(404);
    const feedbackUrl = `${E2E_API_BASE_URL}/teammates/${teammate.id}/feedback`;

    for (const verdict of ["good", "bad"]) {
      const response = await page.request.post(feedbackUrl, {
        headers,
        data: { verdict, conversationId },
      });

      await requireSuccessfulResponse(response, "Record replacement verdict");
    }

    const catalogUrl = `${E2E_API_BASE_URL}/capabilities?projectId=${projectId}`;
    const firstResponse = await page.request.get(catalogUrl);

    await requireSuccessfulResponse(firstResponse, "Read scorecard");
    const first = capabilityCatalogResponseSchema.parse(await firstResponse.json());

    expect(first.teammates.find((item) => item.id === teammate.id)?.scorecard).toEqual({
      good: 0,
      bad: 1,
    });
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      expect(
        (
          await member.context.request.post(feedbackUrl, {
            headers,
            data: { verdict: "good", conversationId },
          })
        ).status(),
      ).toBe(404);
      const memberWork = new WorkPage(await member.context.newPage());

      await workPage.navigate(projectPath);
      await workPage.openProjectSurface("People");
      await memberWork.acceptInvitation(await workPage.createMemberInvitation(member.email));
      await memberWork.navigate(projectPath);
      await memberWork.openNewProjectConversation();
      const memberHome = new HomePage(memberWork.page);

      await memberHome.selectModel("GPT OSS 120B");
      await memberHome.sendMessageAndRequireCompletion("Save the agreed release skill");
      await expect(memberHome.getLatestAssistantMessage()).toContainText(
        /access|permission|forbidden/i,
      );
      expect(
        (
          await member.context.request.get(`${E2E_API_BASE_URL}/skills/documents/release-playbook`)
        ).status(),
      ).toBe(404);
      const feedback = await member.context.request.post(feedbackUrl, {
        headers,
        data: { verdict: "good", conversationId },
      });

      await requireSuccessfulResponse(feedback, "Record another member's verdict");
      const finalResponse = await page.request.get(catalogUrl);

      await requireSuccessfulResponse(finalResponse, "Read combined scorecard");
      const final = capabilityCatalogResponseSchema.parse(await finalResponse.json());

      expect(final.teammates.find((item) => item.id === teammate.id)?.scorecard).toEqual({
        good: 1,
        bad: 1,
      });
    } finally {
      await member.context.close();
    }

    const updated = await page.request.put(`${E2E_API_BASE_URL}/teammates/${teammate.id}`, {
      headers,
      data: { kind: "bot", enabled_tools: ["create_task", "store_memory"] },
    });

    await requireSuccessfulResponse(updated, "Convert colleague into bot");
    const bot = teammateResponseSchema.parse(await updated.json());

    expect(bot.kind).toBe("bot");
    expect(bot.enabled_tools).toEqual(expect.arrayContaining(["create_task", "store_memory"]));
    const repeated = await page.request.put(`${E2E_API_BASE_URL}/teammates/${teammate.id}`, {
      headers,
      data: { enabled_tools: ["create_task", "store_memory"] },
    });

    await requireSuccessfulResponse(repeated, "Keep bot tools on later edits");
    const retained = teammateResponseSchema.parse(await repeated.json());

    expect(retained.enabled_tools).toEqual(["create_task", "store_memory"]);
  });
});
