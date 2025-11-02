import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, User } from "~/types";
import * as ConversationRepoModule from "~/repositories/ConversationRepository";
import * as MessageRepoModule from "~/repositories/MessageRepository";
import { handleExportChatHistory } from "../exportChatHistory";

const baseEnv: IEnv = { DB: {} as any } as IEnv;
const user: User = {
	id: 1,
	name: "Test",
	avatar_url: null,
	email: "t@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	role: null,
	created_at: "",
	updated_at: "",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
};

describe("handleExportChatHistory", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns empty array when no conversations", async () => {
		vi.spyOn(
			ConversationRepoModule,
			"ConversationRepository",
		).mockImplementation(
			// @ts-ignore
			function () {
				return {
					getUserConversations: async () => ({
						conversations: [],
						totalPages: 0,
						pageNumber: 0,
						pageSize: 0,
					}),
				} as any;
			},
		);

		vi.spyOn(MessageRepoModule, "MessageRepository").mockImplementation(
			// @ts-ignore
			function () {
				return {
					getConversationMessages: async () => [],
				} as any;
			},
		);

		const rows = await handleExportChatHistory(baseEnv, user);
		expect(rows).toEqual([]);
	});

	it("flattens conversations and messages", async () => {
		vi.spyOn(
			ConversationRepoModule,
			"ConversationRepository",
		).mockImplementation(
			// @ts-ignore
			function () {
				return {
					getUserConversations: async () => ({
						conversations: [
							{ id: "c1", title: "T1", created_at: "2024-01-01" },
							{ id: "c2", title: "T2", created_at: "2024-01-02" },
						],
						totalPages: 1,
						pageNumber: 1,
						pageSize: 100,
					}),
				} as any;
			},
		);

		vi.spyOn(MessageRepoModule, "MessageRepository").mockImplementation(
			// @ts-ignore
			function () {
				return {
					getConversationMessages: async (conversationId: string) => {
						if (conversationId === "c1") {
							return [
								{
									id: "m1",
									role: "user",
									content: "hi",
									model: null,
									timestamp: 1,
								},
							];
						}
						return [
							{
								id: "m2",
								role: "assistant",
								content: "hey",
								model: "gpt",
								timestamp: 2,
							},
							{
								id: "m3",
								role: "user",
								content: "yo",
								model: null,
								timestamp: 3,
							},
						];
					},
				} as any;
			},
		);

		const rows = await handleExportChatHistory(baseEnv, user);
		expect(rows.length).toBe(3);
		const ids = rows.map((r) => r.message_id);
		expect(ids).toContain("m1");
		expect(ids).toContain("m2");
		expect(ids).toContain("m3");
	});

	it("paginates messages using 'after' when large list", async () => {
		const getConversationMessages = vi
			.fn()
			.mockResolvedValueOnce([
				{ id: "m1", role: "user", content: "1" },
				{ id: "m2", role: "user", content: "2" },
			])
			.mockResolvedValueOnce([]);

		vi.spyOn(
			ConversationRepoModule,
			"ConversationRepository",
		).mockImplementation(
			// @ts-ignore
			function () {
				return {
					getUserConversations: async () => ({
						conversations: [{ id: "c1", title: "T1", created_at: "2024" }],
						totalPages: 1,
						pageNumber: 1,
						pageSize: 100,
					}),
				} as any;
			},
		);

		vi.spyOn(MessageRepoModule, "MessageRepository").mockImplementation(
			// @ts-ignore
			function () {
				return {
					getConversationMessages,
				} as any;
			},
		);

		const rows = await handleExportChatHistory(baseEnv, user);
		expect(rows.length).toBe(2);
		expect(getConversationMessages).toHaveBeenCalledTimes(2);
	});
});
