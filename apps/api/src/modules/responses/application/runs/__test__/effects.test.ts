import { readFileSync } from "node:fs";

import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSqliteD1 } from "~/infrastructure/database/__test__/sqlite-d1";
import {
  PROCESS_BOUND_ABANDONED_REASON,
  PROCESS_BOUND_REFUSED_REASON,
  type RunEffectKind,
} from "~/modules/conversations/domain/run-effects";
import { buildEnqueueRunEffectStatement } from "~/modules/conversations/infrastructure/run-effect-statements";
import { RunEffectRepository } from "~/modules/conversations/infrastructure/RunEffectRepository";
import type { IEnv } from "~/types";

import { claimProcessBoundRunEffect, drainRunEffects } from "../effects";

const MIGRATION = readFileSync(
  new URL("../../../../../../migrations/0045_conversation_run_effect.sql", import.meta.url),
  "utf8",
);
const T0 = new Date("2026-11-07T12:00:00.000Z");

let sqlite: Database.Database;
let env: IEnv;

function at(offsetMs: number) {
  return new Date(T0.getTime() + offsetMs);
}

function seedRun(id: string, status = "running", attempt = 1) {
  sqlite
    .prepare(
      "INSERT INTO conversation_run (id, conversation_id, attempt, status) VALUES (?, ?, ?, ?)",
    )
    .run(id, "conversation-1", attempt, status);
}

async function enqueue(kind: RunEffectKind, runId: string, ownerToken?: string) {
  await env.DB.batch([
    buildEnqueueRunEffectStatement(env.DB, {
      kind,
      runId,
      runAttempt: 1,
      now: T0.toISOString(),
      actorUserId: 7,
      ownerToken,
    }),
  ]);
}

function effect(kind: RunEffectKind) {
  return sqlite.prepare("SELECT * FROM conversation_run_effect WHERE kind = ?").get(kind) as {
    id: string;
    status: string;
    attempt_count: number;
    available_at: string;
    last_error: string | null;
  };
}

function setEffect(kind: RunEffectKind, fields: Record<string, unknown>) {
  const columns = Object.keys(fields);

  sqlite
    .prepare(
      `UPDATE conversation_run_effect SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE kind = ?`,
    )
    .run(...Object.values(fields), kind);
}

function fence(ownerToken: string, live = true) {
  return {
    ownerToken,
    assertOwned: vi.fn(async () => {
      if (!live) {
        throw new Error("lease lost");
      }
    }),
  };
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(
    "CREATE TABLE conversation_run (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, attempt INTEGER NOT NULL, status TEXT NOT NULL)",
  );
  sqlite.exec(MIGRATION);
  env = { DB: createSqliteD1(sqlite) } as IEnv;
});

describe("drainRunEffects", () => {
  it("runs each enqueued effect once even when the enqueue is repeated", async () => {
    seedRun("run-1", "cancelled");
    await enqueue("cancel_cleanup", "run-1");
    await enqueue("cancel_cleanup", "run-1");
    const execute = vi.fn(async () => undefined);

    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => T0,
      execute,
    });
    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => T0,
      execute,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(effect("cancel_cleanup").status).toBe("succeeded");
  });

  it("backs off a failed effect and retries it once it is due", async () => {
    seedRun("run-1", "cancelled");
    await enqueue("release_follow_up", "run-1");
    const execute = vi.fn().mockRejectedValueOnce(new Error("D1 unavailable"));

    const first = await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => T0,
      execute,
    });

    expect(effect("release_follow_up")).toMatchObject({
      status: "pending",
      attempt_count: 1,
      last_error: "D1 unavailable",
    });
    expect(first.nextDrainAt).toBe(at(5_000).toISOString());

    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => at(1_000),
      execute,
    });
    expect(execute).toHaveBeenCalledTimes(1);

    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => at(5_000),
      execute,
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(effect("release_follow_up").status).toBe("succeeded");
  });

  it("requeues replay-safe work and cancels process-bound work after the process is lost", async () => {
    seedRun("run-1", "cancelled");
    seedRun("run-2");
    await enqueue("cancel_cleanup", "run-1");
    await enqueue("approval_respond", "run-2", "dead-owner");
    setEffect("cancel_cleanup", {
      status: "running",
      lease_owner: "drain-gone",
      lease_expires_at: at(-1).toISOString(),
      attempt_count: 1,
    });
    setEffect("approval_respond", { status: "running", lease_owner: "dead-owner" });
    const execute = vi.fn(async () => undefined);

    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: "new-owner",
      now: () => T0,
      execute,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(effect("cancel_cleanup")).toMatchObject({ status: "succeeded", attempt_count: 2 });
    expect(effect("approval_respond")).toMatchObject({
      status: "cancelled",
      last_error: PROCESS_BOUND_ABANDONED_REASON.running,
    });
  });

  it("leaves a running replay-safe effect alone while its lease is live and keeps the live session's work", async () => {
    seedRun("run-1", "cancelled");
    seedRun("run-2");
    await enqueue("cancel_cleanup", "run-1");
    await enqueue("approval_respond", "run-2", "live-owner");
    setEffect("cancel_cleanup", {
      status: "running",
      lease_owner: "other-drain",
      lease_expires_at: at(30_000).toISOString(),
    });
    const execute = vi.fn(async () => undefined);

    await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: "live-owner",
      now: () => T0,
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(effect("cancel_cleanup").status).toBe("running");
    expect(effect("approval_respond").status).toBe("pending");
  });
});

