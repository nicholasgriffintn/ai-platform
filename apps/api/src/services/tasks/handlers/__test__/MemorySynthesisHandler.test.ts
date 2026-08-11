import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceRecord } from "~/repositories/SourceRepository";
import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
	createSynthesis: vi.fn(),
	getActiveSynthesis: vi.fn(),
	getResponse: vi.fn(),
	listPersonalSources: vi.fn(),
	supersedeSynthesis: vi.fn(),
}));

vi.mock("~/repositories/SourceRepository", () => ({
	SourceRepository: class {
		listPersonalSources = mocks.listPersonalSources;
	},
}));

vi.mock("~/repositories/MemorySynthesisRepository", () => ({
	MemorySynthesisRepository: class {
		createSynthesis = mocks.createSynthesis;
		getActiveSynthesis = mocks.getActiveSynthesis;
		supersedeSynthesis = mocks.supersedeSynthesis;
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn().mockResolvedValue({ model: "test-model", provider: "test" }),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => ({ getResponse: mocks.getResponse })),
}));

import { MemorySynthesisHandler } from "../MemorySynthesisHandler";

function createMemory(overrides: Partial<SourceRecord>): SourceRecord {
	return {
		id: "memory-1",
		created_by_user_id: 42,
		project_id: null,
		conversation_id: null,
		connection_id: null,
		kind: "memory",
		title: "Memory",
		status: "available",
		content: "Prefers concise answers.",
		provider: null,
		external_uri: null,
		vector_id: "vector-1",
		metadata: JSON.stringify({ category: "preference", namespace: "global" }),
		storage_key: null,
		mime_type: null,
		filename: null,
		byte_size: null,
		created_at: "2026-08-11T00:00:00.000Z",
		updated_at: null,
		...overrides,
	};
}

describe("MemorySynthesisHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getActiveSynthesis.mockResolvedValue(null);
		mocks.getResponse.mockResolvedValue({ response: "## Preferences\nPrefers concise answers." });
		mocks.createSynthesis.mockResolvedValue({ id: "synthesis-1", synthesis_version: 1 });
	});

	it("synthesises active personal memory sources in the requested namespace", async () => {
		mocks.listPersonalSources.mockResolvedValue([
			createMemory({}),
			createMemory({ id: "archived", status: "archived", content: "Old preference." }),
			createMemory({
				id: "other-namespace",
				content: "Project-specific context.",
				metadata: JSON.stringify({ namespace: "project-1" }),
			}),
		]);

		const result = await new MemorySynthesisHandler().handle(
			{
				taskId: "task-1",
				task_type: "memory_synthesis",
				user_id: 42,
				task_data: { namespace: "global" },
				priority: 5,
			},
			{} as IEnv,
		);

		expect(mocks.listPersonalSources).toHaveBeenCalledWith(42, "memory");
		expect(mocks.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					expect.objectContaining({ content: expect.stringContaining("Prefers concise answers.") }),
				],
			}),
		);
		expect(mocks.createSynthesis).toHaveBeenCalledWith(
			expect.objectContaining({ memory_ids: ["memory-1"], memory_count: 1 }),
		);
		expect(result).toMatchObject({ status: "success", data: { memory_count: 1 } });
	});
});
