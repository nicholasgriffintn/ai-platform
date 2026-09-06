import { provisionPersonaBrowserContext } from "../fixtures/persona-provisioning";
import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { SUPERVISED_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { SandboxPreviewPage } from "../page-objects/SandboxPreviewPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";
import { WorkPage } from "../page-objects/WorkPage";

test.describe("Sandbox project authority", () => {
  test.use({ persona: "pro" });

  test("allows member review without runner controls and revokes preview access when membership ends", async ({
    page,
    browser,
    workPage,
    homePage,
  }) => {
    test.setTimeout(150_000);
    const member = await provisionPersonaBrowserContext(
      browser,
      "pro",
      `${test.info().testId}:member`,
    );

    try {
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const projectUrl = page.url();
      const projectId = workPage.currentProjectId();
      const sandbox = new SandboxApi(page.request, projectId);
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject(SUPERVISED_SANDBOX_ENVIRONMENT);
      await workPage.openProjectSurface("People");
      const peopleUrl = page.url();
      const invitation = await workPage.createMemberInvitation(member.email);
      const memberTab = await member.context.newPage();
      const memberWork = new WorkPage(memberTab);
      const memberWorkbench = new WorkbenchPage(memberTab);
      const memberApi = new SandboxApi(member.context.request, projectId);

      await memberWork.acceptInvitation(invitation);
      await workPage.navigate(projectUrl);
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage(
        "Polychat sandbox E2E: wait for controls while another member reviews the service.",
      );
      await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The member review run was not created");
      }

      await expect
        .poll(
          async () =>
            (await sandbox.events(run.runId)).some(({ event }) => event.type === "script_started"),
          { timeout: 30_000 },
        )
        .toBe(true);
      await workbench.control("Pause");
      await expect.poll(async () => (await sandbox.control(run.runId)).state).toBe("paused");
      const conversationUrl = page.url();

      await memberWork.navigate(conversationUrl);
      await expect(memberWorkbench.dock).toBeVisible();
      await expect(memberTab.getByRole("button", { name: "Steer", exact: true })).toBeDisabled();
      await expect(memberTab.getByRole("button", { name: "Resume", exact: true })).toBeDisabled();
      const currentControl = await sandbox.control(run.runId);

      expect(
        (await memberApi.updateControl(run.runId, "resume", currentControl.updatedAt)).status(),
      ).toBe(403);
      expect(
        (
          await memberApi.submitInstruction(
            run.runId,
            "member-steering",
            "Unauthorised instruction",
          )
        ).status(),
      ).toBe(403);
      await memberWorkbench.selectPane("Activity");
      await expect(memberWorkbench.panel).toContainText("fixture");
      await expect(
        memberTab.getByRole("button", { name: "Restart fixture", exact: true }),
      ).toBeDisabled();
      await memberWorkbench.selectPane("Preview");
      await memberWorkbench.startPreview();
      await expect(
        memberWorkbench.previewFrame.getByRole("heading", {
          name: "Sandbox service ready",
          exact: true,
        }),
      ).toBeVisible();
      await expect(memberTab.getByLabel("Feedback", { exact: true })).toBeDisabled();
      const externalAccess = await memberApi.preview(run.runId, "fixture");

      if (!externalAccess.url) {
        throw new Error("The member did not receive preview access");
      }

      const externalTab = await member.context.newPage();
      const external = new SandboxPreviewPage(externalTab);

      await external.open(externalAccess.url);
      await expect(external.serviceHeading).toBeVisible();
      await workPage.navigate(peopleUrl);
      await workPage.promoteAndRemoveMember(member.email);
      const revoked = await external.open(new URL(externalAccess.url).origin);

      expect(revoked?.status()).toBeGreaterThanOrEqual(400);
      await expect(external.serviceHeading).not.toBeVisible();
      expect((await memberApi.createPreview(run.runId, "fixture")).status()).toBe(404);
      await workPage.navigate(conversationUrl);
      await workbench.control("Cancel");
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 40_000 })
        .toBe("cancelled");
    } finally {
      await member.context.close();
    }
  });
});
