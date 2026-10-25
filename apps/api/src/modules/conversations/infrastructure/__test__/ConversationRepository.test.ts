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
  const batch = vi.fn(async (statements: { query: string }[]) =>
    statements.map((statement) => ({
      success: true,
      meta: {},
      results: statement.query.includes("COUNT(*)") ? [{ total: results.length }] : results,
    })),
  );

  const db = {
    batch,
    prepare: vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ query, params });

        return {
          query,
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

    const result = await repository.listUserConversations(123, {
      limit: 2,
      sortBy: "title",
      updatedAfter: "2026-06-01T00:00:00.000Z",
    });

    expect(calls[0]?.query).toContain(
      "datetime(COALESCE(c.updated_at, c.last_message_at, c.created_at)) >= datetime(?)",
    );
    expect(calls[0]?.params).toEqual([123, 123, "chat", "task", "2026-06-01T00:00:00.000Z"]);
    expect(calls[0]?.query).toContain("AS next_response_arrived");
    expect(result.data.map((conversation) => conversation.id)).toEqual(["one", "two"]);
    expect(result.has_more).toBe(true);
    expect(result.last_id).toBe("two");
  });

  it("pages after a cursor by pin, recency and id instead of an offset", async () => {
    const { calls, db } = createMockD1([
      { id: "b", title: "Second" },
      { id: "c", title: "Third" },
    ]);
    const repository = new ConversationRepository({ DB: db } as any);

    const result = await repository.listUserConversations(123, { limit: 1, after: "a" });

    expect(calls[0]?.query).toContain(
      "(COALESCE(state.is_pinned, 0), COALESCE(c.updated_at, c.created_at), c.id) < (",
    );
    expect(calls[0]?.query).not.toContain("OFFSET");
    expect(calls[0]?.params.slice(-3)).toEqual([123, "a", 2]);
    expect(result).toEqual({
      object: "list",
      data: [{ id: "b", title: "Second" }],
      has_more: true,
      last_id: "b",
    });
  });

  it("carries the natural title order across the page boundary", async () => {
    const { db } = createMockD1([
      { id: "ten", title: "10. Web search" },
      { id: "two", title: "2. React artifacts" },
      { id: "one", title: "1. Ask user" },
    ]);
    const repository = new ConversationRepository({ DB: db } as any);

    const result = await repository.listUserConversations(123, {
      limit: 2,
      after: "two",
      sortBy: "title",
    });

    expect(result.data.map((conversation) => conversation.id)).toEqual(["ten"]);
    expect(result.has_more).toBe(false);
  });

  it("restores conversations by inverting the state it matches on", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.setPersonalConversationsArchived(123, { archived: false });

    expect(calls[0]?.params).toEqual([0, 123, "chat", "task", 1]);
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

    await repository.listUserConversations(123);
    await repository.listConversationThreads("conversation-1", 123, null, 200);
    await repository.searchAccessibleConversations(123, "pricing", 8);

    const paramsFor = (matches: (query: string) => boolean) =>
      calls.find((call) => matches(call.query))?.params ?? [];
    const list = paramsFor(
      (query) =>
        query.includes("FROM conversation c") &&
        !query.includes("WITH RECURSIVE") &&
        !query.includes("parent_title"),
    );
    const threads = paramsFor((query) => query.includes("WITH RECURSIVE"));
    const search = paramsFor((query) => query.includes("parent_title"));

    expect(list).toEqual(expect.arrayContaining(["chat", "task"]));
    expect(list).not.toContain("delegate");
    expect(threads).toEqual(expect.arrayContaining(["chat", "task"]));
    expect(threads).not.toContain("delegate");
    expect(search).toEqual(expect.arrayContaining(["chat", "task", "delegate"]));
  });
});
