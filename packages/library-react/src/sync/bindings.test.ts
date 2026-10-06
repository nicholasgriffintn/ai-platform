import type { DeviceSyncEvent, DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { applySyncEvent, invalidateSyncQueries, SYNC_BINDINGS } from "./bindings.js";

function buildEvent(
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): DeviceSyncEvent {
  return {
    v: 1,
    topic: "user:1",
    seq: 1,
    at: new Date().toISOString(),
    type,
    originDeviceId: null,
    data,
  };
}

function createContext() {
  const queryClient = new QueryClient();
  const invalidatedKeys: unknown[] = [];
  let removed = 0;

  vi.spyOn(queryClient, "removeQueries").mockImplementation(() => {
    removed += 1;
  });

  return {
    context: {
      queryClient,
      localScope: "user-1",
      invalidate: (queryKey: readonly unknown[]) => invalidatedKeys.push([...queryKey]),
    },
    invalidatedKeys,
    removeCount: () => removed,
  };
}

describe("sync bindings", () => {
  it.each([
    ["document_comments.changed", { outputId: "output-1" }, ["outputs", "comments", "output-1"]],
    ["knowledge_sync.changed", { projectId: "project-1" }, ["knowledge-syncs", "project-1"]],
    ["project_review.changed", { projectId: "project-1" }, ["project-pr-reviews", "project-1"]],
    ["model_platform.changed", { workspaceId: "workspace-1" }, ["model-platform", "workspace-1"]],
  ] satisfies [DeviceSyncEventType, Record<string, unknown>, string[]][])(
    "refreshes the affected scope for %s",
    (type, data, expectedKey) => {
      const { context, invalidatedKeys } = createContext();

      applySyncEvent(context, buildEvent(type, data));
      expect(invalidatedKeys).toContainEqual(expectedKey);
    },
  );

  it("marks workspace usage stale without fetching it again", async () => {
    const client = new QueryClient();
    const queryKey = ["usage", "workspace", "workspace-1", "2026-10"];
    const fetchUsage = vi.fn(async () => ({}));

    client.setQueryData(queryKey, {});
    client.setQueryData(["usage", "workspace", "workspace-2", "2026-10"], {});
    const unsubscribe = new QueryObserver(client, {
      queryKey,
      queryFn: fetchUsage,
      staleTime: Infinity,
    }).subscribe(() => undefined);

    applySyncEvent(
      { queryClient: client, localScope: "user-1", invalidate: vi.fn() },
      buildEvent("workspace_usage.changed", { workspaceId: "workspace-1" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchUsage).not.toHaveBeenCalled();
    expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["usage", "workspace", "workspace-2", "2026-10"])?.isInvalidated,
    ).toBe(false);
    unsubscribe();
    client.clear();
  });

  it("refreshes generated results and channel pairing from persisted changes", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("output.changed"));
    applySyncEvent(context, buildEvent("channel_senders.changed"));

    expect(invalidatedKeys).toContainEqual(["canvas"]);
    expect(invalidatedKeys).toContainEqual(["replicate"]);
    expect(invalidatedKeys).toContainEqual(["channel-senders"]);
  });

  it("applies pushed credit balances without refetching active usage queries", async () => {
    const client = new QueryClient();
    const keys = [
      ["usage", "balance"],
      ["usage", "summary", "current"],
      ["usage", "events", "current", "all"],
      ["usage", "workspace", "workspace-1", "2026-10"],
    ];
    const fetchUsage = vi.fn(async () => ({}));
    const subscriptions = keys.map((queryKey) => {
      client.setQueryData(queryKey, {});

      return new QueryObserver(client, {
        queryKey,
        queryFn: fetchUsage,
        staleTime: Infinity,
      }).subscribe(() => undefined);
    });
    const period = new Date().toISOString().slice(0, 7);
    const balance = {
      period,
      resets_at: "2026-11-01T00:00:00.000Z",
      plan_id: "free",
      credits: {
        included: 100,
        used: 2,
        reserved: 0,
        grace: 10,
        overrun: 0,
        overage: 0,
        overage_enabled: false,
        state: "ok",
      },
      credit_micros: {
        included: 100_000_000,
        spent: 2_000_000,
        reserved: 0,
        grace: 10_000_000,
        overrun: 0,
        overage: 0,
      },
      last_event_at: null,
    };

    try {
      for (let index = 0; index < 5; index++) {
        applySyncEvent(
          {
            queryClient: client,
            localScope: "user-1",
            invalidate: (queryKey) => {
              void client.invalidateQueries({ queryKey });
            },
          },
          buildEvent("usage.changed", balance),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      expect(fetchUsage).not.toHaveBeenCalled();
      expect(client.getQueryData(["usage", "balance"])).toEqual(balance);
      expect(client.getQueryState(["usage", "summary", "current"])?.isInvalidated).toBe(true);
      expect(client.getQueryState(keys[3])?.isInvalidated).toBe(false);
    } finally {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      client.clear();
    }
  });

  it("refreshes memory synthesis queries when their backing task changes", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("task.changed"));
    expect(invalidatedKeys).toContainEqual(["memory-synthesis"]);
    expect(invalidatedKeys).toContainEqual(["memory-synthesis-history"]);
  });

  it("recovers live query families after replay history has expired", () => {
    const { context, invalidatedKeys } = createContext();

    invalidateSyncQueries(context.invalidate);
    expect(invalidatedKeys).toContainEqual(["usage"]);
    expect(invalidatedKeys).toContainEqual(["project-task"]);
    expect(invalidatedKeys).toContainEqual(["conversation-delegations"]);
    expect(invalidatedKeys).toContainEqual(["machines"]);
  });

  it("refreshes all run filters for a project when the event omits a conversation", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("workbench_run.changed", { projectId: "project-1" }));
    expect(invalidatedKeys).toContainEqual(["project-workbench-runs", "project-1"]);
  });

  it("covers every declared event type exactly once", () => {
    const types = SYNC_BINDINGS.map((binding) => binding.type);

    expect(new Set(types).size).toBe(types.length);
  });

  it("refreshes the conversation and the chat list when a run changes", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("run.changed", { conversationId: "abc" }));

    expect(invalidatedKeys).toContainEqual(["chats", "abc"]);
    expect(invalidatedKeys).toContainEqual(["chats", "remote"]);
  });

  it("refreshes conversation context without refreshing the chat list or goal", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("message.changed", { conversationId: "abc" }));

    expect(invalidatedKeys).toEqual([
      ["chats", "abc"],
      ["conversation-brief", "abc"],
    ]);
  });

  it("drops a deleted conversation from the caches rather than refetching it", () => {
    const { context, invalidatedKeys, removeCount } = createContext();

    applySyncEvent(context, buildEvent("conversation.deleted", { conversationId: "abc" }));

    expect(removeCount()).toBe(1);
    expect(invalidatedKeys).not.toContainEqual(["chats", "abc"]);
  });

  it("binds only event types the server actually publishes", () => {
    const bound = new Set(SYNC_BINDINGS.map((binding) => binding.type));

    for (const type of ["conversation.changed", "run.changed", "message.changed"] as const) {
      expect(bound.has(type)).toBe(true);
    }
  });

  it("scopes project task refreshes to the project the event names", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("project_task.changed", { projectId: "project-1" }));

    expect(invalidatedKeys).toContainEqual(["project-tasks", "project-1"]);
  });

  it("refreshes an open task detail when its project task changes", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(
      context,
      buildEvent("project_task.changed", { projectId: "project-1", taskId: "task-1" }),
    );

    expect(invalidatedKeys).toContainEqual(["project-task", "project-1"]);
  });
});
