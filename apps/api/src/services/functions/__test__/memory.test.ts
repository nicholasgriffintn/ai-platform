import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	storeMemory: vi.fn(),
	retrieveMemories: vi.fn(),
	getInstance: vi.fn(),
}));

vi.mock("~/lib/memory", () => ({
	MemoryManager: {
		getInstance: mocks.getInstance,
	},
}));

import type { IRequest, IUserSettings } from "~/types";
import { search_memories, store_memory } from "../memory";

const user = {
	id: 42,
	email: "user@example.com",
	plan_id: "pro",
} as any;

const createToolContext = (
	settings: Partial<IUserSettings>,
	requestOverrides?: Partial<IRequest>,
) => {
	const request: IRequest = {
		env: { DB: {} } as any,
		user,
		context: {
			getUserSettings: vi.fn().mockResolvedValue(settings),
		} as any,
		request: {
			completion_id: "completion-id",
		} as any,
		...requestOverrides,
	};

	return {
		completionId: "completion-id",
		env: request.env,
		user: request.user,
		request,
	};
};

describe("memory function tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getInstance.mockReturnValue({
			storeMemory: mocks.storeMemory,
			retrieveMemories: mocks.retrieveMemories,
		});
	});

	it("stores memories when memory saving is enabled", async () => {
		mocks.storeMemory.mockResolvedValue("memory-1");

		const result = await store_memory.execute(
			{ text: "User prefers concise replies", category: "preference" },
			createToolContext({ memories_save_enabled: true }),
		);

		expect(mocks.storeMemory).toHaveBeenCalledWith(
			"User prefers concise replies",
			expect.objectContaining({
				category: "preference",
				source: "memory_tool",
			}),
			"completion-id",
			expect.objectContaining({ memories_save_enabled: true }),
		);
		expect(result.status).toBe("success");
		expect(result.data).toEqual({ id: "memory-1" });
	});

	it("does not store memories when memory saving is disabled", async () => {
		const result = await store_memory.execute(
			{ text: "User prefers concise replies" },
			createToolContext({ memories_save_enabled: false, memories_chat_history_enabled: true }),
		);

		expect(mocks.storeMemory).not.toHaveBeenCalled();
		expect(result.status).toBe("error");
	});

	it("searches memories when any memory setting is enabled", async () => {
		mocks.retrieveMemories.mockResolvedValue([
			{ text: "User prefers concise replies", score: 0.82 },
		]);

		const result = await search_memories.execute(
			{ query: "How should I respond?", top_k: 2 },
			createToolContext({ memories_save_enabled: false, memories_chat_history_enabled: true }),
		);

		expect(mocks.retrieveMemories).toHaveBeenCalledWith("How should I respond?", {
			topK: 2,
			scoreThreshold: 0.5,
			userSettings: expect.objectContaining({ memories_chat_history_enabled: true }),
		});
		expect(result.status).toBe("success");
		expect(result.data).toEqual({
			memories: [{ text: "User prefers concise replies", score: 0.82 }],
		});
	});
});
