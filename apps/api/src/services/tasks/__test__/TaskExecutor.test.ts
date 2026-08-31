import {
  PROJECT_TASK_RUN_TASK_TYPE,
  SANDBOX_RUN_DISPATCH_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskExecutor } from "../TaskExecutor";
import type { TaskHandler } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const mockTaskRepository = {
  updateTask: vi.fn(),
  claimTaskForExecution: vi.fn(),
  failRunningTaskExecutions: vi.fn(),
  createTaskExecution: vi.fn(),
  updateTaskExecution: vi.fn(),
  getTaskById: vi.fn(),
};

vi.mock("~/repositories/TaskRepository", () => ({
  TaskRepository: class {
    public updateTask = mockTaskRepository.updateTask;
    public claimTaskForExecution = mockTaskRepository.claimTaskForExecution;
    public failRunningTaskExecutions = mockTaskRepository.failRunningTaskExecutions;
    public createTaskExecution = mockTaskRepository.createTaskExecution;
    public updateTaskExecution = mockTaskRepository.updateTaskExecution;
    public getTaskById = mockTaskRepository.getTaskById;
  },
}));

function createTaskMessage(taskType: string): TaskMessage {
  return {
    taskId: "task-1",
    task_type: taskType as TaskMessage["task_type"],
    task_data: {},
    priority: 5,
  };
}

describe("TaskExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskRepository.updateTask.mockResolvedValue(undefined);
    mockTaskRepository.claimTaskForExecution.mockResolvedValue({
      id: "task-1",
      status: "running",
    });
    mockTaskRepository.createTaskExecution.mockResolvedValue({ id: "exec-1" });
    mockTaskRepository.failRunningTaskExecutions.mockResolvedValue(undefined);
    mockTaskRepository.updateTaskExecution.mockResolvedValue(undefined);
    mockTaskRepository.getTaskById.mockResolvedValue({
      id: "task-1",
      attempts: 0,
      max_attempts: 3,
    });
  });

  it("skips feature-flagged task types when disabled", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success" }),
    };
    const executor = new TaskExecutor({} as any, new Map([["memory_synthesis", handler]]));

    await executor.execute(createTaskMessage("memory_synthesis"));

    expect(handler.handle).not.toHaveBeenCalled();
    expect(mockTaskRepository.updateTask).toHaveBeenCalledTimes(1);
    expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        status: "cancelled",
        error_message: expect.stringContaining(
          "memory_synthesis is disabled via environment variable",
        ),
      }),
    );
  });

  it("executes always-enabled sandbox dispatch tasks without feature flags", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
    };
    const executor = new TaskExecutor(
      {} as any,
      new Map([[SANDBOX_RUN_DISPATCH_TASK_TYPE, handler]]),
    );

    await executor.execute(createTaskMessage(SANDBOX_RUN_DISPATCH_TASK_TYPE));

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(mockTaskRepository.claimTaskForExecution).toHaveBeenCalledWith("task-1", {
      resumeInterrupted: false,
    });
    expect(mockTaskRepository.updateTask).toHaveBeenNthCalledWith(
      1,
      "task-1",
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("reclaims an interrupted task only for a queue redelivery", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
    };
    const executor = new TaskExecutor({} as any, new Map([[PROJECT_TASK_RUN_TASK_TYPE, handler]]));

    await executor.execute(createTaskMessage(PROJECT_TASK_RUN_TASK_TYPE), 2);

    expect(mockTaskRepository.claimTaskForExecution).toHaveBeenCalledWith("task-1", {
      resumeInterrupted: true,
    });
    expect(mockTaskRepository.failRunningTaskExecutions).toHaveBeenCalledWith(
      "task-1",
      "The previous queue delivery ended before recording an outcome.",
    );
    expect(handler.handle).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      deliveryAttempt: 2,
      isRedelivery: true,
    });
  });

  it("executes project task runs without a separate feature-flag allowlist", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
    };
    const executor = new TaskExecutor({} as any, new Map([[PROJECT_TASK_RUN_TASK_TYPE, handler]]));

    await executor.execute(createTaskMessage(PROJECT_TASK_RUN_TASK_TYPE));

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate deliveries that cannot claim the task", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
    };

    mockTaskRepository.claimTaskForExecution.mockResolvedValue(null);
    const executor = new TaskExecutor(
      {} as any,
      new Map([[SANDBOX_RUN_DISPATCH_TASK_TYPE, handler]]),
    );

    await executor.execute(createTaskMessage(SANDBOX_RUN_DISPATCH_TASK_TYPE));

    expect(handler.handle).not.toHaveBeenCalled();
    expect(mockTaskRepository.createTaskExecution).not.toHaveBeenCalled();
    expect(mockTaskRepository.updateTask).not.toHaveBeenCalled();
  });

  it("cancels unknown task types explicitly", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success" }),
    };
    const executor = new TaskExecutor(
      {} as any,
      new Map([[SANDBOX_RUN_DISPATCH_TASK_TYPE, handler]]),
    );

    await executor.execute(createTaskMessage("invalid_type"));

    expect(handler.handle).not.toHaveBeenCalled();
    expect(mockTaskRepository.updateTask).toHaveBeenCalledTimes(1);
    expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        status: "cancelled",
        error_message: "Unknown task type: invalid_type",
      }),
    );
  });

  it("does not terminalise a task when final-failure reconciliation fails", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockRejectedValue(new Error("provider failed")),
      onFinalFailure: vi.fn().mockRejectedValue(new Error("reconciliation failed")),
    };

    mockTaskRepository.getTaskById.mockResolvedValue({
      id: "task-1",
      attempts: 2,
      max_attempts: 3,
    });
    const executor = new TaskExecutor(
      {} as any,
      new Map([[SANDBOX_RUN_DISPATCH_TASK_TYPE, handler]]),
    );

    await expect(
      executor.execute(createTaskMessage(SANDBOX_RUN_DISPATCH_TASK_TYPE)),
    ).rejects.toThrow("reconciliation failed");

    expect(handler.onFinalFailure).toHaveBeenCalledOnce();
    expect(mockTaskRepository.updateTask).not.toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
