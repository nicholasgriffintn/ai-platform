import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { ProjectEnvironmentPage } from "../page-objects/ProjectEnvironmentPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Sandbox environment snapshots", () => {
  test.use({ persona: "pro" });

  test("restores an exact environment snapshot and runs only lightweight resume commands", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(240_000);
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectUrl = page.url();
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const environment = new ProjectEnvironmentPage(page);
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject({
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: [
          "node -e \"require('node:fs').writeFileSync('prepared.txt', 'E2E_CACHE_READY')\"",
        ],
        resumeCommands: [
          "node -e \"if(require('node:fs').readFileSync('prepared.txt','utf8')!=='E2E_CACHE_READY')process.exit(1)\"",
        ],
        runtimes: [{ name: "node", version: "22" }],
        setupTimeoutSeconds: 30,
      },
    });
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.selectModel("GPT OSS 120B");
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update README after cold setup.",
    );
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 90_000 })
      .toBe("completed");
    const first = await sandbox.latestRun();

    expect(first?.manifest?.environment?.cache, JSON.stringify(first?.manifest)).toMatchObject({
      status: "created",
    });
    const cached = await sandbox.project();

    expect(cached.environmentCache?.status).toBe("ready");
    expect(cached.environmentCache).not.toHaveProperty("backupId");
    expect(first).not.toHaveProperty("environmentCache.backupId");
    await environment.navigate(projectUrl);
    await expect(page.getByText("Environment cache", { exact: true })).toBeVisible();
    await expect(page.getByText(/Repo [a-f0-9]+ · Setup [a-f0-9]+/)).toBeVisible();
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update README after warm resume.",
    );
    await expect
      .poll(
        async () => {
          const current = await sandbox.latestRun();

          return current?.runId !== first?.runId ? current?.status : null;
        },
        { timeout: 90_000 },
      )
      .toBe("completed");
    const second = await sandbox.latestRun();

    expect(second?.manifest?.environment, JSON.stringify(second?.manifest)).toMatchObject({
      preparationMode: "resume",
      status: "completed",
      cache: { status: "reused", cacheKey: cached.environmentCache?.cacheKey },
    });
    if (!second) {
      throw new Error("The warm run was not recorded");
    }

    const events = await sandbox.events(second.runId);
    const commands = events.filter(
      ({ event }) => event.type === "environment_setup_command_started",
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]?.event.command).toContain("readFileSync('prepared.txt'");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText("resume");
    await workbench.reload();
    await expect(workbench.panel).toContainText("resume");
    const setupWithoutResume = await sandbox.saveEnvironment({
      source: "polychat",
      definition: {
        version: 1,
        setupCommands: [
          "node -e \"require('node:fs').writeFileSync('prepared.txt', 'E2E_CACHE_READY')\"",
        ],
        resumeCommands: [],
        runtimes: [{ name: "node", version: "22" }],
        setupTimeoutSeconds: 30,
      },
    });

    expect(setupWithoutResume.status()).toBe(200);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.sendMessageAndRequireCompletion(
      "Polychat sandbox E2E: update README after resume commands were removed.",
    );
    await expect
      .poll(
        async () => {
          const current = await sandbox.latestRun();

          return current?.runId !== second.runId ? current?.status : null;
        },
        { timeout: 90_000 },
      )
      .toBe("completed");
    const fallback = await sandbox.latestRun();

    expect(fallback?.manifest?.environment).toMatchObject({
      preparationMode: "setup",
      status: "completed",
      cache: { status: "created" },
    });
    if (!fallback) {
      throw new Error("The full setup fallback was not recorded");
    }

    const fallbackCommands = (await sandbox.events(fallback.runId)).filter(
      ({ event }) => event.type === "environment_setup_command_started",
    );

    expect(fallbackCommands).toHaveLength(1);
    expect(fallbackCommands[0]?.event.command).toContain("writeFileSync('prepared.txt'");
    expect(JSON.stringify(fallbackCommands)).not.toContain("readFileSync('prepared.txt'");
    await workbench.selectPane("Proof");
    await expect(workbench.panel).toContainText("setup");
    for (const action of ["Rebuild", "Delete"] as const) {
      await environment.navigate(projectUrl);
      await environment.cacheAction(action);
      expect((await sandbox.project()).environmentCache).toMatchObject({
        status: "invalidated",
        invalidationReason: action === "Rebuild" ? "manual_rebuild" : "manual_delete",
      });
      await environment.reload();
      await expect(
        page.getByText(
          action === "Rebuild"
            ? "Rebuild requested. The next run will perform a clean setup."
            : "The saved snapshot will not be reused.",
          { exact: true },
        ),
      ).toBeVisible();
      const previousRunId = (await sandbox.latestRun())?.runId;

      await workPage.openNewProjectConversation();
      await homePage.sendMessageAndRequireCompletion(
        `Polychat sandbox E2E: update README after cache ${action.toLowerCase()}.`,
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
      const rebuilt = await sandbox.latestRun();

      expect(rebuilt?.manifest?.environment).toMatchObject({
        preparationMode: "setup",
        status: "completed",
        cache: { status: "created" },
      });
      expect((await sandbox.project()).environmentCache?.status).toBe("ready");
    }
  });
});
