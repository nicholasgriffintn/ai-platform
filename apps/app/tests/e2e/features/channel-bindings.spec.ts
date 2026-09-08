import {
  channelBindingSchema,
  listChannelBindingsResponseSchema,
  teammateResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { WorkPage } from "../page-objects/WorkPage";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Channel binding scope and lifecycle", () => {
  test.use({ persona: "pro" });

  test("keeps project binding admin-only, rejects duplicates and disconnects without affecting another scope", async ({
    browser,
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectId = workPage.currentProjectId();
    const workspaceId = workPage.currentWorkspaceId();
    const endpoint = `${E2E_API_BASE_URL}/channels/bindings`;
    const headers = { origin: E2E_APP_BASE_URL };
    const externalId = `C-${crypto.randomUUID()}`;
    const data = { channel: "slack", externalId, projectId };
    const created = await page.request.post(endpoint, { headers, data });

    await requireSuccessfulResponse(created, "Bind project channel");
    const binding = channelBindingSchema.parse(await created.json());

    expect(binding).toMatchObject({ scopeType: "project", scopeId: projectId, externalId });
    expect((await page.request.post(endpoint, { headers, data })).status()).toBe(409);
    expect(
      (
        await page.request.post(endpoint, {
          headers,
          data: { ...data, channel: "telegram", externalId: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(400);
    const personalResponse = await page.request.post(endpoint, {
      headers,
      data: { channel: "telegram", externalId: crypto.randomUUID() },
    });

    await requireSuccessfulResponse(personalResponse, "Bind personal Telegram chat");
    const personal = channelBindingSchema.parse(await personalResponse.json());

    expect(personal.scopeType).toBe("personal");
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      const memberPage = new WorkPage(await member.context.newPage());

      await workPage.openProjectSurface("People");
      const inviteUrl = await workPage.createMemberInvitation(member.email);

      expect(
        (
          await member.context.request.post(endpoint, {
            headers,
            data: { ...data, externalId: crypto.randomUUID() },
          })
        ).status(),
      ).toBe(404);
      await memberPage.acceptInvitation(inviteUrl);
      expect(
        (
          await member.context.request.post(endpoint, {
            headers,
            data: { ...data, externalId: crypto.randomUUID() },
          })
        ).status(),
      ).toBe(403);
      const teammateResponse = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
        headers,
        data: {
          name: "Protected workspace default",
          workspace_id: workspaceId,
          workspace_default: true,
        },
      });

      await requireSuccessfulResponse(
        teammateResponse,
        "Create default for member authority check",
      );
      const teammate = teammateResponseSchema.parse(await teammateResponse.json());

      for (const action of ["remove", "restore"]) {
        expect(
          (
            await member.context.request.post(
              `${E2E_API_BASE_URL}/teammates/${teammate.id}/projects/${projectId}/${action}`,
              { headers },
            )
          ).status(),
        ).toBe(403);
      }

      const removed = await page.request.delete(`${endpoint}/${binding.id}`, { headers });

      await requireSuccessfulResponse(removed, "Disconnect project channel");
      const listed = await page.request.get(endpoint);

      await requireSuccessfulResponse(listed, "List remaining bindings");
      const bindings = listChannelBindingsResponseSchema.parse(await listed.json()).bindings;

      expect(bindings.map((entry) => entry.id)).not.toContain(binding.id);
      expect(bindings.map((entry) => entry.id)).toContain(personal.id);
    } finally {
      await member.context.close();
    }
  });
});
