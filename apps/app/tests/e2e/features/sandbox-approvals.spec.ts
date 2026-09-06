import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox command approval", () => {
  test.use({ persona: "pro" });

  for (const action of ["Approve", "Reject", "Expire"] as const) {
    test(`${action.toLowerCase()}s the exact setup command before execution and prevents a second resolution`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(action === "Expire" ? 210_000 : 120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject(
        {
          source: "polychat",
          definition: {
            version: 1,
            setupCommands: ["curl --version"],
            resumeCommands: [],
            runtimes: [],
            setupTimeoutSeconds: 60,
          },
        },
        action === "Expire" ? 300 : 120,
      );
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage(
        "Polychat sandbox E2E: update README after the reviewed setup command.",
      );
      await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The approval run was not created");
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
        throw new Error("The setup command did not request approval");
      }

      expect(approval.instruction.command).toContain("curl --version");
      expect(approval.instruction.approvalStatus).toBe("pending");
      expect(
        (await sandbox.events(run.runId)).some(
          ({ event }) => event.type === "environment_setup_command_started",
        ),
      ).toBe(false);
      await workbench.openSteering();
      await expect(
        page.getByRole("region", { name: "Pending command approvals", exact: true }),
      ).toContainText("curl --version");
      if (action === "Expire") {
        await expect
          .poll(
            async () =>
              (await sandbox.instructions(run.runId)).find(
                ({ instruction }) => instruction.id === approval.instruction.id,
              )?.instruction.approvalStatus,
            { timeout: 45_000 },
          )
          .toBe("escalated");
      } else {
        await workbench.resolveApproval(action);
      }
      await expect
        .poll(
          async () =>
            (await sandbox.instructions(run.runId)).find(
              ({ instruction }) => instruction.id === approval.instruction.id,
            )?.instruction.approvalStatus,
          { timeout: action === "Expire" ? 130_000 : 5_000 },
        )
        .toBe(action === "Approve" ? "approved" : action === "Expire" ? "timed_out" : "rejected");
      await page.keyboard.press("Escape");
      expect(
        (
          await sandbox.respondToApproval(
            run.runId,
            approval.instruction.id,
            action === "Approve" ? "rejected" : "approved",
            "second-approval-resolution",
          )
        ).status(),
      ).toBe(409);
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
        .toBe(action === "Approve" ? "completed" : "failed");
      const events = await sandbox.events(run.runId);

      if (action === "Expire") {
        expect(events.some(({ event }) => event.type === "command_approval_escalated")).toBe(true);
        expect(events.some(({ event }) => event.type === "command_approval_timed_out")).toBe(true);
      }
      expect(events.some(({ event }) => event.type === "environment_setup_command_started")).toBe(
        action === "Approve",
      );
      expect(events.some(({ event }) => event.type === "planning_started")).toBe(
        action === "Approve",
      );
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText(action === "Approve" ? "completed" : "failed");
      await workbench.reload();
      await expect(workbench.panel).toContainText(action === "Approve" ? "completed" : "failed");
    });
  }
});
