import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskService } from "../TaskService";

const taskRepository = {
  createTask: vi.fn(),
  createTaskIfAbsent: vi.fn(),
  updateTask: vi.fn(),
};

describe("TaskService", () => {
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
  });

  it("does not send duplicate queue messages for an existing idempotent task", async () => {
    const send = vi.fn();

    taskRepository.createTaskIfAbsent.mockResolvedValue({
      created: false,
      task: {
        id: "recipe_schedule_existing",
        status: "completed",
        max_attempts: 3,
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

  it("re-sends the stored payload when a prior queue send died after persistence", async () => {
    const send = vi.fn();

    taskRepository.createTaskIfAbsent.mockResolvedValue({
      created: false,
      task: {
        id: "project_dispatch_queued",
        task_type: "project_task_run",
        user_id: 7,
        project_id: "project-1",
        task_data: { taskId: "task-1", dispatchTaskId: "dispatch-1" },
        priority: 4,
        schedule_type: "immediate",
        scheduled_at: null,
        status: "queued",
        max_attempts: 3,
      },
    });
    const service = new TaskService({ TASK_QUEUE: { send } } as any, taskRepository as any);

    await service.enqueueTask({
      id: "project_dispatch_queued",
      task_type: "project_task_run",
      user_id: 999,
      project_id: "wrong-project",
      task_data: { taskId: "wrong-task" },
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "project_dispatch_queued",
        user_id: 7,
        project_id: "project-1",
        task_data: { taskId: "task-1", dispatchTaskId: "dispatch-1" },
      }),
    );
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
});
