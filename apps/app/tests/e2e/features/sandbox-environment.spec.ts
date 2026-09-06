import type { SandboxRuntimeRequirement } from "@ngriffin_uk/polychat-schemas";

import { expect, test } from "../fixtures/polychat-test";
import { SANDBOX_E2E_REPOSITORIES, SandboxApi } from "../fixtures/sandbox-api";
import { ProjectEnvironmentPage } from "../page-objects/ProjectEnvironmentPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Project sandbox environment", () => {
  test.use({ persona: "pro" });

  test("persists editable setup, runs it before planning and removes it without disconnecting", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectUrl = page.url();
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const environment = new ProjectEnvironmentPage(page);
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject();
    await environment.reload();
    await environment.edit();
    await environment.configureSetup();
    await environment.save();
    await environment.reload();
    await environment.edit();
    await expect(page.getByLabel("Environment setup", { exact: true })).toHaveValue("polychat");
    await expect(page.getByLabel("Runtime", { exact: true })).toHaveValue("node");
    await expect(page.getByLabel("Runtime version", { exact: true })).toHaveValue("22");
    await expect(page.getByLabel("Package manager", { exact: true })).toHaveValue("npm");
    await expect(page.getByLabel("Setup timeout (seconds)", { exact: true })).toHaveValue("60");
    await expect(
      page
        .getByRole("group", { name: "Full setup", exact: true })
        .getByLabel("Command 1", { exact: true }),
    ).toHaveValue("node -e \"console.log('E2E_SETUP_READY')\"");
    await expect(
      page
        .getByRole("group", { name: "Lightweight resume", exact: true })
        .getByLabel("Command 1", { exact: true }),
    ).toHaveValue("node -e \"console.log('E2E_RESUME_READY')\"");
    await environment.cancelEdit();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update the fixture after environment setup.",
    );
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
      .toMatch(/^(completed|failed|cancelled)$/);
    const run = await sandbox.latestRun();

    expect(run?.status, run?.error).toBe("completed");
    expect(run?.manifest?.environment).toMatchObject({
      source: "polychat",
      status: "completed",
      preparationMode: "setup",
      runtimes: [{ name: "node", version: "22" }],
      packageManager: { name: "npm" },
    });
    expect(run?.manifest?.environment?.configurationRevision).toBeTruthy();
    if (!run) {
      throw new Error("The configured project did not produce a sandbox run");
    }

    const events = await sandbox.events(run.runId);
    const eventTypes = events.map(({ event }) => event.type);

    expect(eventTypes).toContain("environment_setup_completed");
    expect(eventTypes.indexOf("environment_setup_completed")).toBeLessThan(
      eventTypes.indexOf("planning_started"),
    );
    expect(
      events.some(
        ({ event }) =>
          event.type === "environment_setup_command_output" &&
          event.output?.includes("E2E_SETUP_READY"),
      ),
    ).toBe(true);
    expect(
      events
        .filter(({ event }) => event.type === "environment_setup_command_output")
        .every(({ event }) => (event.output?.length ?? 0) <= 4_000),
    ).toBe(true);
    await workbench.selectPane("Activity");
    await expect(workbench.panel).toContainText("Environment configuration resolved");
    await expect(workbench.panel).toContainText("Setup 1/1");
    await expect(workbench.panel).toContainText("Environment prepared");
    await expect(workbench.panel).toContainText("Planning started");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText("Project configuration");
    await expect(workbench.panel).toContainText(
      run.manifest?.environment?.configurationRevision.slice(0, 12) ?? "",
    );
    await expect(workbench.panel).toContainText("setup");
    await expect(workbench.panel).toContainText(/Duration:\s*\d+\.\d+s/);
    await expect(workbench.panel).toContainText("node 22");
    await environment.navigate(projectUrl);
    await environment.edit();
    await environment.removeSetup();
    await environment.reload();
    await environment.edit();
    await expect(page.getByLabel("Environment setup", { exact: true })).toHaveValue("none");
    await expect(page.getByLabel("GitHub repository", { exact: true })).not.toHaveValue("");
  });

  test("keeps the queued setup revision while a later run uses the saved replacement", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(180_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);
    const replacementMarker = "E2E_REPLACEMENT_SETUP_READY";

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
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessage(
      "Polychat sandbox E2E: update README with the queued environment revision.",
    );
    await expect.poll(async () => (await sandbox.latestRun())?.runId).toBeTruthy();
    const queuedRun = await sandbox.latestRun();

    if (!queuedRun) {
      throw new Error("The queued environment run was not created");
    }

    await expect
      .poll(
        async () =>
          (await sandbox.instructions(queuedRun.runId)).some(
            ({ instruction }) => instruction.kind === "approval_request",
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    const queuedResolution = (await sandbox.events(queuedRun.runId)).find(
      ({ event }) => event.type === "environment_configuration_resolved",
    )?.event.configurationRevision;

    expect(queuedResolution).toBeTruthy();
    const replacement = await sandbox.saveEnvironment({
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: [`node -e "console.log('${replacementMarker}')"`],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 60,
      },
    });

    expect(replacement.status()).toBe(200);
    await workbench.resolveApproval("Approve");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
      .toBe("completed");
    const completedQueuedRun = await sandbox.latestRun();

    expect(completedQueuedRun?.runId).toBe(queuedRun.runId);
    expect(completedQueuedRun?.manifest?.environment?.configurationRevision).toBe(queuedResolution);
    const queuedEvents = await sandbox.events(queuedRun.runId);

    expect(
      queuedEvents.some(
        ({ event }) =>
          event.type === "environment_setup_command_started" &&
          event.command?.includes("curl --version"),
      ),
    ).toBe(true);
    expect(JSON.stringify(queuedEvents)).not.toContain(replacementMarker);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update README with the replacement environment revision.",
    );
    await expect
      .poll(
        async () => {
          const current = await sandbox.latestRun();

          return current?.runId !== queuedRun.runId ? current?.status : null;
        },
        { timeout: 90_000 },
      )
      .toBe("completed");
    const laterRun = await sandbox.latestRun();

    expect(laterRun?.manifest?.environment?.configurationRevision).toBeTruthy();
    expect(laterRun?.manifest?.environment?.configurationRevision).not.toBe(queuedResolution);
    if (!laterRun) {
      throw new Error("The replacement environment run was not recorded");
    }

    const laterEvents = await sandbox.events(laterRun.runId);

    expect(JSON.stringify(laterEvents)).toContain(replacementMarker);
    expect(JSON.stringify(laterEvents)).not.toContain("curl --version");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText(
      laterRun.manifest?.environment?.configurationRevision.slice(0, 12) ?? "",
    );
  });

  test("loads the repository definition from the cloned revision and records a later blob", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(180_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);
    const revisions: Array<{ base: string; configuration: string }> = [];

    for (const scenario of [
      {
        repository: SANDBOX_E2E_REPOSITORIES.base,
        marker: "E2E_REPOSITORY_SETUP_V1",
      },
      {
        repository: SANDBOX_E2E_REPOSITORIES.revised,
        marker: "E2E_REPOSITORY_SETUP_V2",
      },
    ]) {
      const previousRunId = (await sandbox.latestRun())?.runId;

      await sandbox.configureProject({ source: "repository" }, 120, scenario.repository);
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessageAndRequireCompletion(
        `Polychat sandbox E2E: use ${scenario.repository} and update README after repository setup.`,
      );
      await expect
        .poll(
          async () => {
            const current = await sandbox.latestRun();

            return current?.runId !== previousRunId ? current?.status : null;
          },
          { timeout: 90_000 },
        )
        .toBe("completed");
      const run = await sandbox.latestRun();

      expect(run?.manifest?.environment).toMatchObject({
        source: "repository",
        configurationPath: ".polychat/environment.json",
        preparationMode: "setup",
        status: "completed",
        runtimes: [{ name: "node", version: "22" }],
        packageManager: { name: "npm" },
      });
      expect(run?.manifest?.repository.baseRevision).toMatch(/^[a-f0-9]{40}$/);
      expect(run?.manifest?.environment?.configurationRevision).toMatch(/^[a-f0-9]{40}$/);
      if (!run?.manifest?.repository.baseRevision || !run.manifest.environment) {
        throw new Error("Repository setup proof did not retain both revisions");
      }

      const events = await sandbox.events(run.runId);

      expect(JSON.stringify(events)).toContain(scenario.marker);
      expect(
        events.find(({ event }) => event.type === "environment_configuration_resolved")?.event,
      ).toMatchObject({
        configurationSource: "repository",
        configurationPath: ".polychat/environment.json",
        configurationRevision: run.manifest.environment.configurationRevision,
      });
      revisions.push({
        base: run.manifest.repository.baseRevision,
        configuration: run.manifest.environment.configurationRevision,
      });
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText(".polychat/environment.json");
      await expect(workbench.panel).toContainText(
        run.manifest.environment.configurationRevision.slice(0, 12),
      );
    }

    expect(revisions).toHaveLength(2);
    expect(revisions[1]?.base).not.toBe(revisions[0]?.base);
    expect(revisions[1]?.configuration).not.toBe(revisions[0]?.configuration);
  });

  test("rejects inline credentials and redacts secret-shaped setup output", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const environment = new ProjectEnvironmentPage(page);
    const workbench = new WorkbenchPage(page);
    const credential = "sk_e2e_validation_fixture_only";

    await sandbox.configureProject();
    await environment.reload();
    await environment.edit();
    await environment.configureSetup();
    await page
      .getByRole("group", { name: "Full setup", exact: true })
      .getByLabel("Command 1", { exact: true })
      .fill(`node -e "console.log('${credential}')"`);
    await expect(page.getByRole("button", { name: "Save repository", exact: true })).toBeDisabled();
    const rejected = await sandbox.saveEnvironment({
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: [`node -e "console.log('${credential}')"`],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
      },
    });

    expect(rejected.status()).toBe(400);
    expect((await sandbox.project()).codingEnvironment?.environmentSetup).toBeUndefined();
    await environment.cancelEdit();
    await sandbox.configureProject({
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: ["node -e \"console.log('sk_' + 'e2e_validation_fixture_only')\""],
        resumeCommands: [],
        runtimes: [],
        setupTimeoutSeconds: 30,
      },
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update README after redacted setup.",
    );
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
      .toBe("completed");
    const run = await sandbox.latestRun();

    if (!run) {
      throw new Error("The redaction run was not recorded");
    }

    const events = await sandbox.events(run.runId);

    expect(JSON.stringify(events)).not.toContain(credential);
    expect(
      events.some(
        ({ event }) =>
          event.type === "environment_setup_command_output" &&
          event.output?.includes("[redacted credential]"),
      ),
    ).toBe(true);
    const logs = run.manifest?.artifacts.find(({ kind }) => kind === "logs");

    if (!logs) {
      throw new Error("The redaction run did not retain its logs");
    }

    const output = await sandbox.artifact(logs.url);

    expect(output).not.toContain(credential);
    expect(output).toContain("[redacted credential]");
    await workbench.selectPane("Activity");
    await expect(workbench.panel).not.toContainText(credential);
  });

  for (const scenario of [
    {
      name: "unavailable runtime",
      runtimes: [{ name: "ruby", version: "3" }],
      command: "node --version",
      error: /ruby is required but is not available/i,
    },
    {
      name: "mismatched runtime",
      runtimes: [{ name: "node", version: "999" }],
      command: "node --version",
      error: /version 999/,
    },
    {
      name: "failed command",
      runtimes: [{ name: "node", version: "22" }],
      command: "node -e 'process.exit(1)'",
      error: /command|exit|failed/i,
    },
    {
      name: "expired setup timeout",
      runtimes: [{ name: "node", version: "22" }],
      command: "node -e 'setTimeout(() => {}, 45000)'",
      error: /timed out/i,
    },
  ] satisfies Array<{
    name: string;
    runtimes: SandboxRuntimeRequirement[];
    command: string;
    error: RegExp;
  }>) {
    test(`retains setup failure and prevents planning after ${scenario.name}`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject({
        source: "polychat",
        definition: {
          version: 1,
          setupCommands: [scenario.command],
          resumeCommands: [],
          runtimes: scenario.runtimes,
          setupTimeoutSeconds: 30,
        },
      });
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessageAndRequireCompletion(
        "Polychat sandbox E2E: update the fixture after environment setup.",
      );
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
        .toMatch(/^(completed|failed|cancelled)$/);
      const run = await sandbox.latestRun();

      expect(run?.status).toBe("failed");
      expect(run?.error ?? run?.result?.error).toMatch(scenario.error);
      expect(run?.manifest?.environment).toMatchObject({ source: "polychat", status: "failed" });
      expect(run?.manifest?.environment?.configurationRevision).toBeTruthy();
      if (!run) {
        throw new Error("The failed environment did not retain a run");
      }

      expect((await sandbox.events(run.runId)).map(({ event }) => event.type)).not.toContain(
        "planning_started",
      );
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText("failed");
      await workbench.reload();
      await expect(workbench.panel).toContainText("Project configuration");
      await expect(workbench.panel).toContainText("failed");
    });
  }

  for (const scenario of [
    {
      name: "malformed JSON",
      repository: SANDBOX_E2E_REPOSITORIES.malformed,
      error: /not valid JSON/i,
    },
    {
      name: "oversized definition",
      repository: SANDBOX_E2E_REPOSITORIES.oversized,
      error: /too large/i,
    },
  ]) {
    test(`fails before planning for a repository ${scenario.name}`, async ({
      page,
      workPage,
      homePage,
    }) => {
      test.setTimeout(120_000);
      await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
      const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
      const workbench = new WorkbenchPage(page);

      await sandbox.configureProject({ source: "repository" }, 120, scenario.repository);
      await workPage.reload();
      await workPage.openNewProjectConversation();
      await expect(workbench.dock).toBeVisible();
      await homePage.selectModel("GPT OSS 120B");
      await homePage.sendMessageAndRequireCompletion(
        `Polychat sandbox E2E: use ${scenario.repository} and update README after repository setup.`,
      );
      await expect
        .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
        .toBe("failed");
      const run = await sandbox.latestRun();

      expect(run?.error ?? run?.result?.error).toMatch(scenario.error);
      if (!run) {
        throw new Error("The invalid repository environment did not retain a run");
      }

      const events = await sandbox.events(run.runId);
      const failure = events.find(({ event }) => event.type === "environment_setup_failed")?.event;

      expect(failure).toMatchObject({
        configurationSource: "repository",
        configurationPath: ".polychat/environment.json",
        preparationStatus: "failed",
      });
      expect(failure?.error).toMatch(scenario.error);
      expect(events.map(({ event }) => event.type)).not.toContain("planning_started");
      expect(run.manifest?.repository.baseRevision).toMatch(/^[a-f0-9]{40}$/);
      expect(run.manifest?.environment).toBeUndefined();
      await workbench.selectPane("Activity");
      await expect(workbench.activityEntry("Environment setup failed")).toContainText(
        scenario.error,
      );
      await workbench.selectPane("Proof");
      await expect(workbench.panel).toContainText("failed");
    });
  }
});
