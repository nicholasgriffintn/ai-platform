import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { SUPERVISED_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox run supervision", () => {
  test.use({ persona: "pro" });

  for (const action of ["Resume", "Cancel"] as const) {
    test(`pauses then ${action.toLowerCase()}s the same service-backed run with idempotent steering`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject(SUPERVISED_SANDBOX_ENVIRONMENT);
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage(
        "Polychat sandbox E2E: wait for controls before completing the README update.",
      );
      await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The sandbox run was not created");
      }

      await expect
        .poll(
          async () =>
            (await sandbox.events(run.runId)).some(({ event }) => event.type === "script_started"),
          { timeout: 30_000 },
        )
        .toBe(true);
      expect(
        (await sandbox.events(run.runId)).some(({ event }) => event.type === "service_healthy"),
      ).toBe(true);
      const runningControl = await sandbox.control(run.runId);

      await workbench.control("Pause");
      await expect.poll(async () => (await sandbox.control(run.runId)).state).toBe("paused");
      await expect
        .poll(
          async () =>
            (await sandbox.events(run.runId)).some(({ event }) => event.type === "run_paused"),
          { timeout: 30_000 },
        )
        .toBe(true);
      expect(
        (await sandbox.events(run.runId)).some(
          ({ event }) => event.type === "quality_gate_started",
        ),
      ).toBe(false);
      await workbench.openSteering();
      await workbench.addInstruction("Keep the verified README change.");
      await expect(page.getByRole("dialog", { name: "Steer this run" })).toContainText(
        "Keep the verified README change.",
      );
      await page.keyboard.press("Escape");
      const key = "repeatable-sandbox-instruction";

      expect(
        (await sandbox.submitInstruction(run.runId, key, "Retain the validation evidence.")).ok(),
      ).toBe(true);
      expect(
        (await sandbox.submitInstruction(run.runId, key, "Retain the validation evidence.")).ok(),
      ).toBe(true);
      expect(
        (await sandbox.submitInstruction(run.runId, key, "Different instruction.")).status(),
      ).toBe(409);
      expect(
        (await sandbox.instructions(run.runId)).filter(
          ({ instruction }) => instruction.idempotencyKey === key,
        ),
      ).toHaveLength(1);
      await workbench.reload();
      await workbench.control(action);
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 40_000 })
        .toBe(action === "Resume" ? "completed" : "cancelled");
      const completed = await sandbox.latestRun();

      expect(completed?.runId).toBe(run.runId);
      expect(completed?.manifest?.services).toEqual([
        expect.objectContaining({ name: "watcher", status: "stopped" }),
        expect.objectContaining({ name: "fixture", status: "stopped", expectedPort: 4000 }),
      ]);
      expect(
        (await sandbox.updateControl(run.runId, "pause", runningControl.updatedAt)).status(),
      ).toBe(409);
      if (action === "Cancel") {
        const terminalControl = await sandbox.control(run.runId);

        expect(
          (await sandbox.updateControl(run.runId, "cancel", terminalControl.updatedAt)).ok(),
        ).toBe(true);
        expect(await sandbox.control(run.runId)).toEqual(terminalControl);
      }
      expect(
        (await sandbox.submitInstruction(run.runId, "after-terminal", "Too late.")).status(),
      ).toBe(409);
      const completedEvents = await sandbox.events(run.runId);

      if (action === "Resume") {
        expect(completedEvents.some(({ event }) => event.type === "run_instruction_received")).toBe(
          true,
        );
      }
      expect(completedEvents.some(({ event }) => event.type === "service_stopped")).toBe(true);
      expect(
        completedEvents
          .filter(({ event }) => event.type === "service_starting")
          .map(({ event }) => event.serviceName),
      ).toEqual(["watcher", "fixture"]);
      expect(
        completedEvents
          .filter(({ event }) => event.type === "service_stopped")
          .map(({ event }) => event.serviceName),
      ).toEqual(["fixture", "watcher"]);
      await workbench.selectPane("Activity");
      await expect(workbench.panel).toContainText("Keep the verified README change.");
      await workbench.reload();
      await expect(workbench.panel).toContainText("Keep the verified README change.");
      expect((await sandbox.latestRun())?.status).toBe(
        action === "Resume" ? "completed" : "cancelled",
      );
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText(action === "Resume" ? "completed" : "cancelled");
      if (action === "Cancel") {
        await expect(workbench.panel).toContainText(
          "The run ended before the objective was completed.",
        );
      }
    });
  }
});
