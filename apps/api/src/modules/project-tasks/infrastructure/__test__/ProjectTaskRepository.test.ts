import { createProjectTaskSchema } from "@ngriffin_uk/polychat-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProjectTask } from "~/modules/project-tasks/application";

import { createIntegrationTestContext } from "../../../../../test/helpers/project-task-integrations";

let fixture: Awaited<ReturnType<typeof createIntegrationTestContext>>;

vi.mock("~/modules/project-tasks/application/attention", () => ({
  reconcileTaskNotifications: vi.fn(),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  fixture = await createIntegrationTestContext();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fixture?.runtime.dispose();
});

describe("ProjectTaskRepository dispatch admission", () => {
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
