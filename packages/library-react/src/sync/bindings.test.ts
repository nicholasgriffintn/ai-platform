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

  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
    invalidatedKeys.push(filters?.queryKey);
  });
  vi.spyOn(queryClient, "removeQueries").mockImplementation(() => {
    removed += 1;
  });

  return {
    context: { queryClient, localScope: "user-1" },
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

  it("drops a deleted conversation from the caches rather than refetching it", () => {
    const { context, invalidatedKeys, removeCount } = createContext();

    applySyncEvent(context, buildEvent("conversation.deleted", { conversationId: "abc" }));

    expect(removeCount()).toBe(1);
    expect(invalidatedKeys).not.toContainEqual(["chats", "abc"]);
  });

  it("ignores an event with no matching binding", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("presence.changed"));

    expect(invalidatedKeys).toHaveLength(0);
  });

  it("scopes project task refreshes to the project the event names", () => {
    const { context, invalidatedKeys } = createContext();

    applySyncEvent(context, buildEvent("project_task.changed", { projectId: "project-1" }));

    expect(invalidatedKeys).toContainEqual(["project-tasks", "project-1"]);
  });
});
