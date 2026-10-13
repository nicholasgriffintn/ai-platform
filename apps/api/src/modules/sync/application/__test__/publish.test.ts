import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSandboxSyncNotifier } from "~/modules/apps/application/sandbox/sync-events";
import { publishModelPlatformChanged } from "~/modules/model-registry/application/sync-events";
import { publishUsageChanged } from "~/modules/usage/application/events";
import { publishWorkspaceUsageChanged } from "~/modules/usage/application/workspace-events";
import type { IEnv } from "~/types";

import { createFakeUsageStore } from "../../../../../../../packages/ai-billing/src/__test__/fake-usage-store";
import { clearAudienceCache, conversationAudience } from "../audience";
import { publishConversationChanged, publishRunChanged } from "../conversation-events";
import { publishResourceEvent } from "../resource-events";

interface Posted {
  url: string;
  body: { events: { topic: string; type: string; data: Record<string, unknown> }[] };
}

function createEnv(
  conversation: {
    user_id: number | null;
    project_id: string | null;
    created_by_user_id?: number;
    conversation_id?: string;
    workspace_id?: string;
  } | null,
  members: number[] = [],
) {
  const posted: Posted[] = [];
  const stubsFor: string[] = [];
  const queries: string[] = [];

  const env = {
    DB: {
      prepare: (sql: string) => {
        queries.push(sql);

        return {
          bind: () => ({
            first: async () => conversation,
            all: async () => ({ results: members.map((user_id) => ({ user_id })) }),
          }),
        };
      },
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

  return { env, posted, stubsFor, queries };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("sync publishing", () => {
  it("pushes the authoritative credit balance only to its owner, including the originating device", async () => {
    const { env, stubsFor, posted } = createEnv(null);
    const store = createFakeUsageStore({
      balance: { spent_credit_micros: 2_000_000, reserved_credit_micros: 1_000_000 },
    });

    await publishUsageChanged({ env, originDeviceId: "device-1" }, store, 42, "2026-10");

    expect(stubsFor).toEqual(["42"]);
    expect(posted[0].body.events[0]).toMatchObject({
      topic: "user:42",
      type: "usage.changed",
      originDeviceId: null,
      data: {
        period: "2026-10",
        resets_at: "2026-11-01T00:00:00.000Z",
        credits: { included: 500, used: 2, reserved: 1 },
        credit_micros: { spent: 2_000_000, reserved: 1_000_000 },
      },
    });
  });

  it("awaits delivery to only the stored owner, including the originating device", async () => {
    const { env, stubsFor, posted } = createEnv(null);

    await publishResourceEvent(
      { env, originDeviceId: "device-1" },
      { kind: "personal", userId: 42 },
      "output.changed",
      { outputId: "output-1" },
    );

    expect(stubsFor).toEqual(["42"]);
    expect(posted[0].body.events).toEqual([
      expect.objectContaining({
        topic: "user:42",
        originDeviceId: null,
        data: { outputId: "output-1" },
      }),
    ]);
  });

  it("resolves shared-resource recipients from the persisted workspace membership", async () => {
    const { env, stubsFor, posted } = createEnv(
      { user_id: null, project_id: "project-1", workspace_id: "workspace-1" },
      [42, 43],
    );

    await publishResourceEvent(
      { env },
      { kind: "project", projectId: "project-1" },
      "document_comments.changed",
      { outputId: "output-1" },
    );

    expect(stubsFor).toEqual(["42", "43"]);
    expect(posted).toHaveLength(2);
    expect(posted[0].body.events[0].data).toEqual({
      outputId: "output-1",
      projectId: "project-1",
    });
  });

  afterEach(() => vi.useRealTimers());

  it("selects workspace administrators before delivering usage refreshes", async () => {
    const { env, posted, stubsFor, queries } = createEnv(null, [42, 43]);

    await publishWorkspaceUsageChanged(
      { env, originDeviceId: "charging-device" },
      "workspace-1",
      "2026-10",
    );

    expect(queries[0]).toContain("role IN ('owner', 'admin')");
    expect(stubsFor).toEqual(["42", "43"]);
    expect(posted[0].body.events).toEqual([
      expect.objectContaining({
        topic: "user:42",
        type: "workspace_usage.changed",
        originDeviceId: null,
        data: { workspaceId: "workspace-1", period: "2026-10" },
      }),
    ]);
  });

  it("delivers model state hints to workspace members without model or credential data", async () => {
    const { env, posted, stubsFor } = createEnv(null, [42, 43]);

    await publishModelPlatformChanged(env, "workspace-1");

    expect(stubsFor).toEqual(["42", "43"]);
    expect(posted[0].body.events[0].data).toEqual({ workspaceId: "workspace-1" });
  });

  it("coalesces sandbox stream bursts and schedules a later terminal refresh", async () => {
    vi.useFakeTimers();
    const { env, posted } = createEnv({
      user_id: 42,
      created_by_user_id: 42,
      project_id: null,
      conversation_id: "conversation-1",
    });
    const pending: Promise<unknown>[] = [];
    const notify = createSandboxSyncNotifier(env, (work) => pending.push(work));

    notify("run-1");
    notify("run-1");
    notify("run-1");
    expect(pending).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(pending);
    expect(posted).toHaveLength(1);
    expect(posted[0].body.events[0]).toMatchObject({
      type: "workbench_run.changed",
      data: { runId: "run-1", conversationId: "conversation-1" },
    });
    notify("run-1");
    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(pending);
    expect(posted).toHaveLength(2);
  });

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
