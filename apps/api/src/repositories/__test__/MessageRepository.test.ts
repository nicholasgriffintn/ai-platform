import { describe, expect, it, vi } from "vitest";

import { MessageRepository } from "../MessageRepository";

function createRepository() {
	const all = vi.fn().mockResolvedValue({ results: [] });
	const first = vi.fn().mockResolvedValue(null);
	const run = vi.fn().mockResolvedValue({ success: true });
	const bind = vi.fn().mockReturnValue({ all, first, run });
	const prepare = vi.fn().mockReturnValue({ bind });

	const repository = new MessageRepository({
		DB: {
			prepare,
		},
	} as any);

	return {
		all,
		bind,
		first,
		prepare,
		repository,
		run,
	};
}

describe("MessageRepository", () => {
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

	it("upserts messages within the same conversation", async () => {
		const { bind, first, prepare, repository } = createRepository();
		first.mockResolvedValue({ id: "message-1" });

		await repository.upsertMessage("message-1", "conversation-1", "assistant", "Hello", {
			model: "model-1",
			tool_calls: [],
		});

		const query = prepare.mock.calls[0][0] as string;
		expect(query).toContain("ON CONFLICT(id) DO UPDATE SET");
		expect(query).toContain("WHERE message.conversation_id = excluded.conversation_id");
		expect(query).toContain("RETURNING *");
		expect(bind).toHaveBeenCalledWith(
			"message-1",
			"conversation-1",
			null,
			"assistant",
			"Hello",
			null,
			null,
			null,
			"model-1",
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		);
	});

	it("deletes only messages omitted from a replacement payload", async () => {
		const { bind, prepare, repository } = createRepository();

		await repository.deleteMessagesExcept("conversation-1", [
			"message-1",
			"message-1",
			"message-2",
		]);

		const query = prepare.mock.calls[0][0] as string;
		expect(query).toContain("DELETE FROM message");
		expect(query).toContain("conversation_id = ?");
		expect(query).toContain("id NOT IN (?, ?)");
		expect(bind).toHaveBeenCalledWith("conversation-1", "message-1", "message-2");
	});
});
