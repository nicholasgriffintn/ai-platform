import { isTaskError } from "@ngriffin_uk/polychat-library-tasks";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { createWorkflows, PENDING, type TaskExecutionContext, type TaskMessage } from "../index.js";

type Env = { FLAG?: string };

function createHarness(now = () => Date.parse("2026-09-18T10:00:00.000Z")) {
  const enqueue = vi.fn(async () => "task-2");
  const workflows = createWorkflows<Env, "sync" | "poll_job" | "raw">({
    queue: () => ({ enqueue }),
    now,
  });
  const execution: TaskExecutionContext = {
    deliveryAttempt: 1,
    isRedelivery: false,
    lease: { ownerToken: "o", expiresAt: "", assertOwned: async () => {} },
  };
  const message = (type: "sync" | "poll_job" | "raw", task_data: Record<string, unknown>) =>
    ({
      taskId: "task-1",
      task_type: type,
      task_data,
      priority: 5,
      user_id: 7,
    }) satisfies TaskMessage<"sync" | "poll_job" | "raw">;

  return { workflows, enqueue, execution, message };
}

describe("on", () => {
  it("validates the payload against the schema before handing it to the task", async () => {
    const { workflows, execution, message } = createHarness();
    const handle = vi.fn(async (payload: { day: string }) => ({
      status: "success" as const,
      data: { day: payload.day },
    }));

    workflows.on("sync", { payload: z.object({ day: z.string() }), handle });

    const handler = workflows.handlers().resolve("sync");

    await expect(
      handler.handle(message("sync", { day: "2026-09-17" }), {}, execution),
    ).resolves.toEqual({ status: "success", data: { day: "2026-09-17" } });
    await expect(handler.handle(message("sync", { day: 3 }), {}, execution)).rejects.toSatisfy(
      (error) => isTaskError(error, "invalid_payload"),
    );
  });

  it("passes raw task data through when no schema is declared and defaults to success", async () => {
    const { workflows, execution, message } = createHarness();
    const seen: unknown[] = [];

    workflows.on("raw", {
      handle: async (payload) => {
        seen.push(payload);
      },
    });

    await expect(
      workflows
        .handlers()
        .resolve("raw")
        .handle(message("raw", { anything: 1 }), {}, execution),
    ).resolves.toEqual({ status: "success" });
    expect(seen).toEqual([{ anything: 1 }]);
  });
});

describe("poll", () => {
  const payload = z.object({ jobId: z.string(), pollAttempt: z.number().optional() });

  it("re-queues itself with the next attempt while the check is pending", async () => {
    const { workflows, enqueue, execution, message } = createHarness();

    workflows.poll("poll_job", { payload, check: async () => PENDING });

    const result = await workflows
      .handlers()
      .resolve("poll_job")
      .handle(message("poll_job", { jobId: "j1", pollAttempt: 1 }), {}, execution);

    expect(result).toMatchObject({ status: "success", data: { pollAttempt: 2 } });
    expect(enqueue).toHaveBeenCalledWith({
      task_type: "poll_job",
      user_id: 7,
      project_id: undefined,
      task_data: { jobId: "j1", pollAttempt: 2 },
      schedule_type: "scheduled",
      scheduled_at: "2026-09-18T10:00:10.000Z",
      priority: 5,
    });
  });

  it("returns the check result and stops polling once the job settles", async () => {
    const { workflows, enqueue, execution, message } = createHarness();

    workflows.poll("poll_job", {
      payload,
      check: async ({ jobId }) => ({ status: "success", data: { jobId } }),
    });

    await expect(
      workflows
        .handlers()
        .resolve("poll_job")
        .handle(message("poll_job", { jobId: "j1" }), {}, execution),
    ).resolves.toEqual({ status: "success", data: { jobId: "j1" } });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("gives up after the attempt cap instead of polling forever", async () => {
    const { workflows, enqueue, execution, message } = createHarness();
    const onExhausted = vi.fn(async () => undefined);

    workflows.poll("poll_job", {
      payload,
      maxAttempts: 3,
      check: async () => PENDING,
      onExhausted,
    });

    const result = await workflows
      .handlers()
      .resolve("poll_job")
      .handle(message("poll_job", { jobId: "j1", pollAttempt: 3 }), {}, execution);

    expect(result).toMatchObject({ status: "error" });
    expect(onExhausted).toHaveBeenCalledOnce();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("every", () => {
  it("runs the jobs registered for the fired cron plus the always jobs, isolating failures", async () => {
    const { workflows } = createHarness();
    const order: string[] = [];

    workflows.always({ name: "recover", run: async () => void order.push("recover") });
    workflows.every("0 4 * * *", { name: "nightly", run: async () => void order.push("nightly") });
    workflows.every("0 4 * * *", {
      name: "broken",
      run: async () => {
        throw new Error("boom");
      },
    });
    workflows.every("0 4 * * *", {
      name: "flagged",
      enabledWhen: (env) => env.FLAG === "true",
      run: async () => void order.push("flagged"),
    });
    workflows.every("*/15 * * * *", { name: "other", run: async () => void order.push("other") });

    const report = await workflows.runCron({}, { cron: "0 4 * * *", scheduledTime: 0 });

    expect(order).toEqual(["recover", "nightly"]);
    expect(report).toMatchObject({ matched: ["recover", "nightly"], skipped: ["flagged"] });
    expect(report.failed.map((entry) => entry.name)).toEqual(["broken"]);
    expect(workflows.crons()).toEqual(["0 4 * * *", "*/15 * * * *"]);
  });
});
