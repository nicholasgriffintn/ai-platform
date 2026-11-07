import {
  createTaskHandlerRegistry,
  isTaskError,
  leaseBusyError,
} from "@ngriffin_uk/polychat-library-tasks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import type { TaskHandler, TaskMessage, TaskStep } from "../types";

const repository = vi.hoisted(() => ({
  claimTaskForExecution: vi.fn(),
  isTaskExecutionOwner: vi.fn(),
  updateOwnedTask: vi.fn(),
  updateTask: vi.fn(),
  failOpenTask: vi.fn(),
  failRunningTaskExecutions: vi.fn(),
  createTaskExecution: vi.fn(),
  updateTaskExecution: vi.fn(),
}));

vi.mock("~/modules/queue/infrastructure/TaskRepository", () => ({
  TaskRepository: class {
    constructor() {
      Object.assign(this, repository);
    }
  },
}));

vi.mock("~/modules/experiments/application", () => ({
  isTaskFlagType: () => false,
  evaluateServerFlag: vi.fn(),
  taskFlags: () => ({}),
}));

import { describeTaskFailure, TaskExecutor } from "../TaskExecutor";

const message: TaskMessage = {
  taskId: "task-1",
  task_type: "discover_job",
  task_data: {},
  priority: 5,
  max_attempts: 3,
};

function fakeStep(memo = new Map<string, string>(), crashOnce = new Set<string>()) {
  const sleeps: Array<[string, number]> = [];
  const step: TaskStep = {
    text: async (name, { retries }, run) => {
      const stored = memo.get(name);

      if (stored !== undefined) {
        return stored;
      }

      if (crashOnce.delete(name)) {
        throw new Error("worker evicted");
      }

      for (let attempt = 1; ; attempt++) {
        try {
          const value = await run();

          memo.set(name, value);

          return value;
        } catch (error) {
          if (attempt > retries) {
            throw error;
          }
        }
      }
    },
    do: async (_name, { retries }, run) => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await run(attempt);
        } catch (error) {
          if (isTaskError(error, "final_failure") || attempt > retries) {
            throw error;
          }
        }
      }
    },
    sleep: async (name, seconds) => {
      sleeps.push([name, seconds]);
    },
  };

  return { step, sleeps };
}

function executorFor(handler: TaskHandler) {
  return new TaskExecutor(
    {} as never,
    createTaskHandlerRegistry<TaskHandler>({ discover_job: handler }),
  );
}

