import { findProjectStarter } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { E2E_API_BASE_URL } from "../support/environment";

const STARTER = findProjectStarter("build-an-internal-tool");

test.describe("Starting a project with its teammates hired", () => {
  test.use({ persona: "pro" });

  test("hires the teammate the starter names and refuses an unknown slug", async ({
    page,
    polychatApi,
    workPage,
  }) => {
    if (!STARTER) {
      throw new Error("The internal tool starter must exist");
    }

    await workPage.open();
    await workPage.openWorkspace("Release Workspace");
    await workPage.openProjectSurface("Governance");

    const starters = page.getByRole("heading", { name: "Starters", exact: true });

    await expect(starters).toBeVisible();
    const card = page
      .getByRole("heading", { name: STARTER.name, exact: true })
      .locator("xpath=ancestor::div[.//button][1]");

    await expect(card).toContainText(STARTER.when);
    await expect(card).toContainText("Hires Developer");

    await page.getByRole("button", { name: `Start ${STARTER.name}`, exact: true }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expect(page.getByRole("heading", { name: STARTER.name, exact: true })).toBeVisible();

    const projectId = workPage.currentProjectId();

    await workPage.openProjectSettings();
    await expect(
      page
        .getByRole("heading", { name: "Project brief", exact: true })
        .locator("xpath=ancestor::section[1]"),
    ).toContainText("builds small internal tools");
    await expect(
      page
        .getByRole("heading", { name: "Teammates", exact: true })
        .locator("xpath=ancestor::section[1]"),
    ).toContainText(/[1-9]\d* enabled for this project/);

    await workPage.leaveProjectSettings();
    await workPage.searchProjectCapabilities("Developer");
    await expect(
      page.getByRole("heading", { name: "Developer", exact: true }).first(),
    ).toBeVisible();

    const capabilityIds = await polychatApi.getProjectCapabilityIds(projectId);

    for (const tool of STARTER.tools) {
      expect(capabilityIds, `${tool} must be enabled on the starter project`).toContain(tool);
    }

    const refused = await page.request.post(
      `${E2E_API_BASE_URL}/templates/starters/not-a-starter/instantiate`,
      {
        headers: { origin: new URL(page.url()).origin },
        data: { workspaceId: workPage.currentWorkspaceId() },
      },
    );

    expect(refused.status()).toBe(404);
  });
});
