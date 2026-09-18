import { describe, expect, it, vi } from "vitest";

import { createEventBus } from "../events.js";
import { nextRunAt, parseInterval, runScheduledLoop } from "../schedule.js";
import { createWorker, scoreKpis } from "../worker.js";
import {
  defineWorkflow,
  runWorkflow,
  WorkflowPausedError,
  type WorkflowEvent,
  type WorkflowState,
} from "../workflow.js";

const sleep = async () => {};

describe("runWorkflow", () => {
  it("runs steps in order, passes results forward, and retries flaky steps", async () => {
    let attempts = 0;
    const events: string[] = [];
    const workflow = defineWorkflow<{ seed: number }>({
      name: "nest",
      steps: [
        { name: "gather", run: (context) => context.seed * 2 },
        {
          name: "weave",
          retry: { attempts: 3 },
          run: (_context, step) => {
            attempts += 1;

            if (attempts < 3) {
              throw new Error("twig snapped");
            }

            return `${step.results.gather}-woven`;
          },
        },
        { name: "polish", skipIf: (context) => context.seed > 1, run: () => "polished" },
      ],
    });

    const { state, results } = await runWorkflow(
      workflow,
      { seed: 2 },
      { sleep, onEvent: (event) => void events.push(event.type) },
    );

    expect(state.status).toBe("completed");
    expect(results).toEqual({ gather: 4, weave: "4-woven" });
    expect(state.steps.weave).toMatchObject({ status: "completed", attempts: 3 });
    expect(state.steps.polish.status).toBe("skipped");
    expect(events).toEqual([
      "workflow.started",
      "step.started",
      "step.completed",
      "step.started",
      "step.retrying",
      "step.started",
      "step.retrying",
      "step.started",
      "step.completed",
      "step.skipped",
      "workflow.completed",
    ]);
  });

  it("fails the workflow on a required step and continues past optional ones", async () => {
    const workflow = defineWorkflow<void>({
      name: "flight",
      steps: [
        {
          name: "optional",
          optional: true,
          run: () => {
            throw new Error("skip me");
          },
        },
        {
          name: "required",
          run: () => {
            throw new Error("grounded");
          },
        },
        { name: "never", run: () => "unreachable" },
      ],
    });
    const failed: WorkflowEvent[] = [];

    const { state } = await runWorkflow(workflow, undefined, {
      onEvent: (event) => void (event.type === "workflow.failed" && failed.push(event)),
    });

    expect(state.status).toBe("failed");
    expect(state.steps.optional).toMatchObject({ status: "failed", error: "skip me" });
    expect(state.steps.required).toMatchObject({ status: "failed", error: "grounded" });
    expect(state.steps.never.status).toBe("pending");
    expect(failed).toEqual([
      { type: "workflow.failed", workflow: "flight", step: "required", error: "grounded" },
    ]);
  });

  it("pauses on abort, persists state, and resumes from the next pending step", async () => {
    const controller = new AbortController();
    const runs: string[] = [];
    let persisted: WorkflowState | undefined;
    const workflow = defineWorkflow<void>({
      name: "migration",
      steps: [
        {
          name: "first",
          run: () => {
            runs.push("first");
            controller.abort();

            return 1;
          },
        },
        { name: "second", run: () => void runs.push("second") },
      ],
    });

    await expect(
      runWorkflow(workflow, undefined, {
        signal: controller.signal,
        persist: (state) => void (persisted = structuredClone(state)),
      }),
    ).rejects.toBeInstanceOf(WorkflowPausedError);
    expect(persisted?.status).toBe("paused");
    expect(persisted?.steps.first.status).toBe("completed");

    const resumed = await runWorkflow(workflow, undefined, { state: persisted });

    expect(resumed.state.status).toBe("completed");
    expect(runs).toEqual(["first", "second"]);
  });

  it("rejects duplicate step names and mismatched state", async () => {
    expect(() =>
      defineWorkflow({
        name: "dup",
        steps: [
          { name: "a", run: () => 1 },
          { name: "a", run: () => 2 },
        ],
      }),
    ).toThrow('defines step "a" twice');

    const workflow = defineWorkflow<void>({ name: "one", steps: [{ name: "a", run: () => 1 }] });

    await expect(
      runWorkflow(workflow, undefined, {
        state: { workflow: "other", status: "pending", steps: {} },
      }),
    ).rejects.toThrow('belongs to workflow "other"');
  });
});

describe("createEventBus", () => {
  it("delivers typed payloads, supports once, and unsubscribes", async () => {
    const bus = createEventBus<{ ping: number }>();
    const seen: number[] = [];
    const off = bus.on("ping", (value) => void seen.push(value));

    bus.once("ping", (value) => void seen.push(value * 10));
    await bus.emit("ping", 1);
    await bus.emit("ping", 2);
    off();
    await bus.emit("ping", 3);

    expect(seen).toEqual([1, 10, 2]);
    expect(bus.listenerCount("ping")).toBe(0);
  });
});

describe("schedules", () => {
  it("parses intervals and computes the next run for intervals and cron expressions", () => {
    expect(parseInterval("15m")).toBe(900_000);
    expect(parseInterval(250)).toBe(250);
    expect(() => parseInterval("soon")).toThrow("Invalid interval");

    const at = new Date("2026-09-18T10:07:00.000Z");

    expect(nextRunAt({ every: "1h" }, at)?.toISOString()).toBe("2026-09-18T11:07:00.000Z");
    expect(nextRunAt({ cron: "0 12 * * *" }, at)?.toISOString()).toBe("2026-09-18T12:00:00.000Z");
  });

  it("runs ticks on the schedule until aborted", async () => {
    const controller = new AbortController();
    let clock = 0;
    const tick = vi.fn(async () => {
      if (tick.mock.calls.length === 3) {
        controller.abort();
      }
    });

    const ticks = await runScheduledLoop({
      schedule: { every: 1000 },
      tick,
      signal: controller.signal,
      now: () => new Date(clock),
      sleep: async (ms) => void (clock += ms),
      runImmediately: true,
    });

    expect(ticks).toBe(3);
    expect(clock).toBe(2000);
  });
});

describe("createWorker", () => {
  it("scores KPIs by weight and acts only when targets are unmet", async () => {
    const evaluation = scoreKpis(
      {
        responseMinutes: { target: 30, direction: "below", weight: 3 },
        satisfaction: { target: 4.5, direction: "above" },
      },
      { responseMinutes: 45, satisfaction: 4.8 },
    );

    expect(evaluation.score).toBe(0.25);
    expect(evaluation.unmet.map((reading) => reading.name)).toEqual(["responseMinutes"]);

    const act = vi.fn(async () => "escalated");
    let minutes = 45;
    const worker = createWorker<{ responseMinutes: number }>({
      name: "support",
      kpis: { responseMinutes: { target: 30, direction: "below" } },
      measure: () => ({ responseMinutes: minutes }),
      act,
    });
    const acted: unknown[] = [];

    worker.events.on("acted", ({ result }) => void acted.push(result));
    await worker.tick();
    minutes = 10;
    await worker.tick();

    expect(act).toHaveBeenCalledTimes(1);
    expect(acted).toEqual(["escalated"]);
  });
});
