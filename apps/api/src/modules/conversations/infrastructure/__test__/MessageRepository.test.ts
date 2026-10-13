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

  it("inserts compaction records, archives exact coverage, and refreshes metadata atomically", async () => {
    const { batch, bind, prepare, repository } = createRepository();

    await repository.createCompactionAndArchiveMessages(
      "conversation-1",
      [
        { id: "snapshot-1", role: "assistant", content: "Conversation snapshot" },
        { id: "snapshot-1-compaction", role: "compaction", content: "Context compacted" },
      ],
      ["message-1", "message-2", "snapshot-1-compaction"],
    );

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(4);

    const statements = prepare.mock.calls.map((call) => call[0]);

    expect(statements[2]).toContain("SET is_archived = 1");
    expect(statements[2]).toContain("id IN (?, ?, ?)");
    expect(statements[3]).toContain("message_count = (");
    expect(bind).toHaveBeenNthCalledWith(
      3,
      "conversation-1",
      "message-1",
      "message-2",
      "snapshot-1-compaction",
    );
    expect(bind).toHaveBeenNthCalledWith(
      4,
      "conversation-1",
      "conversation-1",
      "conversation-1",
      "conversation-1",
    );
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

  it("persists a run message update and its reference event atomically", async () => {
    const { batch, bind, first, prepare, repository } = createRepository();

    first.mockResolvedValueOnce({
      id: "message-1",
      conversation_id: "conversation-1",
      run_id: "run-1",
    });

    await repository.updateMessage("conversation-1", "message-1", {
      content: "Updated partial result",
      status: "in_progress",
    });

    expect(batch.mock.calls[0][0]).toHaveLength(4);
    expect(
      prepare.mock.calls.some(([query]) => query.includes("INSERT INTO conversation_run_event")),
    ).toBe(true);
    expect(bind.mock.calls.some((values) => values.includes("message.updated"))).toBe(true);
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

  it("loads a bounded older page in transcript order from an exact cursor", async () => {
    const { bind, prepare, repository } = createRepository();

    await repository.getConversationMessagesBefore("conversation-1", 101, "message-200", {
      includeArchived: true,
    });

    const query = prepare.mock.calls[0][0] as string;

    expect(query).toContain("cursor_message AS");
    expect(query).toContain("message.id < cursor_id");
    expect(query).toContain("ORDER BY COALESCE(");
    expect(query).toContain("DESC");
    expect(query).toContain("SELECT * FROM selected_messages");
    expect(query).toContain("id ASC");
    expect(bind).toHaveBeenCalledWith("conversation-1", "message-200", "conversation-1", 101);
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
