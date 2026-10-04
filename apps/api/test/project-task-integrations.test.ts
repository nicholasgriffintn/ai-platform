import { createProjectTaskSchema, importProjectIssueSchema } from "@ngriffin_uk/polychat-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";
import { createProjectTask, updateProjectTask } from "~/modules/project-tasks/application";
import { resolveTaskRuntime } from "~/modules/project-tasks/application/flow";
import {
  importProjectIssue,
  previewProjectIssue,
} from "~/modules/project-tasks/application/issue-intake";
import { buildProjectTaskContext } from "~/modules/project-tasks/application/source-context";
import { updateSource, deleteSource } from "~/modules/sources/application/sources";

import { createIntegrationTestContext } from "./helpers/project-task-integrations";

vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));
vi.mock("~/modules/apps/application/connectors/operations", () => ({
  executeRecipeConnectorOperation: vi.fn(),
}));
vi.mock("~/modules/apps/application/connectors/composio-run", () => ({
  closeComposioConnectorRun: vi.fn(),
  scheduleComposioConnectorRunCleanup: vi.fn(),
}));

let fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>;
const locator = { provider: "linear", connectedAccountId: "account-1", issueId: "ENG-42" } as const;
const upstream = {
  id: "issue-42",
  identifier: "ENG-42",
  title: "Preserve filters",
  description: "Selected filters must survive refresh.",
  url: "https://linear.app/example/issue/ENG-42",
  updatedAt: "2026-10-04T00:00:00Z",
};

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createIntegrationTestContext();
  vi.mocked(executeRecipeConnectorOperation).mockResolvedValue({
    data: { issue: upstream },
    runId: "read-1",
    sessionHandle: "session-1",
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("issue intake through the existing task and source services", () => {
  it("imports approved criteria, preserves a snapshot and reuses the same external identity", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);
    const input = importProjectIssueSchema.parse({
      locator,
      expectedRevision: preview.issue.revision,
      task: {
        objective: "Preserve selected filters after refresh",
        acceptanceCriteria: [{ text: "Selected filters survive a page refresh." }],
      },
    });
    const imported = await importProjectIssue(fixture.context, "project-1", input);
    const duplicate = await importProjectIssue(fixture.context, "project-1", input);

    expect(duplicate).toMatchObject({
      reused: true,
      task: { id: imported.task.id },
      sourceId: imported.sourceId,
    });
    expect(imported.task.acceptanceCriteria[0]?.text).toBe(
      input.task.acceptanceCriteria?.[0]?.text,
    );
    expect(await buildProjectTaskContext(fixture.context, imported.task)).toContain(
      upstream.description,
    );
    await expect(
      updateSource(fixture.context, 7, imported.sourceId, { content: "rewritten" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(deleteSource(fixture.context, 7, imported.sourceId)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(
      fixture.database
        .prepare("UPDATE source SET content = 'rewritten' WHERE id = ?")
        .bind(imported.sourceId)
        .run(),
    ).rejects.toThrow("immutable");
    expect(closeComposioConnectorRun).toHaveBeenCalled();
  });

  it("rejects changed issue content before creating a task", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);

    vi.mocked(executeRecipeConnectorOperation).mockResolvedValue({
      data: {
        issue: { ...upstream, description: "A new requirement", updatedAt: "2026-10-04T01:00:00Z" },
      },
      runId: "read-2",
      sessionHandle: "session-2",
    });
    await expect(
      importProjectIssue(
        fixture.context,
        "project-1",
        importProjectIssueSchema.parse({
          locator,
          expectedRevision: preview.issue.revision,
          task: { objective: "Fix filters" },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await fixture.context.repositories.projectTasks.listProjectTasks("project-1")).toEqual(
      [],
    );
  });

  it("rechecks membership before reading credentials", async () => {
    await fixture.database.prepare("DELETE FROM workspace_member WHERE user_id = 7").run();
    await expect(previewProjectIssue(fixture.context, "project-1", locator)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(executeRecipeConnectorOperation).not.toHaveBeenCalled();
  });

  it("cleans up a connector session when the provider response is invalid", async () => {
    vi.mocked(executeRecipeConnectorOperation).mockResolvedValue({
      data: { issue: null },
      runId: "read-1",
      sessionHandle: "session-1",
    });
    await expect(previewProjectIssue(fixture.context, "project-1", locator)).rejects.toThrow();
    expect(closeComposioConnectorRun).toHaveBeenCalled();
  });

  it("handles simultaneous imports without creating duplicate tasks", async () => {
    const preview = await previewProjectIssue(fixture.context, "project-1", locator);
    const input = importProjectIssueSchema.parse({
      locator,
      expectedRevision: preview.issue.revision,
      task: { objective: "Fix filters" },
    });
    const results = await Promise.all([
      importProjectIssue(fixture.context, "project-1", input),
      importProjectIssue(fixture.context, "project-1", input),
    ]);

    expect(results[0].task.id).toBe(results[1].task.id);
    expect(
      await fixture.context.repositories.projectTasks.listProjectTasks("project-1"),
    ).toHaveLength(1);
  });
});

describe("review execution isolation", () => {
  it("keeps a review read-only even when task constraints request other tools", async () => {
    const { task } = await createProjectTask(
      fixture.context,
      "project-1",
      createProjectTaskSchema.parse({
        objective: "Review the captured diff",
        constraints: { allowedTools: ["execute_code", "use_recipe_connector"] },
      }),
      { executionProfile: "diff_review" },
    );
    const runtime = await resolveTaskRuntime({ context: fixture.context, task, flow: null });

    expect(runtime.enabledTools).toEqual(["get_task", "list_tasks", "ask_user", "complete_goal"]);
    expect(runtime.skillIds).toEqual([]);
    await expect(
      updateProjectTask(fixture.context, "project-1", task.id, {
        objective: "Run repository setup",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("admits one dispatch when two starts read the same pending task", async () => {
    const { task } = await createProjectTask(
      fixture.context,
      "project-1",
      createProjectTaskSchema.parse({ objective: "Review a pending task" }),
    );
    const params = {
      taskId: task.id,
      projectId: task.projectId,
      runnerIdentityUserId: 7,
      runner: { kind: "conversation", teammateId: null, model: null, mode: null } as const,
      tokenBudget: 20000,
      expectedStatus: task.status,
      expectedDispatchTaskId: task.dispatchTaskId,
    };
    const results = await Promise.all([
      fixture.context.repositories.projectTasks.queueTaskForRun({
        ...params,
        dispatchTaskId: "dispatch-1",
      }),
      fixture.context.repositories.projectTasks.queueTaskForRun({
        ...params,
        dispatchTaskId: "dispatch-2",
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const admitted = results.find((result) => result !== null);

    expect(await fixture.context.repositories.projectTasks.getTaskById(task.id)).toMatchObject({
      dispatchTaskId: admitted?.dispatchTaskId,
      status: "queued",
    });
  });
});
