import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import {
  BOUNDED_LOG_SANDBOX_ENVIRONMENT,
  INVALID_SERVICE_SANDBOX_ENVIRONMENTS,
  OCCUPIED_PORT_SANDBOX_ENVIRONMENT,
  UNHEALTHY_SANDBOX_ENVIRONMENT,
} from "../fixtures/sandbox-environment";
import { SandboxPreviewPage } from "../page-objects/SandboxPreviewPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox service controls", () => {
  test.use({ persona: "pro" });

  test("rejects invalid service declarations at the project boundary", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());

    await sandbox.configureProject();

    const responses = await Promise.all(
      INVALID_SERVICE_SANDBOX_ENVIRONMENTS.map(({ setup }) => sandbox.saveEnvironment(setup)),
    );
    const responseBodies = await Promise.all(responses.map((response) => response.text()));

    responses.forEach((response, index) => {
      const scenario = INVALID_SERVICE_SANDBOX_ENVIRONMENTS[index];

      if (!scenario) {
        throw new Error(`Missing invalid service scenario ${index}`);
      }

      expect(response.status(), scenario.name).toBe(400);
      expect(responseBodies[index], scenario.name).toMatch(scenario.error);
    });
  });

  for (const scenario of [
    {
      name: "occupied declared port",
      environment: OCCUPIED_PORT_SANDBOX_ENVIRONMENT,
      eventType: "service_failed",
      error: /port 4000.*already in use/i,
    },
    {
      name: "unhealthy endpoint",
      environment: UNHEALTHY_SANDBOX_ENVIRONMENT,
      eventType: "service_start_timed_out",
      error: /did not become ready within 15000ms/i,
    },
  ]) {
    test(`fails before agent work for an ${scenario.name}`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject(scenario.environment);
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Polychat sandbox E2E: review a failed service startup.");
      if (scenario.name === "unhealthy endpoint") {
        await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
        const liveRun = await sandbox.latestRun();

        if (!liveRun) {
          throw new Error("The unhealthy service run was not created");
        }

        await expect
          .poll(
            async () =>
              (await sandbox.events(liveRun.runId)).some(
                ({ event }) => event.type === "service_starting",
              ),
            { timeout: 30_000 },
          )
          .toBe(true);
        await workbench.selectPane("Preview");
        await expect(workbench.panel).toContainText("Service starting");
      }

      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
        .toBe("failed");
      const run = await sandbox.latestRun();

      expect(run?.error ?? run?.result?.error).toMatch(scenario.error);
      if (!run) {
        throw new Error("The failed service run was not retained");
      }

      const events = await sandbox.events(run.runId);

      expect(events.some(({ event }) => event.type === scenario.eventType)).toBe(true);
      expect(events.some(({ event }) => event.type === "planning_started")).toBe(false);
      await workbench.selectPane("Preview");
      await expect(workbench.panel).toContainText("Service unhealthy");
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText("failed");
      await workbench.reload();
      await expect(workbench.panel).toContainText("failed");
    });
  }

  for (const scenario of [
    {
      name: "never after failure",
      exitCode: 1,
      restartPolicy: { mode: "never", maxRestarts: 0, backoffSeconds: 1 },
      restartCount: 0,
    },
    {
      name: "on_failure after a clean exit",
      exitCode: 0,
      restartPolicy: { mode: "on_failure", maxRestarts: 3, backoffSeconds: 1 },
      restartCount: 0,
    },
    {
      name: "always after a clean exit",
      exitCode: 0,
      restartPolicy: { mode: "always", maxRestarts: 2, backoffSeconds: 1 },
      restartCount: 2,
    },
    {
      name: "on_failure up to its cap",
      exitCode: 1,
      restartPolicy: { mode: "on_failure", maxRestarts: 3, backoffSeconds: 1 },
      restartCount: 3,
    },
  ] satisfies Array<{
    name: string;
    exitCode: number;
    restartPolicy:
      | { mode: "never"; maxRestarts: 0; backoffSeconds: number }
      | { mode: "on_failure" | "always"; maxRestarts: number; backoffSeconds: number };
    restartCount: number;
  }>) {
    test(`applies ${scenario.name}`, async ({ page, workPage, homePage }) => {
      test.setTimeout(120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject({
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: ["node --version"],
          resumeCommands: [],
          runtimes: [],
          setupTimeoutSeconds: 30,
          services: [
            {
              name: "policy",
              workingDirectory: ".",
              command: `node exit.cjs ${scenario.exitCode}`,
              dependencies: [],
              startupTimeoutSeconds: 10,
              restartPolicy: scenario.restartPolicy,
            },
          ],
        },
      });
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessage("Polychat sandbox E2E: wait for controls during service review.");
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
        .toBe("failed");
      const run = await sandbox.latestRun();

      if (!run) {
        throw new Error("The restart-policy run was not retained");
      }

      expect(
        (await sandbox.events(run.runId)).filter(
          ({ event }) => event.type === "service_restarting" && event.serviceName === "policy",
        ),
      ).toHaveLength(scenario.restartCount);
      expect(run.manifest?.services?.find(({ name }) => name === "policy")?.restartCount).toBe(
        scenario.restartCount,
      );
      await workbench.reload();
      await workbench.selectPane("Proof");
      if (scenario.restartCount === 0) {
        await expect(workbench.proofService("policy")).not.toContainText(/restarts?/i);
      } else {
        await expect(workbench.proofService("policy")).toContainText(
          `${scenario.restartCount} ${scenario.restartCount === 1 ? "restart" : "restarts"}`,
        );
      }
    });
  }

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
    await workbench.reload();
    await expect(workbench.service("fixture")).toContainText("Healthy");
    const watcherLog = workbench.serviceOutput("watcher");

    await expect(watcherLog.output).toBeHidden();
    await watcherLog.toggle.click();
    await expect(watcherLog.output).toBeVisible();
    await expect(watcherLog.output).toContainText("E2E_WATCHER_READY");
    await workbench.reload();
    await expect(workbench.service("fixture")).toContainText("Healthy");
    await expect(workbench.serviceOutput("watcher").output).toBeHidden();
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
    await workbench.reload();
    await expect(workbench.service("watcher")).toContainText("Running");
    await expect(workbench.service("watcher")).not.toContainText("Port");
    await expect(
      page.getByRole("region", { name: "Project services", exact: true }),
    ).not.toContainText(/container|process id|terminal/i);
    expect((await preview.open(new URL(access.url).origin))?.status()).toBeGreaterThanOrEqual(400);
    await expect(preview.serviceHeading).not.toBeVisible();
    await workbench.controlService("fixture", "Stop");
    await expect(workbench.service("fixture")).toContainText("Stopped");
    expect((await sandbox.createPreview(run.runId, "fixture")).status()).toBe(409);
    await workbench.selectPane("Preview");
    await expect(workbench.panel).toContainText("Preview stopped");
    await workbench.selectPane("Activity");
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