describe("TaskExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.claimTaskForExecution.mockResolvedValue({ id: "task-1" });
    repository.isTaskExecutionOwner.mockResolvedValue(true);
    repository.updateOwnedTask.mockResolvedValue({ id: "task-1" });
    repository.createTaskExecution.mockResolvedValue({ id: "execution-1" });
  });

  it("retries a failing task until its attempts run out, then fails it once", async () => {
    const handle = vi.fn().mockRejectedValue(new Error("provider down"));
    const onFinalFailure = vi.fn();
    const { step } = fakeStep();

    await expect(
      executorFor({ handle, onFinalFailure }).run(message, "instance-1", step),
    ).rejects.toSatisfy((error) => isTaskError(error, "final_failure"));

    expect(handle).toHaveBeenCalledTimes(3);
    expect(onFinalFailure).toHaveBeenCalledOnce();
    expect(repository.updateOwnedTask).toHaveBeenLastCalledWith(
      "task-1",
      expect.stringMatching(/^instance-1:/),
      expect.objectContaining({ status: "failed", attempts: 3, error_message: "provider down" }),
    );
  });

  it("keeps polling inside one run until the check settles", async () => {
    const handle = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending", retryAfterSeconds: 5 })
      .mockResolvedValueOnce({ status: "pending", retryAfterSeconds: 10 })
      .mockResolvedValueOnce({ status: "success" });
    const { step, sleeps } = fakeStep();

    await executorFor({ handle }).run(message, "instance-1", step);

    expect(handle.mock.calls.map(([, , execution]) => execution.pollAttempt)).toEqual([0, 1, 2]);
    expect(sleeps).toEqual([
      ["wait-1", 5],
      ["wait-2", 10],
    ]);
    expect(repository.updateOwnedTask).toHaveBeenLastCalledWith(
      "task-1",
      expect.any(String),
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("waits for a busy resource without spending an attempt", async () => {
    const handle = vi
      .fn()
      .mockRejectedValueOnce(leaseBusyError("run-1", new Date(Date.now() + 30_000).toISOString()))
      .mockResolvedValueOnce({ status: "success" });
    const { step, sleeps } = fakeStep();

    await executorFor({ handle }).run(message, "instance-1", step);

    expect(sleeps).toEqual([["wait-1", 30]]);
    expect(handle.mock.calls.map(([, , execution]) => execution.attempt)).toEqual([1, 1]);
  });

  it("stops without running when the task was cancelled or taken by another run", async () => {
    const handle = vi.fn();
    const { step } = fakeStep();

    repository.claimTaskForExecution.mockResolvedValue(null);

    await executorFor({ handle }).run(message, "instance-2", step);

    expect(handle).not.toHaveBeenCalled();
    expect(repository.claimTaskForExecution).toHaveBeenCalledWith("task-1", {
      ownerToken: expect.stringMatching(/^instance-2:/),
      instanceId: "instance-2",
    });
  });

  it("resumes a durable task without repeating the steps it already finished", async () => {
    const research = vi.fn(async () => ["topic"]);
    const narrate = vi.fn(async () => {});
    const handler: TaskHandler = {
      durable: true,
      handle: async (_message, _env, { steps }) => {
        await steps.value("research", z.array(z.string()), research);
        await steps.run("narrate", narrate);

        return { status: "success" };
      },
    };
    const memo = new Map<string, string>();

    await expect(
      executorFor(handler).run(
        message,
        "instance-1",
        fakeStep(memo, new Set(["narrate", "fail"])).step,
      ),
    ).rejects.toThrow("worker evicted");
    await executorFor(handler).run(message, "instance-1", fakeStep(memo).step);

    expect(research).toHaveBeenCalledOnce();
    expect(narrate).toHaveBeenCalledOnce();
    expect(repository.claimTaskForExecution).toHaveBeenCalledOnce();
    expect(repository.updateOwnedTask).toHaveBeenCalledOnce();
    expect(repository.updateOwnedTask).toHaveBeenLastCalledWith(
      "task-1",
      expect.stringMatching(/^instance-1:/),
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("fails a durable task once when a step keeps failing", async () => {
    const onFinalFailure = vi.fn();
    const narrate = vi.fn().mockRejectedValue(new Error("voice unavailable"));
    const handler: TaskHandler = {
      durable: true,
      handle: async (_message, _env, { steps }) => {
        await steps.run("narrate", narrate);

        return { status: "success" };
      },
      onFinalFailure,
    };

    await expect(executorFor(handler).run(message, "instance-1", fakeStep().step)).rejects.toThrow(
      "voice unavailable",
    );

    expect(narrate).toHaveBeenCalledTimes(3);
    expect(onFinalFailure).toHaveBeenCalledOnce();
    expect(repository.updateOwnedTask).toHaveBeenLastCalledWith(
      "task-1",
      expect.any(String),
      expect.objectContaining({ status: "failed", error_message: "voice unavailable" }),
    );
  });
});

describe("describeTaskFailure", () => {
  it("keeps the underlying error on the task record", () => {
    expect(
      describeTaskFailure({
        message: "Recipe execution failed and was recorded",
        data: { error: "no such column: spend_cap_credit_micros" },
      }),
    ).toBe("Recipe execution failed and was recorded: no such column: spend_cap_credit_micros");
  });
});
