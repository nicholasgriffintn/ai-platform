import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppDataRepository } from "~/repositories/AppDataRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getSourceArticles } from "../get-source-articles";

vi.mock("~/repositories/AppDataRepository");
vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		error: vi.fn(),
	})),
}));

describe("getSourceArticles", () => {
	let mockAppDataRepo: any;
	const mockEnv = { DB: {} } as any;

	beforeEach(() => {
		mockAppDataRepo = {
			getAppDataById: vi.fn(),
		};
		vi.mocked(AppDataRepository).mockImplementation(() => mockAppDataRepo);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should throw AssistantError when ids array is empty", async () => {
		await expect(
			getSourceArticles({ env: mockEnv, ids: [], userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getSourceArticles({ env: mockEnv, ids: [], userId: 123 }),
		).rejects.toThrow("Article IDs are required");
	});

	it("should throw AssistantError when ids is null", async () => {
		await expect(
			getSourceArticles({ env: mockEnv, ids: null as any, userId: 123 }),
		).rejects.toThrow(expect.any(AssistantError));
	});

	it("should throw AssistantError when userId is missing", async () => {
		await expect(
			getSourceArticles({ env: mockEnv, ids: ["id1"], userId: 0 }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getSourceArticles({ env: mockEnv, ids: ["id1"], userId: 0 }),
		).rejects.toThrow("User ID is required for lookup");
	});

	it("should return articles with parsed data for valid IDs", async () => {
		const mockArticles = [
			{
				id: "article-1",
				user_id: 123,
				app_id: "articles",
				item_id: "session-1",
				data: '{"title": "Article 1", "content": "Content 1"}',
				created_at: "2023-01-01T00:00:00Z",
			},
			{
				id: "article-2",
				user_id: 123,
				app_id: "articles",
				item_id: "session-1",
				data: '{"title": "Article 2", "content": "Content 2"}',
				created_at: "2023-01-02T00:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataById
			.mockResolvedValueOnce(mockArticles[0])
			.mockResolvedValueOnce(mockArticles[1]);

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1", "article-2"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(2);
		expect(result.articles[0]).toEqual({
			id: "article-1",
			user_id: 123,
			app_id: "articles",
			item_id: "session-1",
			data: { title: "Article 1", content: "Content 1" },
			created_at: "2023-01-01T00:00:00Z",
		});
		expect(result.articles[1]).toEqual({
			id: "article-2",
			user_id: 123,
			app_id: "articles",
			item_id: "session-1",
			data: { title: "Article 2", content: "Content 2" },
			created_at: "2023-01-02T00:00:00Z",
		});
	});

	it("should filter out articles that don't belong to the user", async () => {
		const validArticle = {
			id: "article-1",
			user_id: 123,
			data: '{"title": "Valid Article"}',
		};

		const invalidArticle = {
			id: "article-2",
			user_id: 456,
			data: '{"title": "Invalid Article"}',
		};

		mockAppDataRepo.getAppDataById
			.mockResolvedValueOnce(validArticle)
			.mockResolvedValueOnce(invalidArticle);

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1", "article-2"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(1);
		expect(result.articles[0].id).toBe("article-1");
	});

	it("should filter out null/non-existent articles", async () => {
		const validArticle = {
			id: "article-1",
			user_id: 123,
			data: '{"title": "Valid Article"}',
		};

		mockAppDataRepo.getAppDataById
			.mockResolvedValueOnce(validArticle)
			.mockResolvedValueOnce(null);

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1", "non-existent"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(1);
		expect(result.articles[0].id).toBe("article-1");
	});

	it("should handle malformed JSON data gracefully", async () => {
		const articleWithBadJson = {
			id: "article-1",
			user_id: 123,
			data: "invalid-json",
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(articleWithBadJson);

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(1);
		expect(result.articles[0].data).toEqual({});
	});

	it("should handle null data gracefully", async () => {
		const articleWithNullData = {
			id: "article-1",
			user_id: 123,
			data: null,
		};

		mockAppDataRepo.getAppDataById.mockResolvedValue(articleWithNullData);

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(1);
		expect(result.articles[0].data).toEqual({});
	});

	it("should handle individual article fetch errors gracefully", async () => {
		const validArticle = {
			id: "article-1",
			user_id: 123,
			data: '{"title": "Valid Article"}',
		};

		mockAppDataRepo.getAppDataById
			.mockResolvedValueOnce(validArticle)
			.mockRejectedValueOnce(new Error("Database error"));

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["article-1", "error-article"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(1);
		expect(result.articles[0].id).toBe("article-1");
	});

	it("should return empty array when all articles are filtered out", async () => {
		mockAppDataRepo.getAppDataById
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "article-2", user_id: 456 });

		const result = await getSourceArticles({
			env: mockEnv,
			ids: ["non-existent", "wrong-user"],
			userId: 123,
		});

		expect(result.status).toBe("success");
		expect(result.articles).toHaveLength(0);
	});

	it("should call getAppDataById for each ID", async () => {
		const ids = ["id1", "id2", "id3"];

		mockAppDataRepo.getAppDataById.mockResolvedValue(null);

		await getSourceArticles({
			env: mockEnv,
			ids,
			userId: 123,
		});

		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledTimes(3);
		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledWith("id1");
		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledWith("id2");
		expect(mockAppDataRepo.getAppDataById).toHaveBeenCalledWith("id3");
	});

	it("should throw AssistantError when repository creation fails", async () => {
		vi.mocked(AppDataRepository).mockImplementation(() => {
			throw new Error("Repository creation failed");
		});

		await expect(
			getSourceArticles({
				env: mockEnv,
				ids: ["article-1"],
				userId: 123,
			}),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			getSourceArticles({
				env: mockEnv,
				ids: ["article-1"],
				userId: 123,
			}),
		).rejects.toThrow("Failed to get source articles");
	});

	it("should rethrow AssistantError from dependencies", async () => {
		const originalError = new AssistantError(
			"Custom error",
			ErrorType.NOT_FOUND,
		);

		vi.mocked(AppDataRepository).mockImplementation(() => {
			throw originalError;
		});

		await expect(
			getSourceArticles({
				env: mockEnv,
				ids: ["article-1"],
				userId: 123,
			}),
		).rejects.toThrow(originalError);
	});
});
