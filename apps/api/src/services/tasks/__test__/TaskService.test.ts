import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskService } from "../TaskService";

const taskRepository = {
  createTask: vi.fn(),
  createTaskIfAbsent: vi.fn(),
  getPendingTasks: vi.fn(),
  updateTask: vi.fn(),
};

describe("TaskService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    taskRepository.createTask.mockResolvedValue({
      id: "task-random",
      max_attempts: 3,
    });
    taskRepository.createTaskIfAbsent.mockResolvedValue({
      created: true,
      task: {
        id: "task-stable",
        max_attempts: 3,
      },
    });
    taskRepository.updateTask.mockResolvedValue(undefined);
    taskRepository.getPendingTasks.mockResolvedValue([]);
  });

  it("does not send duplicate queue messages for an existing idempotent task", async () => {
    const send = vi.fn();

    taskRepository.createTaskIfAbsent.mockResolvedValue({
      created: false,
      task: {
        id: "recipe_schedule_existing",
        max_attempts: 3,
        status: "completed",
      },
    });
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    const taskId = await service.enqueueTask({
      id: "recipe_schedule_existing",
      task_type: "recipe_execution",
      user_id: 42,
      task_data: { recipeId: "bad-weather-alerts" },
    });

    expect(taskId).toBe("recipe_schedule_existing");
    expect(taskRepository.updateTask).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("re-sends an existing queued task after a queue-send failure", async () => {
    const send = vi.fn();

    taskRepository.createTaskIfAbsent.mockResolvedValue({
      created: false,
      task: {
        id: "ocr-batch:output-1:1",
        task_type: "ocr_batch_polling",
        user_id: 42,
        project_id: null,
        status: "queued",
        max_attempts: 3,
      },
    });
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    await service.enqueueTask({
      id: "ocr-batch:output-1:1",
      task_type: "ocr_batch_polling",
      user_id: 42,
      task_data: { outputId: "output-1" },
    });

    expect(taskRepository.updateTask).toHaveBeenCalledWith("ocr-batch:output-1:1", {
      status: "queued",
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it("persists and queues first-class project scope", async () => {
    const send = vi.fn();
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    await service.enqueueTask({
      task_type: "recipe_execution",
      user_id: 42,
      project_id: "project-1",
      task_data: { recipeId: "bad-weather-alerts" },
    });

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "project-1" }),
    );
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ project_id: "project-1" }));
  });

  it("normalises scheduled timestamps before persistence and delivery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T17:00:00.000Z"));

    const send = vi.fn();
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    await service.enqueueTask({
      task_type: "recipe_execution",
      user_id: 42,
      task_data: { recipeId: "bad-weather-alerts" },
      schedule_type: "scheduled",
      scheduled_at: "2026-08-31T18:30:00+01:00",
    });

    expect(taskRepository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_at: "2026-08-31T17:30:00.000Z" }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_at: "2026-08-31T17:30:00.000Z" }),
      expect.objectContaining({ delaySeconds: expect.any(Number) }),
    );
  });

  it("redelivers durable pending tasks after an earlier queue-send failure", async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    taskRepository.getPendingTasks.mockResolvedValue([
      {
        id: "ocr-batch:output-1:cleanup:2",
        task_type: "ocr_batch_polling",
        user_id: 42,
        project_id: "project-1",
        task_data: { outputId: "output-1" },
        priority: 7,
        schedule_type: "scheduled",
        scheduled_at: "2026-08-31T00:00:00.000Z",
        max_attempts: 3,
      },
    ]);
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    await expect(service.dispatchPendingTasks()).resolves.toBe(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "ocr-batch:output-1:cleanup:2",
        project_id: "project-1",
      }),
    );
    expect(taskRepository.updateTask).toHaveBeenCalledWith("ocr-batch:output-1:cleanup:2", {
      status: "queued",
    });
  });

  it("reports a missing queue binding while retaining the durable task", async () => {
    const service = new TaskService({} as any, taskRepository as any);

    await expect(
      service.enqueueTask({
        task_type: "ocr_batch_polling",
        user_id: 42,
        task_data: { outputId: "output-1" },
      }),
    ).rejects.toThrow("task remains queued for recovery");
    expect(taskRepository.updateTask).toHaveBeenCalledWith("task-random", { status: "queued" });
  });
});
