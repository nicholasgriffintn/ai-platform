import { describe, expect, it, vi } from "vitest";

import { ConversationRepository } from "../ConversationRepository";

function createMockD1() {
	const calls: { params: unknown[]; query: string }[] = [];

	const db = {
		prepare: vi.fn((query: string) => ({
			bind: (...params: unknown[]) => {
				calls.push({ query, params });
				return {
					first: vi.fn(async () => ({ total: 1 })),
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

	return { calls, db };
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
});
