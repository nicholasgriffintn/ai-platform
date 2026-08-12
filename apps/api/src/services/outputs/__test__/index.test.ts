import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OutputRecord, OutputShareRecord } from "~/repositories/OutputRepository";
import { formatSharedOutput, listOutputShares, listOutputs } from "..";

const output: OutputRecord = {
	id: "output-1",
	created_by_user_id: 42,
	project_id: null,
	conversation_id: null,
	parent_output_id: null,
	capability_id: "notes",
	group_id: null,
	kind: "document",
	title: "Launch notes",
	status: "ready",
	sensitivity: "personal",
	content: "{}",
	storage_key: null,
	mime_type: null,
	filename: null,
	byte_size: null,
	revision: 1,
	created_at: "2026-08-11T10:00:00.000Z",
	updated_at: null,
};

function share(overrides: Partial<OutputShareRecord> = {}): OutputShareRecord {
	return {
		id: "share-1",
		output_id: output.id,
		token_hash: "hash",
		permission: "view",
		created_by_user_id: 42,
		expires_at: null,
		revoked_at: null,
		created_at: "2026-08-11T11:00:00.000Z",
		...overrides,
	};
}

describe("output shares", () => {
	it("removes private scope and storage fields from public output responses", () => {
		const shared = formatSharedOutput({
			...output,
			project_id: "project-1",
			conversation_id: "conversation-1",
			storage_key: "private/project-1/output-1.pdf",
			mime_type: "application/pdf",
			filename: "launch.pdf",
			byte_size: 100,
		});

		expect(shared).toEqual(
			expect.objectContaining({
				id: "output-1",
				file: {
					mimeType: "application/pdf",
					filename: "launch.pdf",
					byteSize: 100,
				},
			}),
		);
		expect(shared).not.toHaveProperty("createdByUserId");
		expect(shared).not.toHaveProperty("projectId");
		expect(shared).not.toHaveProperty("conversationId");
		expect(shared.file).not.toHaveProperty("key");
	});

	it("lists only active shares for management", async () => {
		const listShares = vi
			.fn()
			.mockResolvedValue([
				share(),
				share({ id: "share-revoked", revoked_at: "2026-08-11T12:00:00.000Z" }),
				share({ id: "share-expired", expires_at: "2020-01-01T00:00:00.000Z" }),
			]);
		const context = {
			repositories: {
				outputs: {
					getOutput: vi.fn().mockResolvedValue(output),
					listShares,
				},
			},
		} as unknown as ServiceContext;

		const result = await listOutputShares(context, 42, output.id);

		expect(result).toEqual({
			shares: [
				{
					id: "share-1",
					outputId: output.id,
					permission: "view",
					expiresAt: null,
					revokedAt: null,
					createdAt: "2026-08-11T11:00:00.000Z",
				},
			],
		});
		expect(listShares).toHaveBeenCalledWith(output.id);
	});
});

describe("output listing", () => {
	it("passes kind and pagination to persistence instead of filtering an unbounded list", async () => {
		const listPersonalOutputs = vi.fn().mockResolvedValue([output]);
		const context = {
			repositories: { outputs: { listPersonalOutputs } },
		} as unknown as ServiceContext;

		await listOutputs(context, 42, {
			capabilityId: "notes",
			kind: "document",
			limit: 20,
			offset: 40,
		});

		expect(listPersonalOutputs).toHaveBeenCalledWith(42, "notes", {
			kind: "document",
			limit: 20,
			offset: 40,
		});
	});
});
