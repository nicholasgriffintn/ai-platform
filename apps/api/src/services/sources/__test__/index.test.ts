import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryManager } from "~/lib/memory";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { SourceCollectionRecord, SourceRecord } from "~/repositories/SourceRepository";
import { deleteSource, deleteSourceCollection, setProjectContextSources } from "..";

const deleteMemoryMock = vi.hoisted(() => vi.fn());
const requireProjectAccessMock = vi.hoisted(() => vi.fn());
const recordProjectAuditMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/memory", () => ({
	MemoryManager: {
		getInstance: vi.fn(() => ({ deleteMemory: deleteMemoryMock })),
	},
}));

vi.mock("~/services/workspaces/access", () => ({
	requireProjectAccess: requireProjectAccessMock,
}));

vi.mock("~/services/audit", () => ({
	recordProjectAudit: recordProjectAuditMock,
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
		requireProjectAccessMock.mockResolvedValue({ role: "admin" });
		recordProjectAuditMock.mockResolvedValue(undefined);
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

describe("project conversation context", () => {
	const projectSource: SourceRecord = {
		...memory,
		id: "source-1",
		project_id: "project-1",
		kind: "text",
		title: "Launch brief",
		content: "Launch in October.",
		provider: null,
		vector_id: null,
		metadata: "{}",
	};
	const contextCollection: SourceCollectionRecord = {
		id: "project-context:project-1",
		created_by_user_id: 42,
		project_id: "project-1",
		title: "Project context",
		description: "Sources attached to new project conversations.",
		kind: "context",
		created_at: "2026-08-11T00:00:00.000Z",
		updated_at: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		requireProjectAccessMock.mockResolvedValue({ role: "admin" });
		recordProjectAuditMock.mockResolvedValue(undefined);
	});

	it("replaces the persistent source set and records the project change", async () => {
		const replaceCollectionSources = vi.fn().mockResolvedValue(undefined);
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getSource: vi.fn().mockResolvedValue(projectSource),
					ensureProjectContextCollection: vi.fn().mockResolvedValue(contextCollection),
					replaceCollectionSources,
					getProjectContextCollection: vi.fn().mockResolvedValue(contextCollection),
					listCollectionSources: vi.fn().mockResolvedValue([projectSource]),
				},
			},
		} as unknown as ServiceContext;

		const result = await setProjectContextSources(context, 42, "project-1", [projectSource.id]);

		expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
		expect(replaceCollectionSources).toHaveBeenCalledWith(contextCollection.id, [projectSource.id]);
		expect(recordProjectAuditMock).toHaveBeenCalledWith(
			context,
			"project-1",
			expect.objectContaining({ action: "project.context.updated" }),
		);
		expect(result.sources).toEqual([expect.objectContaining({ id: projectSource.id })]);
	});

	it("rejects a source outside the project", async () => {
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getSource: vi.fn().mockResolvedValue({ ...projectSource, project_id: "project-2" }),
					ensureProjectContextCollection: vi.fn(),
					replaceCollectionSources: vi.fn(),
				},
			},
		} as unknown as ServiceContext;

		await expect(
			setProjectContextSources(context, 42, "project-1", [projectSource.id]),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(context.repositories.sources.replaceCollectionSources).not.toHaveBeenCalled();
	});

	it("prevents the reserved project context collection from generic deletion", async () => {
		const deleteCollection = vi.fn();
		const context = {
			env: {},
			user: { id: 42 },
			repositories: {
				sources: {
					getCollection: vi.fn().mockResolvedValue(contextCollection),
					deleteCollection,
				},
			},
		} as unknown as ServiceContext;

		await expect(deleteSourceCollection(context, 42, contextCollection.id)).rejects.toMatchObject({
			statusCode: 403,
		});
		expect(deleteCollection).not.toHaveBeenCalled();
	});
});
