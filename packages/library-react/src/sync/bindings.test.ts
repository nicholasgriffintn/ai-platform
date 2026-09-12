import type { DeviceSyncEvent, DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { applySyncEvent, SYNC_BINDINGS } from "./bindings.js";

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
