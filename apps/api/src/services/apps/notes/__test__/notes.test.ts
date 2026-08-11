import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "../list";

const provider = { getResponse: vi.fn() };
vi.mock("~/lib/chat/utils", () => ({ sanitiseInput: (input: string) => input }));
vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn().mockResolvedValue({ model: "test-model", provider: "test-provider" }),
}));
vi.mock("~/lib/providers/capabilities/chat", () => ({ getChatProvider: () => provider }));
vi.mock("~/utils/id", () => ({ generateId: () => "note-1" }));

function output(overrides: Partial<OutputRecord> = {}): OutputRecord {
	return {
		id: "note-1",
		created_by_user_id: 7,
		project_id: null,
		conversation_id: null,
		parent_output_id: null,
		capability_id: "notes",
		group_id: "note-1",
		kind: "note",
		title: "Test note",
		status: "ready",
		sensitivity: "personal",
		content: '{"title":"Test note","content":"Body","metadata":{"tags":["test"]}}',
		storage_key: null,
		mime_type: null,
		filename: null,
		byte_size: null,
		revision: 1,
		created_at: "2026-08-11T10:00:00Z",
		updated_at: null,
		...overrides,
	};
}

function context(outputs: Record<string, unknown>): ServiceContext {
	return {
		env: { DB: {} },
		ensureDatabase: () => undefined,
		repositories: { outputs },
	} as unknown as ServiceContext;
}

const user = { id: 7, email: "writer@example.com" } as never;

describe("notes outputs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		provider.getResponse.mockResolvedValue({ response: '{"summary":"Generated","tags":["ai"]}' });
	});

	it("lists and reads personal note outputs", async () => {
		const outputs = {
			listPersonalOutputs: vi.fn().mockResolvedValue([output()]),
			getPersonalOutput: vi.fn().mockResolvedValue(output()),
		};
		const serviceContext = context(outputs);

		expect(await listNotes({ context: serviceContext, userId: 7 })).toEqual([
			expect.objectContaining({ id: "note-1", title: "Test note", content: "Body" }),
		]);
		expect(await getNote({ context: serviceContext, userId: 7, noteId: "note-1" })).toMatchObject({
			metadata: { tags: ["test"] },
		});
	});

	it("creates a note as a canonical output", async () => {
		const outputs = { createOutput: vi.fn().mockResolvedValue(output()) };

		const result = await createNote({
			context: context(outputs),
			user,
			data: { title: "Test note", content: "Body" },
		});

		expect(result.id).toBe("note-1");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				createdByUserId: 7,
				capabilityId: "notes",
				kind: "note",
			}),
		);
	});

	it("updates with optimistic revision control", async () => {
		const outputs = {
			getPersonalOutput: vi.fn().mockResolvedValue(output()),
			updateOutput: vi.fn().mockResolvedValue(
				output({
					revision: 2,
					content: '{"title":"Changed","content":"New body","metadata":{"tags":["test"]}}',
				}),
			),
		};

		const result = await updateNote({
			context: context(outputs),
			user,
			noteId: "note-1",
			data: { title: "Changed", content: "New body" },
		});

		expect(result.title).toBe("Changed");
		expect(outputs.updateOutput).toHaveBeenCalledWith(
			"note-1",
			expect.objectContaining({ expectedRevision: 1, updatedByUserId: 7 }),
		);
	});

	it("deletes only an authorised personal note", async () => {
		const outputs = {
			getPersonalOutput: vi.fn().mockResolvedValue(output()),
			deleteOutput: vi.fn().mockResolvedValue(undefined),
		};

		await deleteNote({ context: context(outputs), user, noteId: "note-1" });

		expect(outputs.deleteOutput).toHaveBeenCalledWith("note-1");
	});

	it("rejects a missing note instead of falling back to an unscoped record", async () => {
		const outputs = { getPersonalOutput: vi.fn().mockResolvedValue(null) };

		await expect(
			getNote({ context: context(outputs), userId: 7, noteId: "missing" }),
		).rejects.toMatchObject({ type: "NOT_FOUND", statusCode: 404 });
	});
});
