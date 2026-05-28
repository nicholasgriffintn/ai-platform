import { describe, expect, it, vi } from "vitest";

import { MessageRepository } from "../MessageRepository";

function createRepository() {
	const all = vi.fn().mockResolvedValue({ results: [] });
	const bind = vi.fn().mockReturnValue({ all });
	const prepare = vi.fn().mockReturnValue({ bind });

	const repository = new MessageRepository({
		DB: {
			prepare,
		},
	} as any);

	return {
		all,
		bind,
		prepare,
		repository,
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
});
