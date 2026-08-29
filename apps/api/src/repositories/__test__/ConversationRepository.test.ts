import { describe, expect, it, vi } from "vitest";

import { ConversationRepository } from "../ConversationRepository";

function createMockD1() {
  const calls: { params: unknown[]; query: string }[] = [];
  const batch = vi.fn(async () => []);

  const db = {
    batch,
    prepare: vi.fn((query: string) => ({
      bind: (...params: unknown[]) => {
        calls.push({ query, params });

        return {
          first: vi.fn(async () => ({ allowed: 1, total: 1 })),
          run: vi.fn(async () => ({ success: true, meta: { changes: 2 } })),
          all: vi.fn(async () => ({
            results: [
              {
                id: "conversation-1",
                title: "50%_plan",
                messages: "message-1",
              },
            ],
          })),
        };
      },
    })),
  };

  return { batch, calls, db };
}

describe("ConversationRepository", () => {
  it("lists conversations by title search, archive state, and selected date sort", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    const result = await repository.getUserConversations(123, {
      archiveFilter: "archived",
      limit: 10,
      page: 2,
      query: "50%_plan",
      sortBy: "created",
    });

    expect(result.conversations).toHaveLength(1);
    expect(calls[0]?.query).toContain("c.title LIKE ? ESCAPE '\\'");
    expect(calls[0]?.query).toContain("c.is_archived = 1");
    expect(calls[0]?.query).not.toContain("content LIKE");
    expect(calls[0]?.params).toEqual([123, "%50\\%\\_plan%"]);
    expect(calls[1]?.query).toContain("ORDER BY c.created_at DESC, c.id DESC");
    expect(calls[1]?.params).toEqual([123, "%50\\%\\_plan%", 10, 10]);
  });

  it("normalises both sides of the activity cutoff and sorts titles case-insensitively", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.getUserConversations(123, {
      limit: 10,
      page: 1,
      sortBy: "title",
      updatedAfter: "2026-06-01T00:00:00.000Z",
    });

    expect(calls[0]?.query).toContain(
      "datetime(COALESCE(c.updated_at, c.last_message_at, c.created_at)) >= datetime(?)",
    );
    expect(calls[0]?.params).toEqual([123, "2026-06-01T00:00:00.000Z"]);
    expect(calls[1]?.query).toContain("ORDER BY c.title COLLATE NOCASE ASC, c.id DESC");
    expect(calls[1]?.params).toEqual([123, "2026-06-01T00:00:00.000Z", 10, 0]);
  });

  it("leaves the activity clause out when no cutoff is supplied", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.getUserConversations(123, {});

    expect(calls[0]?.query).not.toContain("datetime(?)");
    expect(calls[0]?.params).toEqual([123]);
  });

  it("only moves conversations that are not already in the requested archived state", async () => {
    const { calls, db } = createMockD1();
    const repository = new ConversationRepository({ DB: db } as any);

    await repository.setPersonalConversationsArchived(123, {
      archived: true,
      query: "50%_plan",
      updatedAfter: "2026-06-01T00:00:00.000Z",
    });

    expect(calls[0]?.query).toContain("project_id IS NULL");
    expect(calls[0]?.query).toContain("is_archived = ?");
    expect(calls[0]?.params).toEqual([1, 123, 0, "%50\\%\\_plan%", "2026-06-01T00:00:00.000Z"]);
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
});
