import { describe, expect, it, vi } from "vitest";

import { ConversationRepository } from "../ConversationRepository";

function createMockD1(
  results: Record<string, unknown>[] = [
    {
      id: "conversation-1",
      title: "50%_plan",
      messages: "message-1",
    },
  ],
) {
  const calls: { params: unknown[]; query: string }[] = [];
  const batch = vi.fn(async () => []);

  const db = {
    batch,
    prepare: vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ query, params });

        return {
          first: vi.fn(async () => ({ allowed: 1, total: results.length })),
          run: vi.fn(async () => ({ success: true, meta: { changes: 2 } })),
          all: vi.fn(async () => ({ results })),
        };
      },
    })),
  };

  return { batch, calls, db };
}

describe("ConversationRepository", () => {
  it("persists the caller-owned conversation type and defaults ordinary chats", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.createConversation("task-1", 123, "Review release", { type: "task" });
    await repository.createConversation("chat-1", 123, "Talk through release");

    expect(calls[0]?.query).toContain("user_id, \n         type,");
    expect(calls[0]?.params.slice(0, 4)).toEqual(["task-1", 123, "task", "Review release"]);
    expect(calls[1]?.params.slice(0, 4)).toEqual(["chat-1", 123, "chat", "Talk through release"]);
  });

  it("normalises the activity cutoff and naturally sorts titles before pagination", async () => {
    const { calls, db } = createMockD1([
      { id: "ten", title: "10. Web search" },
      { id: "two", title: "2. React artifacts" },
      { id: "one", title: "1. Ask user" },
    ]);
    const repository = new ConversationRepository({ DB: db } as any);

    const result = await repository.getUserConversations(123, {
      limit: 2,
      page: 1,
      sortBy: "title",
      updatedAfter: "2026-06-01T00:00:00.000Z",
    });

    expect(calls[0]?.query).toContain(
      "datetime(COALESCE(c.updated_at, c.last_message_at, c.created_at)) >= datetime(?)",
    );
    expect(calls[0]?.params).toEqual([123, 123, "2026-06-01T00:00:00.000Z"]);
    expect(calls[1]?.params).toEqual([123, 123, "2026-06-01T00:00:00.000Z"]);
    expect(calls[1]?.query).toContain("AS next_response_arrived");
    expect(result.conversations.map((conversation) => conversation.id)).toEqual(["one", "two"]);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
  });

  it("carries the natural title order across the page boundary", async () => {
    const { db } = createMockD1([
      { id: "ten", title: "10. Web search" },
      { id: "two", title: "2. React artifacts" },
      { id: "one", title: "1. Ask user" },
    ]);
    const repository = new ConversationRepository({ DB: db } as any);

    const result = await repository.getUserConversations(123, {
      limit: 2,
      page: 2,
      sortBy: "title",
    });

    expect(result.conversations.map((conversation) => conversation.id)).toEqual(["ten"]);
  });

  it("restores conversations by inverting the state it matches on", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.setPersonalConversationsArchived(123, { archived: false });

    expect(calls[0]?.params).toEqual([0, 123, 1]);
  });

  it("bulk deletes every personal conversation without touching project conversations", async () => {
    const { batch, calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.deleteAllPersonalConversations(123);

    expect(batch).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.query).toContain("project_id IS NULL");
      expect(call.params).toEqual([123]);
    }

    expect(calls.at(-1)?.query).toBe(
      "DELETE FROM conversation WHERE user_id = ? AND project_id IS NULL",
    );
  });

  it("keeps delegates out of lists and branch families but still finds them in search", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.getUserConversations(123);
    await repository.listConversationThreads("conversation-1", 123, null, 200);
    await repository.searchAccessibleConversations(123, "pricing", 8);

    const queries = calls.map((call) => call.query);
    const list = queries.find(
      (query) =>
        query.includes("FROM conversation c") &&
        !query.includes("WITH RECURSIVE") &&
        !query.includes("parent_title"),
    );
    const threads = queries.find((query) => query.includes("WITH RECURSIVE"));
    const search = queries.find((query) => query.includes("parent_title"));

    expect(list).toContain("'chat', 'task'");
    expect(list).not.toContain("'delegate'");
    expect(threads).toContain("'chat', 'task'");
    expect(threads).not.toContain("'delegate'");
    expect(search).toContain("'chat', 'task', 'delegate'");
  });
});
