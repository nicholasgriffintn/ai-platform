import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskExecutionLeaseBusyError } from "../task-execution-lease";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  handleFailure: vi.fn(),
  getTaskById: vi.fn(),
}));

vi.mock("../TaskExecutor", () => ({
  TaskExecutor: class {
    execute = mocks.execute;
    handleFailure = mocks.handleFailure;
  },
}));

vi.mock("~/repositories/TaskRepository", () => ({
  TaskRepository: class {
    getTaskById = mocks.getTaskById;
  },
}));

import { QueueExecutor } from "../QueueExecutor";

function queueMessage() {
  return {
    body: {
      taskId: "task-1",
      task_type: "project_task_run",
      task_data: {},
      priority: 4,
    },
    attempts: 2,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("QueueExecutor durable ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delays redelivery while the persisted execution owner is live", async () => {
    const message = queueMessage();

    mocks.execute.mockRejectedValue(new TaskExecutionLeaseBusyError(45));

    await QueueExecutor.respondToCronQueue({} as any, { messages: [message] } as any);

    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 45 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(mocks.getTaskById).not.toHaveBeenCalled();
  });

  it("acknowledges a stale delivery after its successor has already settled", async () => {
    const message = queueMessage();

    mocks.execute.mockRejectedValue(new Error("stale owner"));
    mocks.getTaskById.mockResolvedValue({ id: "task-1", status: "completed" });

    await QueueExecutor.respondToCronQueue({} as any, { messages: [message] } as any);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(mocks.handleFailure).not.toHaveBeenCalled();
  });
});
