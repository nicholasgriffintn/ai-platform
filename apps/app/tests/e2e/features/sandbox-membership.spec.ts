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
      await expect(memberWorkbench.composer).toBeDisabled();
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
      const memberOutput = memberWorkbench.serviceOutput("watcher");

      await expect(memberOutput.output).toBeHidden();
      await memberOutput.toggle.click();
      await expect(memberOutput.output).toContainText("E2E_WATCHER_READY");
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
      const embeddedRevoked = await memberWorkbench.reloadPreviewDocument();
      const revoked = await external.open(new URL(externalAccess.url).origin);

      expect(embeddedRevoked === null || embeddedRevoked.status() >= 400).toBe(true);
      await expect(
        memberWorkbench.previewFrame.getByRole("heading", {
          name: "Sandbox service ready",
          exact: true,
        }),
      ).not.toBeVisible();
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

  test("keeps pending command approval evidence and resolution runner-only", async ({
    page,
    browser,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
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

      await sandbox.configureProject({
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: ["curl --version"],
          resumeCommands: [],
          runtimes: [],
          setupTimeoutSeconds: 60,
        },
      });
      await workPage.openProjectSurface("People");
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
      await homePage.sendMessage("Polychat sandbox E2E: wait for reviewed setup approval.");
      await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The member approval run was not created");
      }

      await expect
        .poll(
          async () =>
            (await sandbox.instructions(run.runId)).some(
              ({ instruction }) => instruction.kind === "approval_request",
            ),
          { timeout: 30_000 },
        )
        .toBe(true);
      const approval = (await sandbox.instructions(run.runId)).find(
        ({ instruction }) => instruction.kind === "approval_request",
      );

      if (!approval) {
        throw new Error("The member approval request was not retained");
      }

      await memberWork.navigate(page.url());
      await expect(memberWorkbench.dock).toBeVisible();
      await memberWorkbench.selectPane("Activity");
      await expect(memberWorkbench.panel).toContainText("Approval requested for network command");
      await expect(memberWorkbench.composer).toBeDisabled();
      expect(
        (
          await memberApi.respondToApproval(
            run.runId,
            approval.instruction.id,
            "approved",
            "member-approval-attempt",
          )
        ).status(),
      ).toBe(403);
      await expect(
        page.getByRole("region", { name: "Pending command approvals", exact: true }),
      ).toContainText("curl --version");
      await workbench.resolveApproval("Reject");
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
        .toBe("failed");
    } finally {
      await member.context.close();
    }
  });
});
