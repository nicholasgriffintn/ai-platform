import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationManager } from "~/lib/conversationManager";
import type { Database } from "~/lib/database";
import type { IEnv } from "~/types";
import {
	handleCompactChatCompletion,
	type CompactChatCompletionContext,
} from "../compactChatCompletion";

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn().mockResolvedValue({
		model: "summary-model",
		provider: "test-provider",
	}),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => ({
		getResponse: vi.fn().mockResolvedValue({
			response: "Earlier wine bottle reuse ideas were discussed.",
		}),
	})),
}));

vi.mock("~/utils/id", () => ({
	generateId: () => "snapshot-id",
}));

describe("handleCompactChatCompletion", () => {
	const user = {
		id: 123,
		name: "Test User",
		avatar_url: null,
		email: "test@example.com",
		github_username: null,
		company: null,
		site: null,
		location: null,
		bio: null,
		twitter_username: null,
		created_at: "2023-01-01T00:00:00Z",
		updated_at: "2023-01-01T00:00:00Z",
		setup_at: null,
		terms_accepted_at: null,
		plan_id: null,
	};
	const env = { AI: {} } as IEnv;
	const database = {} as Database;
	const context: CompactChatCompletionContext = {
		database,
		ensureDatabase: vi.fn(),
		env,
		requireUser: vi.fn(() => user),
	};

	let conversationManager: ConversationManager;
	let addSpy: ReturnType<typeof vi.spyOn>;
	let archiveMessagesSpy: ReturnType<typeof vi.spyOn>;
	let getAllMessagesSpy: ReturnType<typeof vi.spyOn>;
	let getConversationDetailsSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.restoreAllMocks();
		conversationManager = ConversationManager.getInstance({
			database: context.database,
			user,
			env: context.env,
		});
		vi.spyOn(ConversationManager, "getInstance").mockReturnValue(conversationManager);
		addSpy = vi.spyOn(conversationManager, "add").mockResolvedValue(undefined);
		archiveMessagesSpy = vi
			.spyOn(conversationManager, "archiveMessages")
			.mockResolvedValue(undefined);
		getAllMessagesSpy = vi.spyOn(conversationManager, "getAllMessages").mockResolvedValue(
			Array.from({ length: 30 }, (_, index) => ({
				id: `msg-${index}`,
				role: index % 2 === 0 ? "user" : "assistant",
				content: `message ${index}`,
				timestamp: 1000 + index,
			})),
		);
		getConversationDetailsSpy = vi
			.spyOn(conversationManager, "getConversationDetails")
			.mockResolvedValue({
				id: "conversation-1",
				messages: [
					{ id: "msg-0", role: "user", content: "message 0" },
					{
						id: "snapshot-id-compaction",
						role: "compaction",
						content: "Context compacted",
						parts: [
							{
								type: "compaction",
								status: "completed",
								label: "Context compacted",
							},
						],
					},
				],
			});
	});

	it("compacts stored history without adding a command message or model response", async () => {
		const result = await handleCompactChatCompletion(context, "conversation-1");

		expect(getAllMessagesSpy).toHaveBeenCalledWith("conversation-1", {
			includeArchived: false,
		});
		expect(addSpy).toHaveBeenNthCalledWith(
			1,
			"conversation-1",
			expect.objectContaining({
				id: "snapshot-id",
				parts: expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
			}),
		);
		expect(addSpy).toHaveBeenNthCalledWith(
			2,
			"conversation-1",
			expect.objectContaining({
				id: "snapshot-id-compaction",
				completion_id: "conversation-1",
				role: "compaction",
				content: "Context compacted",
				parts: expect.arrayContaining([
					expect.objectContaining({
						type: "compaction",
						status: "completed",
					}),
				]),
			}),
		);
		expect(archiveMessagesSpy).toHaveBeenCalledWith(
			"conversation-1",
			expect.arrayContaining(["msg-0", "snapshot-id-compaction"]),
		);
		expect(getConversationDetailsSpy).toHaveBeenCalledWith("conversation-1", {
			includeArchived: true,
			includeSnapshots: false,
		});
		expect(addSpy).not.toHaveBeenCalledWith(
			"conversation-1",
			expect.objectContaining({
				content: "/compact",
			}),
		);
		expect(result).toEqual({
			compacted: true,
			conversation: {
				id: "conversation-1",
				messages: [
					{ id: "msg-0", role: "user", content: "message 0" },
					{
						id: "snapshot-id-compaction",
						role: "compaction",
						content: "Context compacted",
						parts: [
							{
								type: "compaction",
								status: "completed",
								label: "Context compacted",
							},
						],
					},
				],
			},
		});
	});

	it("rejects manual compaction when the compacted history cannot be persisted", async () => {
		archiveMessagesSpy.mockRejectedValueOnce(new Error("archive failed"));

		await expect(handleCompactChatCompletion(context, "conversation-1")).rejects.toThrow(
			"archive failed",
		);
		expect(getConversationDetailsSpy).not.toHaveBeenCalled();
	});

	it("returns the visible conversation without inserting markers when there is nothing to compact", async () => {
		getAllMessagesSpy.mockResolvedValueOnce([
			{
				id: "system-1",
				role: "system",
				content: "System prompt",
			},
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			},
		]);
		getConversationDetailsSpy.mockResolvedValueOnce({
			id: "conversation-1",
			messages: [
				{
					id: "assistant-1",
					role: "assistant",
					content: "Previous answer",
				},
			],
		});

		const result = await handleCompactChatCompletion(context, "conversation-1");

		expect(addSpy).not.toHaveBeenCalled();
		expect(archiveMessagesSpy).not.toHaveBeenCalled();
		expect(getConversationDetailsSpy).toHaveBeenCalledWith("conversation-1", {
			includeArchived: true,
			includeSnapshots: false,
		});
		expect(result).toEqual({
			compacted: false,
			conversation: {
				id: "conversation-1",
				messages: [
					{
						id: "assistant-1",
						role: "assistant",
						content: "Previous answer",
					},
				],
			},
		});
	});
});
