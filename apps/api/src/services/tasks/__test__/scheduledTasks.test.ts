import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueTask: vi.fn(),
}));

vi.mock("~/repositories", () => ({
  RepositoryManager: {
    getInstance: vi.fn(() => ({
      tasks: {},
    })),
  },
}));

vi.mock("~/services/tasks/TaskService", () => ({
  TaskService: vi.fn().mockImplementation(function TaskService() {
    return {
      enqueueTask: mocks.enqueueTask,
    };
  }),
}));

import { scheduleDailySynthesis } from "../scheduledTasks";

describe("scheduleDailySynthesis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createEnv(rows: Array<{ id: number; new_memory_count: number }>) {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: rows }),
        }),
      },
    } as any;
  }

  it("only schedules synthesis for users at or above the new-memory threshold", async () => {
    await scheduleDailySynthesis(
      createEnv([
        { id: 1, new_memory_count: 5 },
        { id: 2, new_memory_count: 4 },
        { id: 3, new_memory_count: 12 },
      ]),
    );

    expect(mocks.enqueueTask).toHaveBeenCalledTimes(2);
    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, task_type: "memory_synthesis" }),
    );
    expect(mocks.enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 3, task_type: "memory_synthesis" }),
    );
  });

  it("does not schedule anything when no user has enabled memories", async () => {
    await scheduleDailySynthesis(createEnv([]));

    expect(mocks.enqueueTask).not.toHaveBeenCalled();
  });

  it("continues scheduling other users when one enqueue fails", async () => {
    mocks.enqueueTask
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce(undefined);

    await scheduleDailySynthesis(
      createEnv([
        { id: 1, new_memory_count: 5 },
        { id: 2, new_memory_count: 5 },
      ]),
    );

    expect(mocks.enqueueTask).toHaveBeenCalledTimes(2);
  });
});
