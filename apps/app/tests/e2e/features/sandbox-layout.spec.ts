import { expect, test } from "../fixtures/polychat-test";
import { SandboxApi } from "../fixtures/sandbox-api";
import { WORKBENCH_STATUS_SANDBOX_ENVIRONMENT } from "../fixtures/sandbox-environment";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Project workbench layout", () => {
  test.use({ persona: "pro" });

  test("keeps ordinary conversations simple and restores keyboard-resized panels across desktop and mobile", async ({
    page,
    workPage,
  }) => {
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const projectUrl = page.url();
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await workPage.openNewProjectConversation();
    await expect(workbench.dock).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).not.toBeVisible();
    await expect(workbench.mobileTrigger).not.toBeVisible();
    await sandbox.configureProject();
    await workPage.navigate(projectUrl);
    await workPage.openNewProjectConversation();
    await expect(workbench.dock).toBeVisible();
    await expect(page.getByRole("main", { name: "Conversation", exact: true })).toBeVisible();
    await expect(workbench.dock.getByRole("tab")).toHaveText([
      "Activity",
      "Preview",
      "Changes",
      "Files",
      "Proof",
      "Delegates",
    ]);
    await expect(workbench.status).toHaveAttribute("aria-live", "polite");
    await expect(workbench.status).toHaveText(/Ready:\s+Coding environment configured/);
    await expect(workbench.resizeHandle).toHaveAttribute("aria-valuenow", /^\d+$/);
    const initialWidth = Number(await workbench.resizeHandle.getAttribute("aria-valuenow"));

    await workbench.paneTab("Activity").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(workbench.resizeHandle).toBeFocused();
    expect(await workbench.hasVisibleKeyboardFocus()).toBe(true);
    await page.keyboard.press("ArrowLeft");
    await expect(workbench.resizeHandle).toHaveAttribute(
      "aria-valuenow",
      String(initialWidth + 24),
    );
    await page.keyboard.press("Tab");
    await expect(workbench.paneTab("Activity")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(workbench.paneTab("Preview")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(workbench.paneTab("Changes")).toBeFocused();
    expect(await workbench.hasVisibleKeyboardFocus()).toBe(true);
    await expect(workbench.paneTab("Changes")).toHaveAttribute("aria-selected", "true");
    await expect(workbench.panePanel("Changes")).toBeVisible();
    await expect(workbench.panePanel("Changes")).toHaveAttribute(
      "aria-labelledby",
      "project-workbench-desktop-changes-tab",
    );
    await workbench.collapse();
    await expect(workbench.dock).not.toBeVisible();
    await workbench.reload();
    await expect(workbench.dock).not.toBeVisible();
    await workbench.expand();
    await expect(workbench.resizeHandle).toHaveAttribute(
      "aria-valuenow",
      String(initialWidth + 24),
    );
    await expect(workbench.paneTab("Changes")).toHaveAttribute("aria-selected", "true");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(workbench.dock).not.toBeVisible();
    await workbench.mobileTrigger.click();
    await expect(workbench.mobileDialog).toBeVisible();
    await expect(workbench.mobileDialog.getByRole("tab")).toHaveText([
      "Activity",
      "Preview",
      "Changes",
      "Files",
      "Proof",
      "Delegates",
    ]);
    await expect(
      workbench.mobileDialog.getByRole("tab", { name: "Changes", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const dialogBounds = await workbench.mobileDialog.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(dialogBounds?.height).toBeGreaterThan(viewportHeight * 0.9);
    await page.keyboard.press("Escape");
    await expect(workbench.mobileDialog).not.toBeVisible();
    await expect(workbench.mobileTrigger).toBeFocused();
  });

  test("projects queued, preparing, running, paused and cancelled states with responsive detail", async ({
    page,
    workPage,
    homePage,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const workbench = new WorkbenchPage(page);

    await sandbox.configureProject(WORKBENCH_STATUS_SANDBOX_ENVIRONMENT);
    await workPage.reload();
    await workPage.openNewProjectConversation();
    await homePage.selectModel("GPT OSS 120B");
    const conversationRequest = await homePage.sendMessageAndRequireCompletion(
      "Create the Workbench status verification conversation.",
    );
    const conversationId = homePage.completionIdFromRequest(conversationRequest);

    await expect(workbench.composer).toBeEditable();
    const queuedTask =
      "Keep this deliberately long queued status detail visible while the isolated Activity API restores the latest authorised run.";
    const queuedRun = await sandbox.createQueuedWorkbenchRun(conversationId, queuedTask);

    await workbench.reload();
    expect((await sandbox.latestRun())?.runId).toBe(queuedRun.runId);
    await expect(workbench.status).toHaveText(/Queued:.*latest authorised run/);
    await sandbox.deleteQueuedWorkbenchRun(queuedRun.runId);
    await workbench.reload();
    await expect(workbench.status).toContainText("Ready");

    const runningTask =
      "Polychat sandbox E2E: observe every workbench state and wait for controls during service review while preserving this deliberately long status detail across desktop tablet and mobile layouts without losing the authoritative run.";

    await homePage.sendMessage(runningTask);
    await expect(workbench.status).toContainText("Preparing", { timeout: 30_000 });
    const preparingRun = await sandbox.latestRun();

    if (!preparingRun) {
      throw new Error("The preparing Workbench run was not created");
    }

    expect(preparingRun.status).toBe("running");
    await expect
      .poll(
        async () => {
          const events = await sandbox.events(preparingRun.runId);

          return {
            started: events.some(({ event }) => event.type === "environment_setup_started"),
            completed: events.some(({ event }) => event.type === "environment_setup_completed"),
          };
        },
        { timeout: 10_000 },
      )
      .toEqual({ started: true, completed: false });
    await expect(workbench.status).toContainText("Running", { timeout: 30_000 });
    await expect.poll(async () => (await sandbox.latestRun())?.status).toBe("running");
    const runningRun = await sandbox.latestRun();

    if (!runningRun) {
      throw new Error("The Workbench status run was not created");
    }

    await expect(workbench.status).toHaveAttribute("title", /observe every workbench state/);
    await expect(workbench.statusDetail).toBeVisible();
    expect(await workbench.statusDetailIsTruncated()).toBe(true);
    expect(await workbench.statusStripHasPageBackground()).toBe(true);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(workbench.statusDetail).toBeVisible();
    expect(await workbench.statusDetailIsTruncated()).toBe(true);
    const tabletControls = await Promise.all(
      (["Pause", "Continue", "Cancel"] as const).map((action) =>
        workbench.controlPresentation(action),
      ),
    );

    expect(tabletControls).toEqual([
      { action: "Pause", title: "Pause at the next safe boundary", labelVisible: false },
      {
        action: "Continue",
        title: "Ask the run to keep going and finish with clear validation",
        labelVisible: false,
      },
      { action: "Cancel", title: "Cancel this run", labelVisible: false },
    ]);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(workbench.status).toHaveAttribute("title", /observe every workbench state/);
    await expect(workbench.status).toContainText("Running");
    await expect(workbench.statusDetail).toBeVisible();
    expect(await workbench.statusDetailIsTruncated()).toBe(true);
    await expect(workbench.mobileTrigger).toBeVisible();
    expect(
      await Promise.all(
        (["Pause", "Continue", "Cancel"] as const).map((action) =>
          workbench.controlPresentation(action),
        ),
      ),
    ).toEqual(tabletControls);

    await page.setViewportSize({ width: 1440, height: 900 });
    await workbench.control("Pause");
    await expect.poll(async () => (await sandbox.control(runningRun.runId)).state).toBe("paused");
    await expect(workbench.status).toContainText("Paused");
    await workbench.control("Cancel");
    await expect
      .poll(async () => (await sandbox.control(runningRun.runId)).state)
      .toBe("cancelled");
    await expect(workbench.status).toContainText("Cancelled");
    await expect
      .poll(async () => (await sandbox.latestRun())?.status, { timeout: 60_000 })
      .toBe("cancelled");
  });
});
