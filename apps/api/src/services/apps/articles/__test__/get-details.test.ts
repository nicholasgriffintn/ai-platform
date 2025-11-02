import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppDataRepository } from "~/repositories/AppDataRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getArticleDetails } from "../get-details";

vi.mock("~/repositories/AppDataRepository");
vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		error: vi.fn(),
	})),
}));

describe("getArticleDetails", () => {
	let mockAppDataRepo: any;
	const mockEnv = {} as any;

	beforeEach(() => {
		mockAppDataRepo = {
			getAppDataById: vi.fn(),
		};
		vi.mocked(AppDataRepository).mockImplementation(() => mockAppDataRepo);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should throw AssistantError when id is missing", async () => {
		await expect(
			getArticleDetails({ env: mockEnv, id: "", userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getArticleDetails({ env: mockEnv, id: "", userId: 123 }),
		).rejects.toThrow("Article ID is required");
	});

	it("should throw AssistantError when userId is missing", async () => {
		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 0 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 0 }),
		).rejects.toThrow("User ID is required for lookup");
	});

	it("should throw NOT_FOUND error when article doesn't exist", async () => {
		mockAppDataRepo.getAppDataById.mockResolvedValue(null);

		await expect(
			getArticleDetails({ env: mockEnv, id: "non-existent", userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getArticleDetails({ env: mockEnv, id: "non-existent", userId: 123 }),
		).rejects.toThrow("Article data not found");
	});

	it("should throw FORBIDDEN error when article doesn't belong to user", async () => {
		const mockArticle = {
			id: "article-1",
			user_id: 456,
			data: '{"title": "Test Article"}',
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockArticle);

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 123 }),
		).rejects.toThrow("Forbidden");
	});

	it("should return article details with parsed data", async () => {
		const mockArticle = {
			id: "article-1",
			user_id: 123,
			app_id: "articles",
			item_id: "session-1",
			data: '{"title": "Test Article", "content": "Article content"}',
			created_at: "2023-01-01T00:00:00Z",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockArticle);

		const result = await getArticleDetails({
			env: mockEnv,
			id: "article-1",
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.article).toEqual({
			id: "article-1",
			user_id: 123,
			app_id: "articles",
			item_id: "session-1",
			data: { title: "Test Article", content: "Article content" },
			created_at: "2023-01-01T00:00:00Z",
		});
		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledWith("article-1");
	});

	it("should handle malformed JSON data gracefully", async () => {
		const mockArticle = {
			id: "article-1",
			user_id: 123,
			data: "invalid-json",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockArticle);

		const result = await getArticleDetails({
			env: mockEnv,
			id: "article-1",
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.article.data).toEqual({});
	});

	it("should handle null data gracefully", async () => {
		const mockArticle = {
			id: "article-1",
			user_id: 123,
			data: null,
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(mockArticle);

		const result = await getArticleDetails({
			env: mockEnv,
			id: "article-1",
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.article.data).toEqual({});
	});

	it("should throw AssistantError when repository throws non-AssistantError", async () => {
		mockAppDataRepo.getAppDataById.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 123 }),
		).rejects.toThrow("Failed to get article details");
	});

	it("should rethrow AssistantError from repository", async () => {
		const originalError = new AssistantError(
			"Custom error",
			ErrorType.NOT_FOUND,
		);
		mockAppDataRepo.getAppDataById.mockRejectedValue(originalError);

		await expect(
			getArticleDetails({ env: mockEnv, id: "article-1", userId: 123 }),
		).rejects.toThrow(originalError);
	});
});
