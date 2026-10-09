import { leaseBusyError, leaseExpiry } from "@ngriffin_uk/polychat-library-tasks";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  handleFailure: vi.fn(),
  getTaskById: vi.fn(),
  rollUpInfraUsageMessages: vi.fn(),
}));

vi.mock("../TaskExecutor", () => ({
  TaskExecutor: class {
    execute = mocks.execute;
    handleFailure = mocks.handleFailure;
  },
}));

vi.mock("~/modules/tasks/infrastructure/TaskRepository", () => ({
  TaskRepository: class {
    getTaskById = mocks.getTaskById;
  },
}));

vi.mock("~/modules/usage/application/infra-usage-queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/usage/application/infra-usage-queue")>()),
  rollUpInfraUsageMessages: mocks.rollUpInfraUsageMessages,
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

    mocks.execute.mockRejectedValue(leaseBusyError("task-1", leaseExpiry(Date.now(), 45_000)));

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

  it("rolls request usage up separately without running it as a task", async () => {
    const task = queueMessage();
    const usage = {
      body: {
        kind: "infra_usage",
        userId: 1,
        scopeKey: "request-1",
        occurredAt: "2026-10-09T12:00:00.000Z",
        quantities: [{ unit: "d1_rows_read", quantity: 3 }],
      },
      attempts: 1,
      ack: vi.fn(),
      retry: vi.fn(),
    };

    mocks.execute.mockResolvedValue(undefined);

    await QueueExecutor.respondToCronQueue({} as any, { messages: [task, usage] } as any);

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledWith(task.body, 2);
    expect(mocks.rollUpInfraUsageMessages).toHaveBeenCalledWith({}, [usage]);
  });
});
