import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryManager } from "~/lib/memory";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SourceRecord } from "~/repositories/SourceRepository";
import { deleteSource } from "..";

const deleteMemoryMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/memory", () => ({
	MemoryManager: {
		getInstance: vi.fn(() => ({ deleteMemory: deleteMemoryMock })),
	},
}));

const memory: SourceRecord = {
	id: "memory-1",
	created_by_user_id: 42,
	project_id: null,
	conversation_id: null,
	connection_id: null,
	kind: "memory",
	title: "Prefers concise answers",
	status: "available",
	content: "The user prefers concise answers.",
	provider: null,
	external_uri: null,
	vector_id: "vector-1",
	metadata: JSON.stringify({ memory_provider: "honcho" }),
	storage_key: null,
	mime_type: null,
	filename: null,
	byte_size: null,
	created_at: "2026-08-11T00:00:00.000Z",
	updated_at: null,
};

describe("source deletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		deleteMemoryMock.mockResolvedValue(true);
	});

	it("deletes personal memories through their recorded provider", async () => {
		const deleteSourceRow = vi.fn();
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getSource: vi.fn().mockResolvedValue(memory),
					deleteSource: deleteSourceRow,
				},
			},
		} as unknown as ServiceContext;

		await deleteSource(context, 42, memory.id);

		expect(MemoryManager.getInstance).toHaveBeenCalledWith(context.env, context.user, context);
		expect(deleteMemoryMock).toHaveBeenCalledWith(memory.id, "honcho");
		expect(deleteSourceRow).not.toHaveBeenCalled();
	});

	it("preserves the source row when its memory provider cannot delete it", async () => {
		deleteMemoryMock.mockResolvedValue(false);
		const deleteSourceRow = vi.fn();
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getSource: vi.fn().mockResolvedValue(memory),
					deleteSource: deleteSourceRow,
				},
			},
		} as unknown as ServiceContext;

		await expect(deleteSource(context, 42, memory.id)).rejects.toMatchObject({
			message: "Memory could not be deleted from its provider",
			statusCode: 502,
		});
		expect(deleteSourceRow).not.toHaveBeenCalled();
	});

	it("uses the built-in provider for migrated memories without provider metadata", async () => {
		const migratedMemory = { ...memory, metadata: JSON.stringify({ migratedFrom: "memories" }) };
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getSource: vi.fn().mockResolvedValue(migratedMemory),
					deleteSource: vi.fn(),
				},
			},
		} as unknown as ServiceContext;

		await deleteSource(context, 42, migratedMemory.id);

		expect(deleteMemoryMock).toHaveBeenCalledWith(migratedMemory.id, "built-in");
	});
});
