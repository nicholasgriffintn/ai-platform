import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
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
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText("Project configuration");
    await expect(workbench.panel).toContainText("node 22");
    await environment.navigate(projectUrl);
    await environment.edit();
    await environment.removeSetup();
    await environment.reload();
    await environment.edit();
    await expect(page.getByLabel("Environment setup", { exact: true })).toHaveValue("none");
    await expect(page.getByLabel("GitHub repository", { exact: true })).not.toHaveValue("");
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
    { name: "mismatched runtime", version: "999", command: "node --version", error: /version 999/ },
    {
      name: "failed command",
      version: "22",
      command: "node -e 'process.exit(1)'",
      error: /command|exit|failed/i,
    },
    {
      name: "expired setup timeout",
      version: "22",
      command: "node -e 'setTimeout(() => {}, 45000)'",
      error: /timed out/i,
    },
  ]) {
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
          runtimes: [{ name: "node", version: scenario.version }],
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
});
