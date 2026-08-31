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
});
