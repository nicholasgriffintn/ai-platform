import { projectDetailSchema, teammateResponseSchema } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

test.describe("Workspace teammate defaults", () => {
  test.use({ persona: "pro" });

  test("inherits into old and new projects, removes locally and restores without duplicates", async ({
    page,
    workPage,
    capabilitiesPage,
    polychatApi,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const workspaceId = workPage.currentWorkspaceId();
    const firstProjectId = workPage.currentProjectId();
    const headers = { origin: E2E_APP_BASE_URL };
    const created = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers,
      data: {
        name: "Inherited release colleague",
        workspace_id: workspaceId,
        workspace_default: true,
        system_prompt: "Review release evidence.",
      },
    });

    await requireSuccessfulResponse(created, "Create workspace default teammate");
    const teammate = teammateResponseSchema.parse(await created.json());

    expect(teammate).toMatchObject({
      owner_scope_type: "workspace",
      owner_scope_id: workspaceId,
      workspace_default: true,
    });
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${firstProjectId}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(1);
    const projectResponse = await page.request.post(
      `${E2E_API_BASE_URL}/workspaces/${workspaceId}/projects`,
      { headers, data: { name: "Later release project" } },
    );

    await requireSuccessfulResponse(projectResponse, "Create project after workspace default");
    const secondProject = projectDetailSchema.parse(await projectResponse.json());

    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${secondProject.id}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(1);
    const removed = await page.request.post(
      `${E2E_API_BASE_URL}/teammates/${teammate.id}/projects/${firstProjectId}/remove`,
      { headers },
    );

    await requireSuccessfulResponse(removed, "Remove inherited teammate from one project");
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${firstProjectId}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(0);
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${secondProject.id}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(1);
    expect(await polychatApi.listTeammates()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: teammate.id })]),
    );
    const restored = await page.request.post(
      `${E2E_API_BASE_URL}/teammates/${teammate.id}/projects/${firstProjectId}/restore`,
      { headers },
    );

    await requireSuccessfulResponse(restored, "Restore inherited teammate");
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${firstProjectId}/teammates`);
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(1);
    expect(
      (await polychatApi.addProjectCapability(firstProjectId, "teammate", teammate.id)).status,
    ).toBe(200);
    await capabilitiesPage.reload();
    await expect(capabilitiesPage.capabilityCard(teammate.name)).toHaveCount(1);
    const directResponse = await page.request.post(`${E2E_API_BASE_URL}/teammates`, {
      headers,
      data: { name: "Direct release colleague", workspace_id: workspaceId },
    });

    await requireSuccessfulResponse(directResponse, "Create directly attached teammate");
    const direct = teammateResponseSchema.parse(await directResponse.json());

    expect(
      (await polychatApi.addProjectCapability(firstProjectId, "teammate", direct.id)).status,
    ).toBe(200);
    await capabilitiesPage.reload();
    await expect(capabilitiesPage.capabilityCard(direct.name)).toHaveCount(1);
    await capabilitiesPage.navigate(`/work/${workspaceId}/projects/${secondProject.id}/teammates`);
    await expect(capabilitiesPage.capabilityCard(direct.name)).toHaveCount(0);
  });
});
