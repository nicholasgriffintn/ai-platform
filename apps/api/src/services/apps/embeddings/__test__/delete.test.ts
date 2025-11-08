import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as embeddingHelpers from "~/lib/providers/capabilities/embedding/helpers";

const mockRepositories = {
	userSettings: {
		getUserSettings: vi.fn(() => Promise.resolve({})),
	},
};

const mockEmbeddingProvider = {
	delete: vi.fn(() => Promise.resolve({ status: "success" })),
};

vi.mock("~/repositories", () => ({
	RepositoryManager: vi.fn(() => mockRepositories),
}));

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
	getEmbeddingProvider: vi.fn(() => mockEmbeddingProvider),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		error: vi.fn(),
	})),
}));

import { deleteEmbedding } from "../delete";

describe("deleteEmbedding", () => {
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		plan: "free",
		created_at: Date.now(),
	} as any;

	const mockEnv = {
		DB: {} as any,
		ASSETS_BUCKET: "test-bucket",
		PUBLIC_ASSETS_URL: "https://assets.test.com",
	} as any;

	const mockedGetEmbeddingProvider = vi.mocked(
		embeddingHelpers.getEmbeddingProvider,
	);

	beforeEach(() => {
		vi.clearAllMocks();
		mockEmbeddingProvider.delete.mockReset();
		mockEmbeddingProvider.delete.mockResolvedValue({
			status: "success",
			error: null,
		} as any);
		mockedGetEmbeddingProvider.mockReturnValue(mockEmbeddingProvider as any);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should successfully delete embeddings", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: ["embedding-1", "embedding-2", "embedding-3"],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		mockEmbeddingProvider.delete.mockResolvedValue({ status: "success" });

		const result = await deleteEmbedding(req);

		expect(result).toEqual({
			status: "success",
			data: {
				ids: ["embedding-1", "embedding-2", "embedding-3"],
			},
		});

		expect(mockEmbeddingProvider.delete).toHaveBeenCalledWith([
			"embedding-1",
			"embedding-2",
			"embedding-3",
		]);
	});

	it("should delete single embedding", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: ["single-embedding"],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		mockEmbeddingProvider.delete.mockResolvedValue({ status: "success" });

		const result = await deleteEmbedding(req);

		expect(result).toEqual({
			status: "success",
			data: {
				ids: ["single-embedding"],
			},
		});
	});

	it("should throw error for missing ids", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {},
		};

		// @ts-ignore - req.request.ids is required
		await expect(deleteEmbedding(req)).rejects.toThrow(
			"Error deleting embedding",
		);
	});

	it("should throw error for null ids", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: null,
			},
		};

		await expect(deleteEmbedding(req)).rejects.toThrow(
			"Error deleting embedding",
		);
	});

	it("should throw error for empty ids array", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: [],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		mockEmbeddingProvider.delete.mockResolvedValue({ status: "success" });

		const result = await deleteEmbedding(req);

		expect(result.status).toBe("success");
		expect(result.data?.ids).toEqual([]);
	});

	it("should handle deletion failure", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: ["embedding-1"],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		mockEmbeddingProvider.delete.mockResolvedValue({ status: "error" });

		await expect(deleteEmbedding(req)).rejects.toThrow(
			"Error deleting embedding",
		);
	});

	it("should handle database errors", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: ["embedding-1"],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(deleteEmbedding(req)).rejects.toThrow(
			"Error deleting embedding",
		);
	});

	it("should handle embedding service errors", async () => {
		const req = {
			user: mockUser,
			env: mockEnv,
			request: {
				ids: ["embedding-1"],
			},
		};

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		mockEmbeddingProvider.delete.mockRejectedValue(
			new Error("Embedding service error"),
		);

		await expect(deleteEmbedding(req)).rejects.toThrow(
			"Error deleting embedding",
		);
	});
});
