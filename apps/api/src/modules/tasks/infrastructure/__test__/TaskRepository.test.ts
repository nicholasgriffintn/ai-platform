import { describe, expect, it, vi } from "vitest";

import { TaskRepository } from "../TaskRepository";

describe("TaskRepository", () => {
  it("normalises stored offsets during due-time comparison", async () => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new TaskRepository({ DB: { prepare } } as any);
    const now = new Date("2026-08-31T17:30:00.000Z");

    await repository.getPendingTasks(25, now);

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("datetime(scheduled_at) <= datetime(?)"),
    );
    expect(bind).toHaveBeenCalledWith("2026-08-31T17:30:00.000Z", 25);
  });

  it("purges settled immediate tasks and their executions in one bounded batch", async () => {
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 3 } }, { meta: { changes: 2 } }]);
    const bind = vi.fn().mockImplementation((...values: unknown[]) => ({ values }));
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new TaskRepository({ DB: { prepare, batch } } as any);

    const deleted = await repository.deleteSettledTasksBefore(
      new Date("2026-09-02T00:00:00.000Z"),
      500,
    );

    expect(deleted).toBe(2);
    expect(prepare.mock.calls[0]?.[0]).toContain("DELETE FROM task_executions");
    expect(prepare.mock.calls[1]?.[0]).toContain("DELETE FROM tasks");
    expect(prepare.mock.calls[1]?.[0]).toContain("status IN ('completed', 'cancelled')");
    expect(prepare.mock.calls[1]?.[0]).toContain("schedule_type = 'immediate'");
    expect(bind).toHaveBeenCalledWith("2026-09-02T00:00:00.000Z", 500);
    expect(batch).toHaveBeenCalledOnce();
  });

  it("only reclaims a running task after its persisted owner lease expires", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new TaskRepository({ DB: { prepare } } as any);

    await repository.claimTaskForExecution("task-1", {
      ownerToken: "owner-new",
      leaseExpiresAt: "2026-09-05T12:10:00.000Z",
      resumeInterrupted: true,
      now: "2026-09-05T12:05:00.000Z",
    });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("datetime(execution_lease_expires_at) <= datetime(?)"),
    );
    expect(bind).toHaveBeenCalledWith(
      "2026-09-05T12:05:00.000Z",
      "owner-new",
      "2026-09-05T12:10:00.000Z",
      "task-1",
      1,
      "2026-09-05T12:05:00.000Z",
    );
  });

  it("settles a task only for its live execution owner", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const repository = new TaskRepository({ DB: { prepare } } as any);

    await repository.updateOwnedTask("task-1", "owner-1", { status: "completed" });

    expect(prepare).toHaveBeenCalledWith(
      expect.stringMatching(
        /execution_owner_token = \?[\s\S]+datetime\(execution_lease_expires_at\) > datetime\(\?\)/,
      ),
    );
    expect(bind).toHaveBeenCalledWith(
      "completed",
      null,
      null,
      "task-1",
      "owner-1",
      expect.any(String),
    );
  });
});
