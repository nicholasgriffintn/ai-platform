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
  renewTaskExecutionLease: vi.fn(),
  isTaskExecutionOwner: vi.fn(),
  updateOwnedTask: vi.fn(),
};

vi.mock("~/repositories/TaskRepository", () => ({
  TaskRepository: class {
    public updateTask = mockTaskRepository.updateTask;
    public claimTaskForExecution = mockTaskRepository.claimTaskForExecution;
    public failRunningTaskExecutions = mockTaskRepository.failRunningTaskExecutions;
    public createTaskExecution = mockTaskRepository.createTaskExecution;
    public updateTaskExecution = mockTaskRepository.updateTaskExecution;
    public getTaskById = mockTaskRepository.getTaskById;
    public renewTaskExecutionLease = mockTaskRepository.renewTaskExecutionLease;
    public isTaskExecutionOwner = mockTaskRepository.isTaskExecutionOwner;
    public updateOwnedTask = mockTaskRepository.updateOwnedTask;
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
    mockTaskRepository.renewTaskExecutionLease.mockResolvedValue("2026-09-05T12:05:00.000Z");
    mockTaskRepository.isTaskExecutionOwner.mockResolvedValue(true);
    mockTaskRepository.updateOwnedTask.mockResolvedValue({
      id: "task-1",
      status: "completed",
    });
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
    expect(mockTaskRepository.claimTaskForExecution).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        ownerToken: expect.any(String),
        leaseExpiresAt: expect.any(String),
        resumeInterrupted: false,
      }),
    );
    expect(mockTaskRepository.updateOwnedTask).toHaveBeenCalledWith(
      "task-1",
      expect.any(String),
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("reclaims an interrupted task only for a queue redelivery", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success", data: {} }),
    };
    const executor = new TaskExecutor({} as any, new Map([[PROJECT_TASK_RUN_TASK_TYPE, handler]]));

    await executor.execute(createTaskMessage(PROJECT_TASK_RUN_TASK_TYPE), 2);

    expect(mockTaskRepository.claimTaskForExecution).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ resumeInterrupted: true }),
    );
    expect(mockTaskRepository.failRunningTaskExecutions).toHaveBeenCalledWith(
      "task-1",
      "The previous queue delivery ended before recording an outcome.",
    );
    expect(handler.handle).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        deliveryAttempt: 2,
        isRedelivery: true,
        lease: expect.objectContaining({ assertOwned: expect.any(Function) }),
      }),
    );
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

  it("retries instead of acknowledging while another execution lease is live", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success" }),
    };

    mockTaskRepository.claimTaskForExecution.mockResolvedValue(null);
    mockTaskRepository.getTaskById.mockResolvedValue({
      id: "task-1",
      status: "running",
      execution_lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const executor = new TaskExecutor({} as any, new Map([[PROJECT_TASK_RUN_TASK_TYPE, handler]]));

    await expect(
      executor.execute(createTaskMessage(PROJECT_TASK_RUN_TASK_TYPE), 2),
    ).rejects.toThrow("live execution owner");

    expect(handler.handle).not.toHaveBeenCalled();
    expect(mockTaskRepository.updateOwnedTask).not.toHaveBeenCalled();
  });

  it("does not let a stale execution owner settle the durable task", async () => {
    const handler: TaskHandler = {
      handle: vi.fn().mockResolvedValue({ status: "success" }),
    };

    mockTaskRepository.isTaskExecutionOwner.mockResolvedValue(false);
    const executor = new TaskExecutor({} as any, new Map([[PROJECT_TASK_RUN_TASK_TYPE, handler]]));

    await expect(executor.execute(createTaskMessage(PROJECT_TASK_RUN_TASK_TYPE))).rejects.toThrow(
      "owned by another delivery",
    );

    expect(mockTaskRepository.updateOwnedTask).not.toHaveBeenCalled();
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
    expect(mockTaskRepository.updateOwnedTask).not.toHaveBeenCalledWith(
      "task-1",
      expect.any(String),
      expect.objectContaining({ status: "failed" }),
    );
  });
});
