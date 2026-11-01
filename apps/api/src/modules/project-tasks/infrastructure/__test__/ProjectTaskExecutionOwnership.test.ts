import { describe, expect, it, vi } from "vitest";

import { ProjectTaskRepository } from "../ProjectTaskRepository";

describe("ProjectTaskRepository durable execution ownership", () => {
  it("fences a project-task update through the current queue owner", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new ProjectTaskRepository({ DB: { prepare } } as any);

    await repository.updateTask(
      "project-task-1",
      { status: "review" },
      {
        dispatchTaskId: "dispatch-1",
        ownerToken: "owner-1",
      },
    );

    expect(prepare).toHaveBeenCalledWith(
      expect.stringMatching(
        /dispatch_task_id = \?[\s\S]+tasks\.status = 'running'[\s\S]+tasks\.execution_owner_token = \?/,
      ),
    );
    expect(bind).toHaveBeenCalledWith(
      "review",
      "review",
      "project-task-1",
      "dispatch-1",
      "dispatch-1",
      "owner-1",
    );
  });
});
