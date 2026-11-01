import { describe, expect, it } from "vitest";

import { busyRetryDelaySeconds, leaseBusyError } from "../errors.js";
import { createTaskHandlerRegistry } from "../handlers.js";
import { settleTaskFailure, settleTaskSuccess } from "../outcome.js";
import { defineStatusMachine } from "../status-machine.js";

describe("task outcomes", () => {
  it("settles success as completed or suspended", () => {
    expect(settleTaskSuccess({ status: "success" }, () => 0)).toEqual({
      status: "completed",
      completedAt: "1970-01-01T00:00:00.000Z",
    });
    expect(settleTaskSuccess({ status: "suspended" })).toEqual({ status: "suspended" });
  });

  it("fails a non-retryable error on its first attempt", () => {
    expect(
      settleTaskFailure(new Error("secret missing"), {
        attempts: 0,
        maxAttempts: 3,
        retryable: false,
      }),
    ).toEqual({ status: "failed", attempts: 1, error: "secret missing" });
  });

  it("requeues failures until the attempt budget is spent", () => {
    expect(settleTaskFailure(new Error("boom"), { attempts: 0, maxAttempts: 3 })).toEqual({
      status: "queued",
      attempts: 1,
      error: "boom",
    });
    expect(settleTaskFailure(new Error("boom"), { attempts: 2, maxAttempts: 3 })).toEqual({
      status: "failed",
      attempts: 3,
      error: "boom",
    });
  });

  it("waits until a busy task's holder expires before trying again", () => {
    expect(busyRetryDelaySeconds(leaseBusyError("t1", new Date(90_500).toISOString()), 0)).toBe(91);
    expect(busyRetryDelaySeconds(leaseBusyError("t1", "not a date"), 0)).toBe(1);
  });
});

describe("handler registry", () => {
  it("resolves handlers by type and refuses duplicates", () => {
    const registry = createTaskHandlerRegistry<{ handle: () => string }>({
      sync: { handle: () => "sync" },
    });

    registry.register("poll", { handle: () => "poll" });
    expect(registry.resolve("poll").handle()).toBe("poll");
    expect(registry.types()).toEqual(["sync", "poll"]);
    expect(() => registry.register("poll", { handle: () => "" })).toThrowError(
      expect.objectContaining({ code: "duplicate_handler" }),
    );
    expect(() => registry.resolve("missing")).toThrowError(
      expect.objectContaining({ code: "unknown_handler" }),
    );
  });
});

describe("status machine", () => {
  const machine = defineStatusMachine<"backlog" | "review" | "done", "user" | "model">({
    terminal: ["done"],
    allowed: { user: ["backlog", "review", "done"], model: ["backlog", "review"] },
    reopenBy: ["user"],
    describeRefusal: ({ actor, to }) =>
      actor === "model" && to === "done" ? "Only a person accepts a task." : undefined,
  });

  it("applies actor permissions and terminal reopening rules", () => {
    expect(machine.canTransition({ actor: "model", from: "backlog", to: "review" })).toBe(true);
    expect(machine.canTransition({ actor: "model", from: "done", to: "done" })).toBe(true);
    expect(() => machine.assertTransition({ actor: "model", from: "review", to: "done" })).toThrow(
      "Only a person accepts a task.",
    );
    expect(() => machine.assertTransition({ actor: "model", from: "done", to: "backlog" })).toThrow(
      "cannot reopen a task that is done",
    );
    expect(() =>
      machine.assertTransition({ actor: "user", from: "done", to: "backlog" }),
    ).not.toThrow();
  });
});