describe("drainRunEffects after a crash", () => {
  it("waits for a live drain lease to expire instead of re-arming at once", async () => {
    seedRun("run-1", "cancelled");
    seedRun("run-2", "cancelled");
    await enqueue("cancel_cleanup", "run-1");
    await enqueue("release_follow_up", "run-2");
    setEffect("cancel_cleanup", {
      status: "running",
      lease_owner: "crashed-drain",
      lease_expires_at: at(30_000).toISOString(),
    });
    const execute = vi.fn(async () => undefined);

    const result = await drainRunEffects({
      env,
      conversationId: "conversation-1",
      liveOwnerToken: null,
      now: () => T0,
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.nextDrainAt).toBe(at(30_000).toISOString());
  });
});

describe("claimProcessBoundRunEffect", () => {
  const target = {
    runId: "run-1",
    runAttempt: 1,
    kind: "approval_respond" as const,
    now: () => T0,
  };

  it("lets the live session act once and records the outcome", async () => {
    seedRun("run-1");
    await enqueue("approval_respond", "run-1", "owner-1");
    const repository = new RunEffectRepository(env);

    const claim = await claimProcessBoundRunEffect({
      ...target,
      repository,
      fence: fence("owner-1"),
    });

    await claim.succeed();
    expect(effect("approval_respond")).toMatchObject({ status: "succeeded", attempt_count: 1 });
    await expect(
      claimProcessBoundRunEffect({ ...target, repository, fence: fence("owner-1") }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to act when the session is no longer live", async () => {
    seedRun("run-1");
    await enqueue("approval_respond", "run-1", "owner-1");

    await expect(
      claimProcessBoundRunEffect({
        ...target,
        repository: new RunEffectRepository(env),
        fence: fence("owner-1", false),
      }),
    ).rejects.toThrow("lease lost");
    expect(effect("approval_respond")).toMatchObject({
      status: "cancelled",
      attempt_count: 0,
      last_error: PROCESS_BOUND_REFUSED_REASON,
    });
  });

  it("refuses another session without disturbing the owner's approval", async () => {
    seedRun("run-1");
    await enqueue("approval_respond", "run-1", "owner-1");

    await expect(
      claimProcessBoundRunEffect({
        ...target,
        repository: new RunEffectRepository(env),
        fence: fence("owner-2"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(effect("approval_respond").status).toBe("pending");
  });

  it("refuses once the run has stopped running", async () => {
    seedRun("run-1", "cancelling");
    await enqueue("approval_respond", "run-1", "owner-1");

    await expect(
      claimProcessBoundRunEffect({
        ...target,
        repository: new RunEffectRepository(env),
        fence: fence("owner-1"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(effect("approval_respond").status).toBe("cancelled");
  });
});
