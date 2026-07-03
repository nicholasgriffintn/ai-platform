import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, Message } from "~/types";
import { SessionManager, type SessionConversationStore } from "../SessionManager";

const mockGetAuxiliaryModel = vi.fn();
const mockGetChatProvider = vi.fn();
const mockProviderGetResponse = vi.fn();

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: (...args: unknown[]) => mockGetAuxiliaryModel(...args),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: (...args: unknown[]) => mockGetChatProvider(...args),
}));

vi.mock("~/utils/id", () => ({
	generateId: () => "snapshot-message-id",
}));

function createLongMessage(index: number): Message {
	return {
		id: `msg-${index}`,
		role: index % 2 === 0 ? "user" : "assistant",
		content: `${"x".repeat(900)}-${index}`,
	};
}

function createShortMessage(index: number): Message {
	return {
		id: `msg-${index}`,
		role: index % 2 === 0 ? "user" : "assistant",
		content: `short message ${index}`,
	};
}

function createTimestampedShortMessage(index: number): Message {
	return {
		...createShortMessage(index),
		timestamp: 10_000 + index,
	};
}

describe("SessionManager", () => {
	const mockConversationManager: SessionConversationStore = {
		add: vi.fn(),
		archiveMessages: vi.fn(),
		deleteMessages: vi.fn(),
	};

	const env = {
		AI: {},
	} as IEnv;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetAuxiliaryModel.mockResolvedValue({
			model: "aux-model",
			provider: "test-provider",
		});
		mockProviderGetResponse.mockResolvedValue({
			response: "Summarised archived messages",
		});
		mockGetChatProvider.mockReturnValue({
			getResponse: mockProviderGetResponse,
		});
	});

	it("returns original messages when compaction is not needed", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from(
			{ length: 8 },
			(_, index): Message => ({
				id: `msg-${index}`,
				role: "user",
				content: "short",
			}),
		);

		const result = await manager.compact({
			completionId: "conv-1",
			messages,
			modelConfig: { contextWindow: 8192 },
		});

		expect(result.compacted).toBe(false);
		expect(result.messages).toEqual(messages);
		expect(mockConversationManager.add).not.toHaveBeenCalled();
		expect(mockConversationManager.archiveMessages).not.toHaveBeenCalled();
	});

	it("compacts and persists snapshot + archived IDs", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

		const result = await manager.compact({
			completionId: "conv-2",
			messages,
			mode: "build",
			modelConfig: { contextWindow: 4096 },
		});

		expect(result.compacted).toBe(true);
		expect(result.snapshotMessage?.id).toBe("snapshot-message-id");
		expect(mockConversationManager.add).toHaveBeenNthCalledWith(
			1,
			"conv-2",
			expect.objectContaining({
				id: "snapshot-message-id",
				parts: expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
			}),
		);
		expect(mockConversationManager.add).toHaveBeenNthCalledWith(
			2,
			"conv-2",
			expect.objectContaining({
				id: "snapshot-message-id-compaction",
				completion_id: "conv-2",
				role: "compaction",
				content: "Context automatically compacted",
				parts: expect.arrayContaining([
					expect.objectContaining({
						type: "compaction",
						status: "completed",
					}),
				]),
			}),
		);
		expect(mockConversationManager.archiveMessages).toHaveBeenCalledWith(
			"conv-2",
			expect.arrayContaining(["msg-0", "msg-1", "snapshot-message-id-compaction"]),
		);
	});

	it("rejects when compacted history cannot be persisted", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});
		vi.mocked(mockConversationManager.archiveMessages).mockRejectedValueOnce(
			new Error("archive failed"),
		);

		const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

		await expect(
			manager.compact({
				completionId: "conv-persist-fails",
				messages,
				modelConfig: { contextWindow: 4096 },
			}),
		).rejects.toThrow("archive failed");
	});

	it("removes inserted snapshot and compaction marker when archive persistence fails", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});
		vi.mocked(mockConversationManager.archiveMessages).mockRejectedValueOnce(
			new Error("archive failed"),
		);

		const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

		await expect(
			manager.compact({
				completionId: "conv-cleanup",
				messages,
				modelConfig: { contextWindow: 4096 },
			}),
		).rejects.toThrow("archive failed");
		expect(mockConversationManager.deleteMessages).toHaveBeenCalledWith("conv-cleanup", [
			"snapshot-message-id",
			"snapshot-message-id-compaction",
		]);
	});

	it("preserves the original persistence error when cleanup also fails", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});
		vi.mocked(mockConversationManager.archiveMessages).mockRejectedValueOnce(
			new Error("archive failed"),
		);
		vi.mocked(mockConversationManager.deleteMessages).mockRejectedValueOnce(
			new Error("cleanup failed"),
		);

		const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

		await expect(
			manager.compact({
				completionId: "conv-cleanup-fails",
				messages,
				modelConfig: { contextWindow: 4096 },
			}),
		).rejects.toThrow("archive failed");
	});

	it("manually compacts conversations below the automatic token threshold", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from({ length: 30 }, (_, index) => createShortMessage(index));

		const result = await manager.compact({
			completionId: "conv-manual",
			messages,
			compaction: "manual",
			modelConfig: { contextWindow: 128000 },
		});

		expect(result.compacted).toBe(true);
		expect(result.snapshotMessage?.parts).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
		);
		expect(mockConversationManager.archiveMessages).toHaveBeenCalledWith(
			"conv-manual",
			expect.arrayContaining(["msg-0", "msg-1"]),
		);
	});

	it("manually compacts short conversations", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from({ length: 6 }, (_, index) => createTimestampedShortMessage(index));

		const result = await manager.compact({
			completionId: "conv-short-manual",
			messages,
			compaction: "manual",
			modelConfig: { contextWindow: 128000 },
		});

		expect(result.compacted).toBe(true);
		expect(result.snapshotMessage?.parts).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
		);
		expect(result.messages).toEqual([result.snapshotMessage]);
		expect(mockConversationManager.archiveMessages).toHaveBeenCalledWith(
			"conv-short-manual",
			expect.arrayContaining([
				"msg-0",
				"msg-1",
				"msg-2",
				"msg-3",
				"msg-4",
				"msg-5",
				"snapshot-message-id-compaction",
			]),
		);
	});

	it("archives previous snapshots when compacting active history again", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = [
			{
				id: "previous-snapshot",
				role: "assistant",
				content: "Conversation snapshot\n\nEarlier context.",
				parts: [{ type: "snapshot", summary: "Earlier context." }],
			},
			...Array.from(
				{ length: 12 },
				(_, index): Message => ({
					id: `msg-${index}`,
					role: index % 2 === 0 ? "user" : "assistant",
					content: `message ${index}`,
				}),
			),
		] satisfies Message[];

		const result = await manager.compact({
			completionId: "conv-recompact",
			messages,
			compaction: "manual",
			modelConfig: { contextWindow: 128000 },
		});

		expect(result.compacted).toBe(true);
		expect(mockConversationManager.archiveMessages).toHaveBeenCalledWith(
			"conv-recompact",
			expect.arrayContaining(["previous-snapshot", "msg-0", "snapshot-message-id-compaction"]),
		);
		expect(result.messages).toEqual([result.snapshotMessage]);
	});

	it("timestamps snapshots before the retained recent tail", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from(
			{ length: 30 },
			(_, index): Message => ({
				id: `msg-${index}`,
				role: index % 2 === 0 ? "user" : "assistant",
				content: `${"x".repeat(900)}-${index}`,
				timestamp: 10_000 + index,
			}),
		);

		const result = await manager.compact({
			completionId: "conv-order",
			messages,
			modelConfig: { contextWindow: 4096 },
		});

		expect(result.snapshotMessage?.timestamp).toBe(messages.at(-8)!.timestamp! - 1);
	});

	it("does not compact when compaction is disabled for the request", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});

		const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

		const result = await manager.compact({
			completionId: "conv-off",
			messages,
			compaction: "off",
			modelConfig: { contextWindow: 4096 },
		});

		expect(result.compacted).toBe(false);
		expect(result.messages).toEqual(messages);
		expect(mockConversationManager.add).not.toHaveBeenCalled();
		expect(mockConversationManager.archiveMessages).not.toHaveBeenCalled();
	});

	it("falls back when summarisation fails", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager,
		});
		mockProviderGetResponse.mockRejectedValueOnce(new Error("provider failure"));

		const summary = await manager.summarise([
			{
				id: "m-1",
				role: "user",
				content: "User asked for a migration strategy.",
			},
			{
				id: "m-2",
				role: "assistant",
				content: "Assistant suggested a phased migration.",
			},
		]);

		expect(summary).toContain("Earlier context summary");
	});
});
