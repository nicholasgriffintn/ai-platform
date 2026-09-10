import {
  conversationOrganisationSchema,
  workspaceAuditListResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { OutputApi } from "../fixtures/output-api";
import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { PolychatApi } from "../fixtures/polychat-api";
import { expect, test } from "../fixtures/polychat-test";
import { WorkPage } from "../page-objects/WorkPage";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Current project access across stored resources", () => {
  test.use({ persona: "pro" });

  test("fences stale organisation writes, audits restoration and revokes every related resource until membership returns", async ({
    browser,
    page,
    homePage,
    polychatApi,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const projectId = workPage.currentProjectId();
    const projectPath = new URL(page.url()).pathname;
    const headers = { origin: E2E_APP_BASE_URL };

    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    const completion = await homePage.sendMessageAndRequireCompletion(
      "Shared access boundary evidence",
    );

    await homePage.waitForChatResponse(0);
    const conversationId = homePage.completionIdFromRequest(completion);
    const run = (await polychatApi.getConversation(conversationId)).latest_run;

    if (!run) {
      throw new Error("The stored project conversation must have a run");
    }

    const output = await new OutputApi(page.request).create({
      capabilityId: "notes",
      kind: "note",
      status: "ready",
      title: "Project access evidence",
      content: { body: "Original project note" },
      projectId,
      conversationId,
    });

    expect(await polychatApi.reviseOutputStatus(output.id, "Updated project note", 1)).toBe(200);
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      const memberWork = new WorkPage(await member.context.newPage());
      const memberApi = new PolychatApi(member.context.request);
      const memberOutputs = new OutputApi(member.context.request);
      const memberUser = await memberApi.currentUser();

      if (!memberUser) {
        throw new Error("The member persona must be signed in");
      }

      await workPage.navigate(projectPath);
      await workPage.openProjectSurface("People");
      await memberWork.acceptInvitation(await workPage.createMemberInvitation(member.email));
      const organisationUrl = `${E2E_API_BASE_URL}/chat/completions/${conversationId}/organisation`;
      const organisationResponse = await member.context.request.get(organisationUrl);

      await requireSuccessfulResponse(organisationResponse, "Read member organisation");
      const organisation = conversationOrganisationSchema.parse(await organisationResponse.json());
      const pinned = await member.context.request.patch(organisationUrl, {
        headers,
        data: { expectedRevision: organisation.revision, isPinned: true },
      });

      await requireSuccessfulResponse(pinned, "Pin member conversation");
      expect(
        (
          await member.context.request.patch(organisationUrl, {
            headers,
            data: { expectedRevision: organisation.revision, isPinned: false },
          })
        ).status(),
      ).toBe(409);
      expect(await memberOutputs.historyStatus(output.id)).toBe(200);
      expect(await memberOutputs.restoreStatus(output.id, 1, 2)).toBe(403);
      const promoted = await page.request.put(
        `${E2E_API_BASE_URL}/workspaces/${workspaceId}/members/${memberUser.id}`,
        { headers, data: { role: "admin" } },
      );

      await requireSuccessfulResponse(promoted, "Grant output restoration authority");
      expect(await memberOutputs.restoreStatus(output.id, 1, 2)).toBe(200);
      const auditResponse = await page.request.get(
        `${E2E_API_BASE_URL}/workspaces/${workspaceId}/audit`,
      );

      await requireSuccessfulResponse(auditResponse, "Read restore audit");
      const audit = workspaceAuditListResponseSchema.parse(await auditResponse.json());

      expect(audit.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorUserId: memberUser.id,
            action: "output.restored",
            targetId: output.id,
            metadata: expect.objectContaining({ fromRevision: 1, toRevision: 3 }),
          }),
        ]),
      );
      const resourcePaths = [
        `/chat/completions/${conversationId}`,
        `/chat/runs/${run.id}`,
        `/chat/runs/${run.id}/snapshot`,
        `/chat/runs/${run.id}/events?after=0`,
        `/outputs/${output.id}`,
        `/outputs/${output.id}/revisions`,
        `/chat/completions/${conversationId}/organisation`,
      ];

      for (const resourcePath of resourcePaths) {
        expect(
          (await member.context.request.get(`${E2E_API_BASE_URL}${resourcePath}`)).status(),
        ).toBe(200);
      }

      const removed = await page.request.delete(
        `${E2E_API_BASE_URL}/workspaces/${workspaceId}/members/${memberUser.id}`,
        { headers },
      );

      await requireSuccessfulResponse(removed, "Revoke project membership");
      for (const resourcePath of resourcePaths) {
        const denied = await member.context.request.get(`${E2E_API_BASE_URL}${resourcePath}`);

        expect(denied.status(), resourcePath).toBe(
          resourcePath === `/chat/completions/${conversationId}` ? 403 : 404,
        );
        expect(await denied.text()).not.toContain("Shared access boundary evidence");
      }

      expect(await memberOutputs.restoreStatus(output.id, 1, 3)).toBe(404);
      expect(
        (
          await member.context.request.patch(organisationUrl, {
            headers,
            data: { expectedRevision: organisation.revision + 1, isPinned: false },
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await member.context.request.post(`${E2E_API_BASE_URL}/chat/runs/${run.id}/cancel`, {
            headers,
            data: { command_id: crypto.randomUUID(), expected_attempt: run.attempt },
          })
        ).status(),
      ).toBe(404);
      await workPage.reload();
      await memberWork.acceptInvitation(await workPage.createMemberInvitation(member.email));
      expect(await memberOutputs.historyStatus(output.id)).toBe(200);
      expect(await memberOutputs.restoreStatus(output.id, 1, 3)).toBe(403);
      const promotedAgain = await page.request.put(
        `${E2E_API_BASE_URL}/workspaces/${workspaceId}/members/${memberUser.id}`,
        { headers, data: { role: "admin" } },
      );

      await requireSuccessfulResponse(promotedAgain, "Restore admin authority");
      expect(await memberOutputs.restoreStatus(output.id, 1, 3)).toBe(200);
      const restoredOrganisation = await member.context.request.get(organisationUrl);

      await requireSuccessfulResponse(
        restoredOrganisation,
        "Read organisation after membership returns",
      );
      expect(conversationOrganisationSchema.parse(await restoredOrganisation.json()).isPinned).toBe(
        true,
      );
    } finally {
      await member.context.close();
    }
  });
});
