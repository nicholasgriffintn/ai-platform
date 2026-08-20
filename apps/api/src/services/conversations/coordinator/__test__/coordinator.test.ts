import { beforeEach, describe, expect, it, vi } from "vitest";

import { acquireThread, releaseThread } from "../client";

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

  it("does not block work when the coordinator cannot be reached", async () => {
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
    ).resolves.toEqual({ acquired: true });
  });

  it("releases without throwing when the coordinator is absent", async () => {
    await expect(
      releaseThread({ env: {} as any, conversationId: "conversation-1" }),
    ).resolves.toBeUndefined();
  });
});
