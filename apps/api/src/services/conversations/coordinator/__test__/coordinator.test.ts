import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireThread, withThreadLock, withThreadLockIfFree } from "../client";

const OWNER_TOKEN = "owner-token";
const INITIAL_EXPIRY = "2026-09-05T01:05:00.000Z";
const RENEWED_EXPIRY = "2026-09-05T01:06:00.000Z";

vi.mock("~/utils/id", () => ({
  generateId: () => OWNER_TOKEN,
}));

type CoordinatorHandler = (
  path: string,
  body: Record<string, unknown> | undefined,
) => Response | Promise<Response>;

function createEnv(handler: CoordinatorHandler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : undefined;

    return handler(new URL(url).pathname, body);
  });

  return {
    env: {
      CONVERSATION_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: fetchMock }),
      },
    } as any,
    fetchMock,
  };
}

function successfulResponse(path: string): Response {
  switch (path) {
    case "/acquire":
      return Response.json({
        acquired: true,
        currentOperation: "edit_messages",
        expiresAt: INITIAL_EXPIRY,
      });
    case "/assert":
      return Response.json({ owned: true, expiresAt: INITIAL_EXPIRY });
    case "/renew":
      return Response.json({ renewed: true, expiresAt: RENEWED_EXPIRY });
    case "/release":
      return Response.json({ released: true });
    default:
      return new Response(null, { status: 404 });
  }
}

describe("conversation coordinator client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the current operation when another owner holds the thread", async () => {
    const { env } = createEnv(() =>
      Response.json({ acquired: false, currentOperation: "user_message" }),
    );

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({
      acquired: false,
      currentOperation: "user_message",
      reason: "busy",
    });
  });

  it("uses one opaque owner token for acquisition and release", async () => {
    const requests: Array<{ path: string; body: Record<string, unknown> | undefined }> = [];
    const { env } = createEnv((path, body) => {
      requests.push({ path, body });

      return successfulResponse(path);
    });
    const acquisition = await acquireThread({
      env,
      conversationId: "conversation-1",
      kind: "edit_messages",
    });

    expect(acquisition.acquired).toBe(true);

    if (!acquisition.acquired) {
      return;
    }

    await acquisition.lease.release();

    expect(requests).toEqual([
      {
        path: "/acquire",
        body: { kind: "edit_messages", ownerToken: OWNER_TOKEN },
      },
      {
        path: "/release",
        body: { ownerToken: OWNER_TOKEN },
      },
    ]);
  });

  it("fails closed when the coordinator binding is unavailable", async () => {
    await expect(
      acquireThread({ env: {} as any, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({
      acquired: false,
      currentOperation: null,
      reason: "unavailable",
    });
  });

  it("fails closed when the coordinator cannot be reached", async () => {
    const { env } = createEnv(() => {
      throw new Error("durable object unavailable");
    });

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({
      acquired: false,
      currentOperation: null,
      reason: "unavailable",
    });
  });

  it("fails closed when the coordinator response is invalid", async () => {
    const { env } = createEnv(() => Response.json({ acquired: true }));

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({
      acquired: false,
      currentOperation: null,
      reason: "unavailable",
    });
  });

  it("asserts ownership before work and releases afterwards", async () => {
    const calls: string[] = [];
    const { env } = createEnv((path) => {
      calls.push(path);

      return successfulResponse(path);
    });

    await expect(
      withThreadLock({ env, conversationId: "conversation-1", kind: "edit_messages" }, async () => {
        calls.push("work");

        return "done";
      }),
    ).resolves.toBe("done");

    expect(calls).toEqual(["/acquire", "/assert", "work", "/release"]);
  });

  it("releases only its lease when work throws", async () => {
    const calls: string[] = [];
    const { env } = createEnv((path) => {
      calls.push(path);

      return successfulResponse(path);
    });

    await expect(
      withThreadLock({ env, conversationId: "conversation-1", kind: "edit_messages" }, async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    expect(calls).toEqual(["/acquire", "/assert", "/release"]);
  });

  it("returns a service error without running work when coordination is unavailable", async () => {
    const run = vi.fn();

    await expect(
      withThreadLock(
        { env: {} as any, conversationId: "conversation-1", kind: "edit_messages" },
        run,
      ),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(run).not.toHaveBeenCalled();
  });

  it("skips opportunistic work when the thread is busy or coordination is unavailable", async () => {
    const run = vi.fn();
    const { env } = createEnv(() =>
      Response.json({ acquired: false, currentOperation: "user_message" }),
    );

    await expect(
      withThreadLockIfFree(
        { env, conversationId: "conversation-1", kind: "session_compaction" },
        run,
      ),
    ).resolves.toBeNull();
    await expect(
      withThreadLockIfFree(
        {
          env: {} as any,
          conversationId: "conversation-1",
          kind: "session_compaction",
        },
        run,
      ),
    ).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("renews a live lease on the configured interval and stops after release", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const { env } = createEnv((path) => {
      calls.push(path);

      return successfulResponse(path);
    });
    const acquisition = await acquireThread({
      env,
      conversationId: "conversation-1",
      kind: "edit_messages",
    });

    if (!acquisition.acquired) {
      throw new Error("Expected lease acquisition");
    }

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(acquisition.lease.expiresAt).toBe(RENEWED_EXPIRY);
    await acquisition.lease.release();
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(calls).toEqual(["/acquire", "/renew", "/release"]);
  });

  it("fences the attempt after renewal fails", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const { env } = createEnv((path) => {
      calls.push(path);

      return path === "/renew" ? Response.json({ renewed: false }) : successfulResponse(path);
    });
    const acquisition = await acquireThread({
      env,
      conversationId: "conversation-1",
      kind: "edit_messages",
    });

    if (!acquisition.acquired) {
      throw new Error("Expected lease acquisition");
    }

    await vi.advanceTimersByTimeAsync(60 * 1000);
    await expect(acquisition.lease.assertOwned()).rejects.toMatchObject({ statusCode: 409 });
    await acquisition.lease.release();

    expect(calls).toEqual(["/acquire", "/renew", "/release"]);
  });
});
