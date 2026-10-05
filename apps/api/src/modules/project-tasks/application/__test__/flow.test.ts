import { createProjectTaskSchema } from "@ngriffin_uk/polychat-schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createIntegrationTestContext } from "../../../../../test/helpers/project-task-integrations";
import { resolveTaskRuntime } from "../flow";
import { createProjectTask, updateProjectTask } from "../index";

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

describe("review runtime isolation", () => {
  it("keeps a review read-only even when its runner requests a writing teammate", async () => {
    const { task } = await createProjectTask(
      fixture.context,
      "project-1",
      createProjectTaskSchema.parse({
        objective: "Review the captured diff",
        runner: {
          kind: "conversation",
          teammateId: "writing-teammate",
          mode: "build",
          model: null,
        },
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
});
