import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "~/types";
import { SessionManager } from "../SessionManager";

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

describe("SessionManager", () => {
	const mockConversationManager = {
		add: vi.fn(),
		archiveMessages: vi.fn(),
	};

	const env = {
		AI: {},
	} as any;

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
			conversationManager: mockConversationManager as any,
		});

		const messages = Array.from({ length: 8 }, (_, index) => ({
			id: `msg-${index}`,
			role: "user",
			content: "short",
		})) as Message[];

		const result = await manager.compact({
			completionId: "conv-1",
			messages,
			latestUserMessage: "latest",
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
			conversationManager: mockConversationManager as any,
		});

		const messages = Array.from({ length: 30 }, (_, index) =>
			createLongMessage(index),
		);

		const result = await manager.compact({
			completionId: "conv-2",
			messages,
			latestUserMessage: "latest",
			mode: "build",
			modelConfig: { contextWindow: 4096 },
		});

		expect(result.compacted).toBe(true);
		expect(result.snapshotMessage?.id).toBe("snapshot-message-id");
		expect(mockConversationManager.add).toHaveBeenCalledWith(
			"conv-2",
			expect.objectContaining({
				id: "snapshot-message-id",
				parts: expect.arrayContaining([
					expect.objectContaining({ type: "snapshot" }),
				]),
			}),
		);
		expect(mockConversationManager.archiveMessages).toHaveBeenCalledWith(
			"conv-2",
			expect.arrayContaining(["msg-0", "msg-1"]),
		);
	});

	it("falls back when summarisation fails", async () => {
		const manager = new SessionManager({
			env,
			conversationManager: mockConversationManager as any,
		});
		mockProviderGetResponse.mockRejectedValueOnce(
			new Error("provider failure"),
		);

		const summary = await manager.summarise([
			{
				id: "m-1",
				role: "user",
				content: "User asked for a migration strategy.",
			} as Message,
			{
				id: "m-2",
				role: "assistant",
				content: "Assistant suggested a phased migration.",
			} as Message,
		]);

		expect(summary).toContain("Earlier context summary");
	});
});
