import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser, Message } from "~/types";
import { handleUpdateChatCompletion } from "../updateChatCompletion";

const mocks = vi.hoisted(() => ({
	generateId: vi.fn(),
	getConversationDetails: vi.fn(),
	replaceMessages: vi.fn(),
	updateConversation: vi.fn(),
}));

vi.mock("~/utils/id", () => ({ generateId: mocks.generateId }));
vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: () => ({
			getConversationDetails: mocks.getConversationDetails,
			replaceMessages: mocks.replaceMessages,
			updateConversation: mocks.updateConversation,
		}),
	},
}));

const user: IUser = {
	id: 123,
	name: "Test person",
	avatar_url: null,
	email: "person@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

const env = { DB: {} } as IEnv;
const context = createServiceContext({ env, user });

describe("handleUpdateChatCompletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.generateId
			.mockReturnValueOnce("branch-copy-1")
			.mockReturnValueOnce("branch-copy-2")
			.mockReturnValue("branch-copy-extra");
	});

	it("persists messages before metadata and returns the final stored conversation", async () => {
		const messages: Message[] = [{ id: "message-1", role: "user", content: "Hello" }];
		mocks.updateConversation.mockResolvedValue({ id: "conversation-1", title: "Live title" });
		mocks.getConversationDetails.mockResolvedValue({
			id: "conversation-1",
			title: "Live title",
			messages,
		});

		const result = await handleUpdateChatCompletion(context, "conversation-1", {
			title: "Live title",
			messages,
		});

		expect(mocks.replaceMessages).toHaveBeenCalledWith("conversation-1", messages);
		expect(mocks.updateConversation).toHaveBeenCalledWith("conversation-1", {
			title: "Live title",
		});
		expect(mocks.replaceMessages.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.updateConversation.mock.invocationCallOrder[0],
		);
		expect(result).toEqual({ id: "conversation-1", title: "Live title", messages });
	});

	it("rejects compacted visible history as a replacement for canonical messages", async () => {
		const messages: Message[] = [
			{ id: "old-user", role: "user", content: "Old visible turn" },
			{
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{ id: "latest-user", role: "user", content: "Current question" },
		];

		await expect(
			handleUpdateChatCompletion(context, "conversation-1", { messages }),
		).rejects.toThrow("Compacted visible history cannot replace stored conversation messages");
		expect(mocks.replaceMessages).not.toHaveBeenCalled();
	});

	it("branches from authorised active context and inherits its project scope", async () => {
		const providedMessages: Message[] = [
			{ id: "old-user", role: "user", content: "Old visible turn" },
			{ id: "latest-user", role: "user", content: "Current question" },
		];
		const activeParentMessages: Message[] = [
			{
				id: "snapshot-1",
				role: "assistant",
				content: "Conversation snapshot\n\nEarlier context.",
				parts: [{ type: "snapshot", summary: "Earlier context." }],
			},
			{ id: "latest-user", role: "user", content: "Current question" },
			{ id: "later-assistant", role: "assistant", content: "Later answer" },
		];
		mocks.getConversationDetails
			.mockResolvedValueOnce({
				id: "parent-1",
				project_id: "project-1",
				messages: activeParentMessages,
			})
			.mockResolvedValue({ id: "branch-1", project_id: "project-1", messages: [] });

		await handleUpdateChatCompletion(context, "branch-1", {
			messages: providedMessages,
			parent_conversation_id: "parent-1",
			parent_message_id: "latest-user",
		});

		expect(mocks.getConversationDetails).toHaveBeenCalledWith("parent-1", {
			includeArchived: false,
			includeSnapshots: true,
		});
		expect(mocks.replaceMessages).toHaveBeenCalledWith(
			"branch-1",
			[
				expect.objectContaining({
					id: "branch-copy-1",
					content: "Conversation snapshot\n\nEarlier context.",
					parent_message_id: "snapshot-1",
				}),
				expect.objectContaining({
					id: "branch-copy-2",
					content: "Current question",
					parent_message_id: "latest-user",
				}),
			],
			{
				metadata: {
					branch_of: JSON.stringify({
						conversation_id: "parent-1",
						message_id: "latest-user",
					}),
					project_id: "project-1",
				},
			},
		);
	});

	it("does not create a branch when its parent cannot be authorised or loaded", async () => {
		mocks.getConversationDetails.mockRejectedValue(new Error("active context unavailable"));

		await expect(
			handleUpdateChatCompletion(context, "branch-1", {
				messages: [{ id: "assistant-1", role: "assistant", content: "Answer" }],
				parent_conversation_id: "parent-1",
				parent_message_id: "assistant-1",
			}),
		).rejects.toThrow("active context unavailable");
		expect(mocks.replaceMessages).not.toHaveBeenCalled();
	});
});
