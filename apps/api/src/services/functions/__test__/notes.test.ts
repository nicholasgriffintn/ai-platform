import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	insertEmbedding: vi.fn(),
	queryEmbeddings: vi.fn(),
}));

vi.mock("~/services/apps/embeddings/insert", () => ({
	insertEmbedding: mocks.insertEmbedding,
}));

vi.mock("~/services/apps/embeddings/query", () => ({
	queryEmbeddings: mocks.queryEmbeddings,
}));

import type { IRequest } from "~/types";
import { create_note } from "../create_note";
import { get_note } from "../get_note";

const request: IRequest = {
	env: { DB: {} } as any,
	user: {
		id: 42,
		email: "user@example.com",
		github_username: "not-nicholas",
	} as any,
};

const createToolContext = (baseRequest: IRequest) => ({
	completionId: "completion-id",
	env: baseRequest.env,
	user: baseRequest.user,
	request: baseRequest,
});

describe("note function tools", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("allows non-owner users to create notes through scoped embeddings", async () => {
		mocks.insertEmbedding.mockResolvedValue({
			data: { id: "note-1" },
		});

		const result = await create_note.execute(
			{
				title: "Project note",
				content: "Remember this",
				metadata: { source: "test" },
			},
			createToolContext(request),
		);

		expect(mocks.insertEmbedding).toHaveBeenCalledWith({
			request: {
				type: "note",
				title: "Project note",
				content: "Remember this",
				metadata: { source: "test" },
			},
			env: request.env,
			user: request.user,
		});
		expect(result.status).toBe("success");
	});

	it("queries only notes for non-owner users", async () => {
		mocks.queryEmbeddings.mockResolvedValue({
			data: [{ id: "note-1", content: "Remember this" }],
		});

		const result = await get_note.execute({ query: "project" }, createToolContext(request));

		expect(mocks.queryEmbeddings).toHaveBeenCalledWith({
			request: {
				query: {
					query: "project",
					type: "note",
				},
			},
			env: request.env,
			user: request.user,
		});
		expect(result.status).toBe("success");
	});
});
