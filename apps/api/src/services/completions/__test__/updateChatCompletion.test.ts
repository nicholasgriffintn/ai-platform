import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUpdateChatCompletion } from "../updateChatCompletion";

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(),
}));

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

const mockEnv = {
	DB: "test-db",
};

const mockUser = {
	id: "user-123",
	email: "test@example.com",
};

let mockServiceContext: any;

describe("handleUpdateChatCompletion", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");
		const { generateId } = await import("~/utils/id");

		vi.mocked(generateId)
			.mockReset()
			.mockReturnValueOnce("branch-copy-1")
			.mockReturnValueOnce("branch-copy-2")
			.mockReturnValue("branch-copy-extra");

		mockConversationManager = {
			get: vi.fn(),
			getConversationDetails: vi.fn(),
			replaceMessages: vi.fn(),
			updateConversation: vi.fn(),
		};

		mockServiceContext = {
			env: mockEnv,
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: {} as any,
			repositories: {} as any,
			requireUser: vi.fn().mockReturnValue(mockUser),
		};

		vi.mocked(ConversationManager.getInstance).mockReturnValue(mockConversationManager);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing user ID", async () => {
			mockServiceContext.requireUser.mockImplementationOnce(() => {
				throw new Error("User is not authenticated");
			});

			await expect(() =>
				handleUpdateChatCompletion(mockServiceContext, "completion-123", {
					title: "Test",
				}),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleUpdateChatCompletion(mockServiceContext, "completion-123", {
					title: "Test",
				}),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful updates", () => {
		it("should update conversation title successfully", async () => {
			const completionId = "completion-123";
			const updates = { title: "New Title" };
			const mockResult = {
				id: completionId,
				title: "New Title",
				updated_at: new Date().toISOString(),
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, updates);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				updates,
			);
			expect(result).toEqual(mockResult);
		});

		it("should update conversation archived status", async () => {
			const completionId = "completion-456";
			const updates = { archived: true };
			const mockResult = {
				id: completionId,
				archived: true,
				updated_at: new Date().toISOString(),
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, updates);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				updates,
			);
			expect(result.archived).toBe(true);
		});

		it("should replace stored messages", async () => {
			const completionId = "completion-live";
			const messages = [
				{
					id: "message-1",
					role: "user",
					content: "Hello",
				},
			] as any;
			const mockResult = {
				id: completionId,
				title: "Live",
				messages,
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, {
				messages,
			});

			expect(mockConversationManager.replaceMessages).toHaveBeenCalledWith(completionId, messages);
			expect(mockConversationManager.updateConversation).not.toHaveBeenCalled();
			expect(result).toEqual(mockResult);
		});

		it("should reject replacing stored messages with compacted visible history", async () => {
			const completionId = "completion-compacted";
			const messages = [
				{
					id: "old-user",
					role: "user",
					content: "Old visible turn",
				},
				{
					id: "snapshot-1-compaction",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{
					id: "latest-user",
					role: "user",
					content: "Current question",
				},
			] as any;

			await expect(
				handleUpdateChatCompletion(mockServiceContext, completionId, { messages }),
			).rejects.toThrow("Compacted visible history cannot replace stored conversation messages");
			expect(mockConversationManager.replaceMessages).not.toHaveBeenCalled();
		});

		it("should replace messages before applying conversation metadata", async () => {
			const completionId = "completion-live";
			const messages = [
				{
					id: "message-1",
					role: "user",
					content: "Hello",
				},
			] as any;
			const mockResult = {
				id: completionId,
				title: "Live title",
				messages,
			};

			mockConversationManager.updateConversation.mockResolvedValue({
				id: completionId,
				title: "Live title",
			});
			mockConversationManager.getConversationDetails.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, {
				title: "Live title",
				messages,
			});

			expect(mockConversationManager.replaceMessages).toHaveBeenCalledWith(completionId, messages);
			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(completionId, {
				title: "Live title",
			});
			expect(result).toEqual(mockResult);
		});

		it("should pass branch metadata when creating branched messages", async () => {
			const completionId = "branch-live";
			const messages = [
				{
					id: "assistant-1",
					role: "assistant",
					content: "Answer",
				},
			] as any;
			const mockResult = {
				id: completionId,
				title: "Branch",
				messages,
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(mockResult);
			mockConversationManager.get.mockResolvedValue(messages);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, {
				messages,
				parent_conversation_id: "conversation-1",
				parent_message_id: "assistant-1",
			});

			expect(mockConversationManager.replaceMessages).toHaveBeenCalledWith(
				completionId,
				[
					{
						id: "branch-copy-1",
						completion_id: completionId,
						parent_message_id: "assistant-1",
						role: "assistant",
						content: "Answer",
					},
				],
				{
					metadata: {
						branch_of: JSON.stringify({
							conversation_id: "conversation-1",
							message_id: "assistant-1",
						}),
					},
				},
			);
			expect(mockConversationManager.updateConversation).not.toHaveBeenCalled();
			expect(result).toEqual(mockResult);
		});

		it("should branch from active parent context after compaction", async () => {
			const completionId = "branch-compacted";
			const visibleMessages = [
				{
					id: "old-user",
					role: "user",
					content: "Old visible turn",
				},
				{
					id: "snapshot-1-compaction",
					role: "compaction",
					content: "Context compacted",
					parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
				},
				{
					id: "latest-user",
					role: "user",
					content: "What was this conversation about?",
				},
			] as any;
			const activeParentMessages = [
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot\n\nEarlier context.",
					parts: [{ type: "snapshot", summary: "Earlier context." }],
				},
				{
					id: "latest-user",
					role: "user",
					content: "What was this conversation about?",
				},
				{
					id: "later-assistant",
					role: "assistant",
					content: "Later answer",
				},
			] as any;
			const mockResult = {
				id: completionId,
				title: "Branch",
				messages: activeParentMessages.slice(0, 2),
			};

			mockConversationManager.get.mockResolvedValue(activeParentMessages);
			mockConversationManager.getConversationDetails.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, completionId, {
				messages: visibleMessages,
				parent_conversation_id: "conversation-1",
				parent_message_id: "latest-user",
			});

			expect(mockConversationManager.get).toHaveBeenCalledWith("conversation-1");
			expect(mockConversationManager.replaceMessages).toHaveBeenCalledWith(
				completionId,
				[
					expect.objectContaining({
						completion_id: completionId,
						content: "Conversation snapshot\n\nEarlier context.",
						parent_message_id: "snapshot-1",
					}),
					expect.objectContaining({
						completion_id: completionId,
						content: "What was this conversation about?",
						parent_message_id: "latest-user",
					}),
				],
				expect.objectContaining({
					metadata: {
						branch_of: JSON.stringify({
							conversation_id: "conversation-1",
							message_id: "latest-user",
						}),
					},
				}),
			);
			expect(mockConversationManager.replaceMessages.mock.calls[0]?.[1]).not.toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						content: "Old visible turn",
					}),
				]),
			);
			expect(result).toEqual(mockResult);
		});

		it("should reject branch creation from compacted visible history when active parent context is unavailable", async () => {
			const completionId = "branch-live";
			const messages = [
				{
					id: "compaction-marker-1",
					completion_id: "conversation-1",
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
				{
					id: "assistant-1",
					completion_id: "conversation-1",
					role: "assistant",
					content: "Answer",
				},
			] as any;
			mockConversationManager.get.mockRejectedValue(new Error("active context unavailable"));

			await expect(
				handleUpdateChatCompletion(mockServiceContext, completionId, {
					messages,
					parent_conversation_id: "conversation-1",
					parent_message_id: "assistant-1",
				}),
			).rejects.toThrow("Compacted visible history cannot be used to create a stored branch");
			expect(mockConversationManager.replaceMessages).not.toHaveBeenCalled();
		});

		it("should handle empty completion ID", async () => {
			const updates = { title: "Test" };
			const mockResult = {
				id: "",
				title: "Test",
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(mockServiceContext, "", updates);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith("", updates);
			expect(result).toEqual(mockResult);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found errors", async () => {
			const completionId = "nonexistent";
			const updates = { title: "New Title" };

			mockConversationManager.updateConversation.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleUpdateChatCompletion(mockServiceContext, completionId, updates),
			).rejects.toThrow("Conversation not found");
		});
	});
});
