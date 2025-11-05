import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockDatabase = {
	getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
	getNamespace: vi.fn(() => "default-namespace"),
	searchSimilar: vi.fn(() => Promise.resolve([])),
};

vi.mock("~/lib/database", () => ({
	Database: {
		getInstance: vi.fn(() => mockDatabase),
	},
}));

vi.mock("~/lib/embedding", () => ({
	Embedding: {
		getInstance: vi.fn(() => mockEmbedding),
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		info: vi.fn(),
		error: vi.fn(),
	})),
}));

import { Database } from "~/lib/database";
import { queryEmbeddings } from "../query";

describe("queryEmbeddings", () => {
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		plan: "free",
		created_at: Date.now(),
	} as any;

	const mockEnv = {
		ASSETS_BUCKET: "test-bucket",
		PUBLIC_ASSETS_URL: "https://assets.test.com",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should successfully query embeddings", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
					namespace: "custom-namespace",
				},
			},
		};

		const mockResults = [
			{ id: "doc-1", content: "matched content 1", score: 0.95 },
			{ id: "doc-2", content: "matched content 2", score: 0.87 },
		];

		mockDatabase.getUserSettings.mockResolvedValue({});
		mockEmbedding.getNamespace.mockReturnValue("custom-namespace");
		mockEmbedding.searchSimilar.mockResolvedValue(mockResults);

		const result = await queryEmbeddings(req);

		expect(result).toEqual({
			status: "success",
			data: mockResults,
		});

		expect(mockEmbedding.searchSimilar).toHaveBeenCalledWith("search term", {
			namespace: "custom-namespace",
		});
	});

	it("should use default namespace when not provided", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
				},
			},
		};

		mockDatabase.getUserSettings.mockResolvedValue({});
		mockEmbedding.getNamespace.mockReturnValue("default-namespace");
		mockEmbedding.searchSimilar.mockResolvedValue([]);

		const result = await queryEmbeddings(req);

		expect(result.status).toBe("success");
		expect(mockEmbedding.getNamespace).toHaveBeenCalledWith({
			namespace: undefined,
		});
	});

	it("should throw error for missing query", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {},
			},
		};

		await expect(queryEmbeddings(req)).rejects.toThrow(
			"Error querying embeddings",
		);
	});

	it("should handle empty search results", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "no matches",
					namespace: "test-namespace",
				},
			},
		};

		mockDatabase.getUserSettings.mockResolvedValue({});
		mockEmbedding.getNamespace.mockReturnValue("test-namespace");
		mockEmbedding.searchSimilar.mockResolvedValue([]);

		const result = await queryEmbeddings(req);

		expect(result).toEqual({
			status: "success",
			data: [],
		});
	});

	it("should handle NOT_FOUND errors gracefully", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
					namespace: "nonexistent-namespace",
				},
			},
		};

		const notFoundError = new AssistantError("Not found", ErrorType.NOT_FOUND);

		mockDatabase.getUserSettings.mockResolvedValue({});
		mockEmbedding.getNamespace.mockReturnValue("nonexistent-namespace");
		mockEmbedding.searchSimilar.mockRejectedValue(notFoundError);

		const result = await queryEmbeddings(req);

		expect(result).toEqual({
			status: "success",
			data: [],
		});
	});

	it("should rethrow non-NOT_FOUND errors", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
				},
			},
		};

		const serverError = new Error("Server error");
		mockDatabase.getUserSettings.mockResolvedValue({});
		mockEmbedding.searchSimilar.mockRejectedValue(serverError);

		await expect(queryEmbeddings(req)).rejects.toThrow(
			"Error querying embeddings",
		);
	});

	it("should handle database errors", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
				},
			},
		};

		mockDatabase.getUserSettings.mockRejectedValue(new Error("Database error"));

		await expect(queryEmbeddings(req)).rejects.toThrow(
			"Error querying embeddings",
		);
	});

	it("should handle embedding service initialization errors", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				query: {
					query: "search term",
				},
			},
		};

		vi.mocked(Database.getInstance).mockImplementation(() => {
			throw new Error("Database init error");
		});

		await expect(queryEmbeddings(req)).rejects.toThrow(
			"Error querying embeddings",
		);
	});
});
