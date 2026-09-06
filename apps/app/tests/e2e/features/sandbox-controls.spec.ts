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
      const pausedEvents = await sandbox.events(run.runId);
      const scriptStartedIndex = pausedEvents.findIndex(
        ({ event }) => event.type === "script_started",
      );
      const scriptCompletedIndex = pausedEvents.findIndex(
        ({ event }) => event.type === "script_completed",
      );
      const pausedIndex = pausedEvents.findIndex(({ event }) => event.type === "run_paused");

      expect(scriptCompletedIndex).toBeGreaterThan(scriptStartedIndex);
      expect(pausedIndex).toBeGreaterThan(scriptCompletedIndex);
      await workbench.addInstruction("Keep the verified README change.");
      await workbench.selectPane("Activity");
      await expect(workbench.panel).toContainText("Keep the verified README change.");
      await expect(workbench.panel).toContainText("User instruction submitted");
      await expect
        .poll(
          async () =>
            (await sandbox.events(run.runId)).some(
              ({ event }) =>
                event.type === "run_instruction_submitted" &&
                event.instructionContent === "Keep the verified README change.",
            ),
          { timeout: 10_000 },
        )
        .toBe(true);
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
      await expect(workbench.panel).toContainText("Retain the validation evidence.");
      const modelMetrics = workbench.activityEntry("Model call · openai/gpt-oss-120b");
      const modelMetricsDetails = modelMetrics.getByText("Cost and latency").locator("..");
      const watcherOutput = workbench.serviceOutput("watcher");

      await expect(modelMetricsDetails.locator("dl")).toBeHidden();
      await modelMetricsDetails.getByText("Cost and latency").click();
      await expect(modelMetricsDetails.locator("dl")).toBeVisible();
      await expect(watcherOutput.output).toBeHidden();
      await watcherOutput.toggle.click();
      await expect(watcherOutput.output).toBeVisible();
      const beforeActiveReload = await workbench.activityTitles.allTextContents();

      await workbench.reload();
      await workbench.selectPane("Activity");
      await expect(workbench.activityEntries).toHaveCount(beforeActiveReload.length);
      expect(await workbench.activityTitles.allTextContents()).toEqual(beforeActiveReload);
      await expect(
        workbench.activityEntry("Model call · openai/gpt-oss-120b").locator("dl"),
      ).toBeHidden();
      await expect(workbench.serviceOutput("watcher").output).toBeHidden();
      await expect(workbench.composer).toBeEditable();
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
        const submittedIndex = completedEvents.findIndex(
          ({ event }) =>
            event.type === "run_instruction_submitted" &&
            event.instructionContent === "Keep the verified README change.",
        );
        const instructionId = completedEvents[submittedIndex]?.event.instructionId;
        const receivedIndex = completedEvents.findIndex(
          ({ event }) =>
            event.type === "run_instruction_received" && event.instructionId === instructionId,
        );

        expect(submittedIndex).toBeGreaterThanOrEqual(0);
        expect(receivedIndex).toBeGreaterThan(submittedIndex);
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
      if (action === "Resume") {
        await expect(workbench.panel).toContainText("User instruction received");
        await expect(workbench.panel).toContainText("Quality gate completed");
        const titles = await workbench.activityTitles.allTextContents();
        const orderedTitles = [
          "User instruction",
          "Model call · openai/gpt-oss-120b",
          "Tool called · run_sandbox_task",
          "Run queued",
          "Plan created",
          "Script execution completed",
          "User instruction submitted",
          "User instruction received",
          "Validation started",
          "Quality gate completed",
        ];

        for (let index = 1; index < orderedTitles.length; index += 1) {
          expect(titles.indexOf(orderedTitles[index] ?? "")).toBeGreaterThan(
            titles.indexOf(orderedTitles[index - 1] ?? ""),
          );
        }

        await expect(
          workbench
            .activityEntry("Setup 1/1 · node --version")
            .getByText(/^Duration (?:\d+ms|\d+\.\d+s)$/),
        ).toBeVisible();
        await expect(workbench.activityEntry("Run queued")).not.toContainText("Duration");
      } else {
        await expect(workbench.activityEntry("Cancellation requested")).toBeVisible();
        await expect(workbench.activityEntry("Run cancelled")).toContainText("Cancelled");
        const titles = await workbench.activityTitles.allTextContents();

        expect(titles.indexOf("Run cancelled")).toBeGreaterThan(
          titles.indexOf("Cancellation requested"),
        );
        await expect(
          workbench.panel.getByRole("button", { name: "Show tool arguments", exact: true }),
        ).toHaveCount(0);
        await expect(
          workbench.panel.getByRole("button", { name: "Toggle reasoning", exact: true }),
        ).toHaveCount(0);
      }

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

      await expect(workbench.controlButton("Pause")).toBeDisabled();
      await expect(workbench.controlButton("Pause")).toHaveAttribute(
        "title",
        `This run is ${action === "Resume" ? "completed" : "cancelled"} and no longer accepts actions.`,
      );
    });
  }

  test("keeps one authoritative outcome when cancellation races terminal completion", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject();
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: complete the verified README update.");
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The terminal race run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.events(run.runId)).some(
            ({ event }) => event.type === "quality_gate_completed",
          ),
        { timeout: 60_000 },
      )
      .toBe(true);
    const boundaryControl = await sandbox.control(run.runId);
    const cancellation = await sandbox.updateControl(
      run.runId,
      "cancel",
      boundaryControl.updatedAt,
    );

    expect([200, 409]).toContain(cancellation.status());
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 40_000 })
      .toMatch(/^(completed|cancelled)$/);
    const terminalStatus = (await sandbox.latestRun())?.status;

    expect(terminalStatus).toMatch(/^(completed|cancelled)$/);
    expect(
      (await sandbox.updateControl(run.runId, "pause", boundaryControl.updatedAt)).status(),
    ).toBe(409);
    expect(
      (await sandbox.submitInstruction(run.runId, "terminal-race", "Too late.")).status(),
    ).toBe(409);
    await workbench.reload();
    expect((await sandbox.latestRun())?.status).toBe(terminalStatus);
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText(terminalStatus ?? "");
  });
});
