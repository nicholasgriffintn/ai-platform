import { describe, expect, it, vi } from "vitest";

import { createTaskHandlerRegistry } from "../handlers.js";
import { createExecutionLease, leaseExpiry, leaseRetryDelaySeconds } from "../lease.js";
import { retryDelayMs, settleTaskFailure, settleTaskSuccess } from "../outcome.js";
import { defineStatusMachine } from "../status-machine.js";

describe("task outcomes", () => {
  it("settles success as completed or suspended", () => {
    expect(settleTaskSuccess({ status: "success" }, () => 0)).toEqual({
      status: "completed",
      completedAt: "1970-01-01T00:00:00.000Z",
    });
    expect(settleTaskSuccess({ status: "suspended" })).toEqual({ status: "suspended" });
  });

  it("requeues failures with backoff until the attempt budget is spent", () => {
    const backoff = { baseDelayMs: 1000, maxDelayMs: 3000 };

    expect(settleTaskFailure(new Error("boom"), { attempts: 0, maxAttempts: 3, backoff })).toEqual({
      status: "queued",
      attempts: 1,
      error: "boom",
      retryDelayMs: 1000,
    });
    expect(settleTaskFailure("boom", { attempts: 1, maxAttempts: 3, backoff })).toMatchObject({
      status: "queued",
      attempts: 2,
      retryDelayMs: 2000,
    });
    expect(settleTaskFailure(new Error("boom"), { attempts: 2, maxAttempts: 3 })).toEqual({
      status: "failed",
      attempts: 3,
      error: "boom",
    });
    expect(retryDelayMs(4, backoff)).toBe(3000);
    expect(retryDelayMs(4)).toBe(0);
  });
});

describe("execution leases", () => {
  it("renews on schedule, reports ownership, and stops cleanly", async () => {
    const callbacks: Array<() => void> = [];
    const store = {
      renew: vi.fn(async ({ expiresAt }: { expiresAt: string }) => expiresAt),
      isOwner: vi.fn(async () => true),
    };
    const lease = createExecutionLease({
      store,
      taskId: "t1",
      ownerToken: "owner",
      initialExpiresAt: leaseExpiry(0, 1000),
      durationMs: 1000,
      renewalIntervalMs: 100,
      now: () => 500,
      schedule: (callback) => {
        callbacks.push(callback);

        return () => callbacks.splice(callbacks.indexOf(callback), 1);
      },
    });

    expect(lease.expiresAt).toBe("1970-01-01T00:00:01.000Z");
    callbacks.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.renew).toHaveBeenCalledWith({
      taskId: "t1",
      ownerToken: "owner",
      expiresAt: "1970-01-01T00:00:01.500Z",
    });
    expect(lease.expiresAt).toBe("1970-01-01T00:00:01.500Z");
    await lease.assertOwned();
    await lease.stop();
    expect(callbacks).toHaveLength(0);
    await expect(lease.assertOwned()).rejects.toMatchObject({ code: "ownership_lost" });
  });

  it("marks the lease lost when the store no longer recognises the owner", async () => {
    const store = { renew: vi.fn(async () => null), isOwner: vi.fn(async () => false) };
    const lease = createExecutionLease({
      store,
      taskId: "t2",
      ownerToken: "owner",
      initialExpiresAt: leaseExpiry(),
      schedule: () => () => {},
    });

    await expect(lease.assertOwned()).rejects.toMatchObject({
      code: "ownership_lost",
      details: { taskId: "t2" },
    });
    expect(leaseRetryDelaySeconds(new Date(90_500).toISOString(), 0)).toBe(91);
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
