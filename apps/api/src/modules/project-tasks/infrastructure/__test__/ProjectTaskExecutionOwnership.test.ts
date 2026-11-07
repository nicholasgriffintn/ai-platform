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
        executionOwner: {
          dispatchTaskId: "dispatch-1",
          ownerToken: "owner-1",
        },
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
      "review",
      "dispatch-1",
      "dispatch-1",
      "owner-1",
    );
  });

  it("refuses to move a finished task to a different status", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new ProjectTaskRepository({ DB: { prepare } } as any);

    await expect(repository.updateTask("project-task-1", { status: "review" })).resolves.toBeNull();

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("AND (status NOT IN ('done', 'cancelled') OR status = ?)"),
    );
  });

  it("only reopens a task from the status the caller checked", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new ProjectTaskRepository({ DB: { prepare } } as any);

    await repository.updateTask(
      "project-task-1",
      { status: "backlog" },
      { fromStatuses: ["done"] },
    );

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("AND status IN (?)"));
    expect(bind).toHaveBeenCalledWith("backlog", "backlog", "project-task-1", "done");
  });

  it("does not block a task that has already moved past dispatch", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new ProjectTaskRepository({ DB: { prepare } } as any);

    await repository.failDispatch({
      taskId: "project-task-1",
      projectId: "project-1",
      dispatchTaskId: "dispatch-1",
      detail: "Queue unavailable",
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('queued', 'running')"),
    );
  });
});
