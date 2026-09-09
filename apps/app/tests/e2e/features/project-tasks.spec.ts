import { ChatRunApi } from "../fixtures/chat-run-api";
import { expect, test } from "../fixtures/polychat-test";
import { ProjectTaskApi } from "../fixtures/project-task-api";
import { SandboxApi } from "../fixtures/sandbox-api";
import { InteractionPage } from "../page-objects/InteractionPage";
import { ProjectTasksPage } from "../page-objects/ProjectTasksPage";
import { WorkbenchPage } from "../page-objects/WorkbenchPage";

test.describe("Project task evidence", () => {
  test.use({ persona: "pro" });

  test("snapshots proposed stages and keeps an untouched task reversible", async ({
    page,
    workPage,
  }) => {
    const tasks = new ProjectTasksPage(page);
    const objective = "Preserve the original verification plan";

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    await tasks.openBoard();
    await tasks.configurePipeline();
    await tasks.nameStage(0, "Research");
    await tasks.addStage("Review");
    await tasks.savePipeline();
    await tasks.createBacklogTask(objective);
    await tasks.openTask(objective);
    await expect(tasks.plan.getByText("Proposed", { exact: true })).toHaveCount(2);
    await expect(tasks.plan.getByText(/0 attempts/)).toHaveCount(2);
    await expect(tasks.plan.getByRole("link")).toHaveCount(0);
    await tasks.openBoard();
    await tasks.configurePipeline();
    await tasks.nameStage(0, "Updated research");
    await tasks.savePipeline();
    await tasks.openTask(objective);
    await expect(tasks.plan.getByRole("listitem")).toContainText(["Research", "Review"]);
    await expect(tasks.plan).not.toContainText("Updated research");
    await tasks.reload();
    await expect(tasks.plan.getByRole("listitem")).toContainText(["Research", "Review"]);
    await tasks.cancel();
    await expect(page.getByRole("button", { name: "Reopen task", exact: true })).toBeEnabled();
    await expect(tasks.plan.getByText("Abandoned", { exact: true })).toHaveCount(2);
    await tasks.reopen();
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeEnabled();
    await expect(tasks.plan.getByText("Proposed", { exact: true })).toHaveCount(2);
    await tasks.cancel();
    await expect(page.getByRole("button", { name: "Reopen task", exact: true })).toBeEnabled();
    await tasks.delete();
    await expect(page.getByRole("link", { name: objective, exact: true })).toHaveCount(0);
  });

  test("keeps the empty queue flush in its card and starts a pipeline from the suggestion", async ({
    page,
    workPage,
  }) => {
    const tasks = new ProjectTasksPage(page);

    await workPage.open();
    await workPage.openWorkspace("Release Workspace");
    await workPage.createProject(
      "Release queue project",
      "Validates the empty queue and the suggested pipeline.",
      "Keep release answers concise.",
    );
    await tasks.openBoard();

    await expect(tasks.emptyQueue).toBeVisible();
    expect(await tasks.borderWidthOf(tasks.emptyQueue)).toBe("0px");

    await tasks.configurePipeline();
    await tasks.useSuggestedPipeline();
    expect(await tasks.stageNames()).toEqual(["Research", "Plan", "Build", "Review"]);
    expect(await tasks.stageModes()).toEqual(["explore", "plan", "build", "explore"]);
    expect(await tasks.stageTeammates()).toEqual(["", "", "", ""]);
    expect(await tasks.stageHandoffs()).toEqual([
      "on_goal_complete",
      "on_human_accept",
      "on_goal_complete",
      "on_human_accept",
    ]);
    await tasks.savePipeline();

    await tasks.configurePipeline();
    expect(await tasks.stageNames()).toEqual(["Research", "Plan", "Build", "Review"]);
    await expect(tasks.suggestedPipelineButton()).toHaveCount(0);
    await tasks.closePipeline();

    await tasks.createBacklogTask("Filter this queued outcome out");
    await tasks.filterQueueTo("Completed");
    await expect(tasks.noMatches).toBeVisible();
    expect(await tasks.borderWidthOf(tasks.noMatches)).toBe("0px");
  });

  test("continues a queued task after its initiating page closes and recovers the exact waiting run", async ({
    page,
    workPage,
    polychatApi,
  }) => {
    test.slow();
    const tasks = new ProjectTasksPage(page);

    await workPage.openProjectFromWorkspace("Release Workspace", "Release Project");
    const taskApi = new ProjectTaskApi(page.request, workPage.currentProjectId());
    const sandbox = new SandboxApi(page.request, workPage.currentProjectId());
    const runs = new ChatRunApi(page.request);

    await sandbox.configureProject();
    const task = await taskApi.createQuestionTask();

    await tasks.openBoard();
    await tasks.reload();
    await tasks.openTask(task.objective);
    const taskUrl = page.url();

    expect((await tasks.start()).ok()).toBe(true);
    await page.close();
    await expect
      .poll(async () => (await taskApi.detail(task.id)).task.blockedReason, {
        timeout: 20_000,
      })
      .toBe("awaiting_input");
    const detail = await taskApi.detail(task.id);

    await expect
      .poll(async () => (await polychatApi.getAccountUsageBalance()).credit_micros.reserved)
      .toBe(0);

    expect(detail.pendingQuestions?.questions).toHaveLength(2);
    expect(detail.task.runId).toBeTruthy();
    if (!detail.task.runId) {
      throw new Error("The queued task did not retain its run identity");
    }

    const snapshot = await runs.snapshot(detail.task.runId);

    expect(snapshot.run.status).toBe("awaiting_input");
    expect(snapshot.run.conversationId).toBe(detail.task.conversationId);
    const reopenedPage = await page.context().newPage();
    const reopenedTasks = new ProjectTasksPage(reopenedPage);

    await reopenedTasks.navigate(taskUrl);
    await expect(
      reopenedPage.getByRole("heading", { name: task.objective, level: 1 }),
    ).toBeVisible();
    await expect(
      reopenedTasks.plan.getByRole("link", { name: `Run ${detail.task.runId}`, exact: true }),
    ).toBeVisible();
    await reopenedTasks.answerQuestions();
    const workbench = new WorkbenchPage(reopenedPage);

    await expect(workbench.dock).toBeVisible();
    await expect(workbench.status).toContainText("Waiting for input");
    expect(await workbench.statusStripHasAttentionBackground()).toBe(true);
    const interaction = new InteractionPage(reopenedPage);

    await interaction.answerReleaseQuestions();
    await interaction.setOffline(true);
    await interaction.submitAnswers();
    await expect(interaction.questions.getByRole("alert")).toContainText(
      "Answers were not submitted",
      { timeout: 20_000 },
    );
    await expect(interaction.questions).not.toContainText("Answers sent");
    await expect(
      interaction.questions.getByRole("textbox", {
        name: "Answer: Which detail should the report emphasise?",
      }),
    ).toHaveValue("Recover this interrupted stream with validation evidence");
    await interaction.setOffline(false);
    await interaction.submitAnswers();
    await expect
      .poll(async () => (await taskApi.detail(task.id)).task.status, { timeout: 20_000 })
      .toBe("review");
    const completed = await taskApi.detail(task.id);

    await expect
      .poll(async () => (await polychatApi.getAccountUsageBalance()).credit_micros.reserved)
      .toBe(0);

    expect(completed.pendingQuestions).toBeNull();
    expect(completed.task.conversationId).toBe(detail.task.conversationId);
    await workbench.reload();
    await expect(workbench.status).toContainText("Ready for review");
    await expect(workbench.status).toContainText(task.objective);
    await reopenedTasks.navigate(taskUrl);
    await expect(
      reopenedPage.getByRole("button", { name: "Approve result", exact: true }),
    ).toBeVisible();
  });
});
