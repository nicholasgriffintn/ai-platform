import { beforeEach, describe, expect, it, vi } from "vitest";

import { acquireThread, releaseThread, withThreadLock, withThreadLockIfFree } from "../client";

function createEnv(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname } = new URL(url);

    return Response.json(responses[pathname] ?? {});
  });

  return {
    CONVERSATION_COORDINATOR: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: fetchMock }),
    },
  } as any;
}

describe("acquireThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports the thread as taken when another operation holds it", async () => {
    const env = createEnv({ "/acquire": { acquired: false, currentOperation: "user_message" } });

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toMatchObject({ acquired: false, currentOperation: "user_message" });
  });

  it("takes a free thread", async () => {
    const env = createEnv({ "/acquire": { acquired: true, currentOperation: "compact" } });

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toMatchObject({ acquired: true });
  });

  it("treats a deployment without the coordinator as a free thread", async () => {
    await expect(
      acquireThread({ env: {} as any, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({ acquired: true });
  });

  it("refuses rather than granting a lock it could not take", async () => {
    const env = {
      CONVERSATION_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: vi.fn(async () => {
            throw new Error("durable object unavailable");
          }),
        }),
      },
    } as any;

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({ acquired: false, currentOperation: null });
  });

  it("refuses when the coordinator answers with an error status", async () => {
    const env = {
      CONVERSATION_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: vi.fn(async () => new Response("boom", { status: 500 })),
        }),
      },
    } as any;

    await expect(
      acquireThread({ env, conversationId: "conversation-1", kind: "compact" }),
    ).resolves.toEqual({ acquired: false, currentOperation: null });
  });

  it("releases without throwing when the coordinator is absent", async () => {
    await expect(
      releaseThread({ env: {} as any, conversationId: "conversation-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("withThreadLock", () => {
  it("runs the work and releases the thread afterwards", async () => {
    const calls: string[] = [];
    const env = {
      CONVERSATION_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: vi.fn(async (url: string) => {
            calls.push(new URL(url).pathname);

            return Response.json({ acquired: true });
          }),
        }),
      },
    } as any;

    await expect(
      withThreadLock({ env, conversationId: "conversation-1", kind: "edit_messages" }, async () => {
        calls.push("work");

        return "done";
      }),
    ).resolves.toBe("done");

    expect(calls).toEqual(["/acquire", "work", "/release"]);
  });

  it("releases the thread when the work throws", async () => {
    const calls: string[] = [];
    const env = {
      CONVERSATION_COORDINATOR: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: vi.fn(async (url: string) => {
            calls.push(new URL(url).pathname);

            return Response.json({ acquired: true });
          }),
        }),
      },
    } as any;

    await expect(
      withThreadLock({ env, conversationId: "conversation-1", kind: "edit_messages" }, async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    expect(calls).toEqual(["/acquire", "/release"]);
  });

  it("refuses the work when another operation holds the thread", async () => {
    const run = vi.fn();
    const env = createEnv({ "/acquire": { acquired: false, currentOperation: "user_message" } });

    await expect(
      withThreadLock({ env, conversationId: "conversation-1", kind: "edit_messages" }, async () => {
        run();
      }),
    ).rejects.toThrow(/already working on something/);

    expect(run).not.toHaveBeenCalled();
  });

  it("skips optional work rather than refusing it", async () => {
    const run = vi.fn();
    const env = createEnv({ "/acquire": { acquired: false, currentOperation: "user_message" } });

    await expect(
      withThreadLockIfFree(
        { env, conversationId: "conversation-1", kind: "session_compaction" },
        async () => {
          run();

          return "compacted";
        },
      ),
    ).resolves.toBeNull();

    expect(run).not.toHaveBeenCalled();
  });
});
