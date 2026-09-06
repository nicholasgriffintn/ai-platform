import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { BOUNDED_LOG_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { SandboxPreviewPage } from "../page-objects/SandboxPreviewPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox service controls", () => {
  test.use({ persona: "pro" });

  test("restarts dependencies in order and applies stop and start instructions once", async ({
    page,
    context,
    workPage,
    homePage,
  }) => {
    test.setTimeout(180_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(BOUNDED_LOG_SANDBOX_ENVIRONMENT);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage("Polychat sandbox E2E: wait for controls during service review.");
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The service control run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.events(run.runId)).some(({ event }) => event.type === "script_started"),
        { timeout: 30_000 },
      )
      .toBe(true);
    await workbench.selectPane("Activity");
    await expect(workbench.service("watcher")).toContainText("Running");
    await expect(workbench.service("fixture")).toContainText("Healthy");
    await expect
      .poll(
        async () =>
          (await sandbox.events(run.runId)).some(
            ({ event }) =>
              event.type === "service_log" && event.output?.includes("E2E_WATCHER_READY"),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    const startedEvents = await sandbox.events(run.runId);
    const serviceLogs = startedEvents.filter(({ event }) => event.type === "service_log");

    expect(serviceLogs).not.toHaveLength(0);
    expect(serviceLogs).toHaveLength(1);
    expect(serviceLogs[0]?.event.output?.length).toBeLessThanOrEqual(2_000);
    expect(startedEvents.some(({ event }) => event.type === "service_log_truncated")).toBe(true);
    expect(JSON.stringify(startedEvents)).not.toMatch(/container|processId|sandboxId/i);
    const watcherLog = workbench.serviceLog("watcher", "stdout");

    await expect(watcherLog.output).toBeHidden();
    await watcherLog.toggle.click();
    await expect(watcherLog.output).toBeVisible();
    await expect(watcherLog.output).toContainText("E2E_WATCHER_READY");
    await workbench.reload();
    await expect(workbench.service("fixture")).toContainText("Healthy");
    await expect(workbench.serviceLog("watcher", "stdout").output).toBeHidden();
    const access = await sandbox.preview(run.runId, "fixture");

    if (!access.url) {
      throw new Error("The healthy service did not provide preview access");
    }

    const previewTab = await context.newPage();
    const preview = new SandboxPreviewPage(previewTab);

    await preview.open(access.url);
    await expect(preview.serviceHeading).toBeVisible();
    await workbench.controlService("watcher", "Restart");
    await expect
      .poll(
        async () =>
          (await sandbox.events(run.runId)).some(
            ({ event }) =>
              event.type === "service_action_completed" && event.serviceAction === "restart",
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    const restarted = await sandbox.events(run.runId);

    expect(
      restarted
        .filter(({ event }) => event.type === "service_starting")
        .map(({ event }) => event.serviceName),
    ).toEqual(["watcher", "fixture", "watcher", "fixture"]);
    expect(
      restarted
        .filter(({ event }) => event.type === "service_stopped")
        .map(({ event }) => event.serviceName),
    ).toEqual(["fixture", "watcher"]);
    expect((await preview.open(new URL(access.url).origin))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await workbench.controlService("fixture", "Stop");
    await expect(workbench.service("fixture")).toContainText("Stopped");
    expect((await sandbox.createPreview(run.runId, "fixture")).status()).toBe(409);
    await workbench.controlService("fixture", "Start");
    await expect(workbench.service("fixture")).toContainText("Healthy");
    const start = (await sandbox.instructions(run.runId)).find(
      ({ instruction }) =>
        instruction.kind === "service_action" && instruction.serviceAction === "start",
    );

    if (!start?.instruction.idempotencyKey) {
      throw new Error("The service start did not retain its idempotency key");
    }

    expect(
      (
        await sandbox.submitServiceAction(
          run.runId,
          "fixture",
          "start",
          start.instruction.idempotencyKey,
        )
      ).ok(),
    ).toBe(true);
    expect(
      (
        await sandbox.submitServiceAction(
          run.runId,
          "fixture",
          "stop",
          start.instruction.idempotencyKey,
        )
      ).status(),
    ).toBe(409);
    await workbench.control("Cancel");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 70_000 })
      .toBe("cancelled");
    const completed = await sandbox.events(run.runId);

    expect(
      completed
        .filter(({ event }) => event.type === "service_action_completed")
        .map(({ event }) => event.serviceAction),
    ).toEqual(["restart", "stop", "start"]);
    expect(completed.filter(({ event }) => event.type === "service_action_rejected")).toHaveLength(
      0,
    );
    await workbench.reload();
    await expect(workbench.service("watcher")).toContainText("Stopped");
    await expect(workbench.service("fixture")).toContainText("Stopped");
  });
});
