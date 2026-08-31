import { describe, expect, it, vi } from "vitest";

import { MessageRepository } from "../MessageRepository";

function createRepository() {
  const all = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ all, first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  const batch = vi.fn().mockResolvedValue([]);

  const repository = new MessageRepository({
    DB: {
      batch,
      prepare,
    },
  } as any);

  return {
    all,
    batch,
    bind,
    first,
    prepare,
    repository,
    run,
  };
}

describe("MessageRepository", () => {
  it("inserts a message batch and updates conversation metadata atomically", async () => {
    const { batch, bind, prepare, repository } = createRepository();

    await repository.createMessagesAndUpdateConversation("conversation-1", [
      { id: "message-1", role: "user", content: "Hello" },
      { id: "message-2", role: "assistant", content: "Hi" },
    ]);

    expect(batch).toHaveBeenCalledWith(expect.any(Array));
    expect(batch.mock.calls[0][0]).toHaveLength(3);
    expect(prepare.mock.calls.at(-1)?.[0]).toContain("message_count = message_count + ?");
    expect(bind).toHaveBeenLastCalledWith("message-2", 2, "conversation-1");
  });

  it("replaces a conversation's messages in a single transaction", async () => {
    const { batch, prepare, repository } = createRepository();

    await repository.replaceConversationMessages(
      "conversation-1",
      [
        { id: "message-1", role: "user", content: "Hello" },
        { id: "message-1", role: "user", content: "Hello" },
        { id: "message-2", role: "assistant", content: "Hi" },
      ],
      {
        last_message_id: "message-2",
        last_message_at: "2026-01-01T00:00:00.000Z",
        message_count: 2,
      },
    );

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(5);

    const statements = prepare.mock.calls.map((call) => call[0]);

    expect(statements[0]).toContain("DELETE FROM message");
    expect(statements[0]).toContain("id NOT IN (?, ?)");
    expect(statements.at(-1)).toContain("UPDATE conversation");
  });

  it("clears every message when the replacement set is empty", async () => {
    const { bind, prepare, repository } = createRepository();

    await repository.replaceConversationMessages("conversation-1", [], {
      last_message_id: null,
      last_message_at: null,
      message_count: 0,
    });

    expect(prepare.mock.calls[0][0]).toBe("DELETE FROM message WHERE conversation_id = ?");
    expect(bind).toHaveBeenNthCalledWith(1, "conversation-1");
  });

  it("reports failure when a message id already belongs to another conversation", async () => {
    const { batch, repository } = createRepository();

    batch.mockResolvedValue([
      { results: [] },
      { results: [{ id: "message-1" }] },
      { results: [] },
      { results: [] },
    ]);

    await expect(
      repository.replaceConversationMessages(
        "conversation-1",
        [
          { id: "message-1", role: "user", content: "Hello" },
          { id: "message-2", role: "assistant", content: "Hi" },
        ],
        { last_message_id: "message-2", last_message_at: null, message_count: 2 },
      ),
    ).resolves.toBe(false);
  });

  it("serialises structured tool arguments before binding them", async () => {
    const { bind, repository } = createRepository();

    await repository.createMessagesAndUpdateConversation("conversation-1", [
      {
        id: "message-1",
        role: "tool",
        content: "Plan updated.",
        data: {
          tool_call_id: "call-1",
          tool_call_arguments: { plan: ["Research", "Draft"] },
        },
      },
    ]);

    expect(bind.mock.calls[0][17]).toBe('{"plan":["Research","Draft"]}');
  });

  it("orders conversation messages by persisted message timestamp before insert time", async () => {
    const { prepare, repository } = createRepository();

    await repository.getConversationMessages("conversation-1");

    const query = prepare.mock.calls[0][0] as string;

    expect(query).toContain("json_extract(data, '$.realtime.turnStartedAt')");
    expect(query).toContain("json_extract(data, '$.realtime.sequence')");
    expect(query).toContain("ORDER BY COALESCE(");
    expect(query).toContain("timestamp");
    expect(query).toContain("created_at ASC");
    expect(query).toContain("id ASC");
  });

  it("deletes selected messages only within the requested conversation", async () => {
    const { bind, prepare, repository } = createRepository();

    await repository.deleteMessages("conversation-1", ["message-1", "message-1", "message-2"]);

    const query = prepare.mock.calls[0][0] as string;

    expect(query).toContain("DELETE FROM message");
    expect(query).toContain("conversation_id = ?");
    expect(query).toContain("id IN (?, ?)");
    expect(bind).toHaveBeenCalledWith("conversation-1", "message-1", "message-2");
  });

  it("calculates active conversation message metadata without the list limit", async () => {
    const { bind, first, prepare, repository } = createRepository();

    first.mockResolvedValue({ last_message_id: "message-99", message_count: 99 });

    const result = await repository.getConversationMessageMetadata("conversation-1");

    const query = prepare.mock.calls[0][0] as string;

    expect(query).toContain("COUNT(*) AS message_count");
    expect(query).toContain("SELECT id");
    expect(query).toContain("is_archived = 0");
    expect(query).toContain("ORDER BY COALESCE(");
    expect(query).toContain("DESC");
    expect(query).toContain("LIMIT 1");
    expect(query).not.toContain("LIMIT ?");
    expect(bind).toHaveBeenCalledWith("conversation-1", "conversation-1");
    expect(result).toEqual({
      last_message_id: "message-99",
      message_count: 99,
    });
  });
});
