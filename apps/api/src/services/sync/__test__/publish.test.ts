import { beforeEach, describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { clearAudienceCache, conversationAudience } from "../audience";
import { publishConversationChanged, publishRunChanged } from "../conversation-events";

interface Posted {
  url: string;
  body: { events: { topic: string; type: string }[] };
}

function createEnv(conversation: { user_id: number | null; project_id: string | null } | null) {
  const posted: Posted[] = [];
  const stubsFor: string[] = [];

  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => conversation,
          all: async () => ({ results: [] }),
        }),
      }),
    },
    USER_SYNC_COORDINATOR: {
      idFromName: (name: string) => {
        stubsFor.push(name);

        return name;
      },
      get: () => ({
        fetch: async (url: string, init?: { body?: string }) => {
          posted.push({ url, body: JSON.parse(init?.body ?? "{}") });

          return new Response(JSON.stringify({ sequences: [1] }), { status: 200 });
        },
      }),
    },
  } as unknown as IEnv;

  return { env, posted, stubsFor };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("sync publishing", () => {
  beforeEach(() => {
    clearAudienceCache();
  });

  it("posts a conversation change to the owner's coordinator", async () => {
    const { env, posted, stubsFor } = createEnv({ user_id: 42, project_id: null });

    await publishConversationChanged({ env }, "conversation-1");
    await flush();

    expect(stubsFor).toContain("42");
    expect(posted).toHaveLength(1);
    expect(posted[0].body.events.map((event) => event.topic)).toEqual([
      "conversation:conversation-1",
      "user:42",
    ]);
  });

  it("batches a run change into a single call per recipient", async () => {
    const { env, posted } = createEnv({ user_id: 42, project_id: null });

    await publishRunChanged({ env }, {
      id: "run-1",
      conversationId: "conversation-1",
      status: "running",
    } as Parameters<typeof publishRunChanged>[1]);
    await flush();

    expect(posted).toHaveLength(1);
    expect(posted[0].body.events).toHaveLength(3);
  });

  it("publishes nothing when the conversation has no owner yet", async () => {
    const { env, posted } = createEnv(null);

    await publishConversationChanged({ env }, "conversation-missing");
    await flush();

    expect(posted).toHaveLength(0);
  });

  it("does not cache an empty audience, so a later publish still resolves it", async () => {
    const { env } = createEnv(null);

    expect(await conversationAudience(env, "conversation-late")).toEqual([]);

    const { env: readyEnv } = createEnv({ user_id: 42, project_id: null });

    expect(await conversationAudience(readyEnv, "conversation-late")).toEqual([42]);
  });
});
