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
        now: "2026-09-05T12:00:00.000Z",
      },
    );

    expect(prepare).toHaveBeenCalledWith(
      expect.stringMatching(
        /dispatch_task_id = \?[\s\S]+tasks\.execution_owner_token = \?[\s\S]+tasks\.execution_lease_expires_at/,
      ),
    );
    expect(bind).toHaveBeenCalledWith(
      "review",
      "review",
      "project-task-1",
      "dispatch-1",
      "dispatch-1",
      "owner-1",
      "2026-09-05T12:00:00.000Z",
    );
  });
});
