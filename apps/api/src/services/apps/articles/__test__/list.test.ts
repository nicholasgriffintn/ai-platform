import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppDataRepository } from "~/repositories/AppDataRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { listArticles } from "../list";

vi.mock("~/repositories/AppDataRepository");

describe("listArticles", () => {
	let mockAppDataRepo: any;
	const mockEnv = {} as any;

	beforeEach(() => {
		mockAppDataRepo = {
			getAppDataByUserAndApp: vi.fn(),
		};
		vi.mocked(AppDataRepository).mockImplementation(() => mockAppDataRepo);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should throw AssistantError when userId is 0", async () => {
		await expect(listArticles({ env: mockEnv, userId: 0 })).rejects.toThrow(
			AssistantError,
		);

		await expect(listArticles({ env: mockEnv, userId: 0 })).rejects.toThrow(
			"User ID is required",
		);
	});

	it("should return empty sessions when no articles exist", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue([]);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result).toEqual({
			status: "success",
			sessions: [],
		});
		expect(mockAppDataRepo.getAppDataByUserAndApp).toHaveBeenCalledWith(
			123,
			"articles",
		);
	});

	it("should return empty sessions when articles array is null", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(null);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result).toEqual({
			status: "success",
			sessions: [],
		});
	});

	it("should group articles by item_id and return session summaries", async () => {
		const mockArticleData = [
			{
				id: "1",
				item_id: "session-1",
				item_type: "source",
				data: '{"title": "Source 1"}',
				created_at: "2023-01-01T00:00:00Z",
			},
			{
				id: "2",
				item_id: "session-1",
				item_type: "report",
				data: '{"title": "Report Title", "sourceItemIds": ["1", "2"]}',
				created_at: "2023-01-01T01:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockArticleData);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result.status).toBe("success");
		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0]).toEqual({
			item_id: "session-1",
			id: "2",
			title: "Report Title",
			created_at: "2023-01-01T01:00:00Z",
			source_article_count: 2,
			status: "complete",
		});
	});

	it("should handle sessions without reports as processing", async () => {
		const mockArticleData = [
			{
				id: "1",
				item_id: "session-1",
				item_type: "source",
				data: '{"title": "Source 1"}',
				created_at: "2023-01-01T00:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockArticleData);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result.sessions[0]).toEqual({
			item_id: "session-1",
			id: undefined,
			title: "Analysis Session: session-1",
			created_at: "2023-01-01T00:00:00Z",
			source_article_count: 0,
			status: "processing",
		});
	});

	it("should handle malformed JSON data gracefully", async () => {
		const mockArticleData = [
			{
				id: "1",
				item_id: "session-1",
				item_type: "report",
				data: "invalid-json",
				created_at: "2023-01-01T00:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockArticleData);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result.sessions[0].title).toBe("Analysis Session: session-1");
		expect(result.sessions[0].source_article_count).toBe(0);
	});

	it("should sort sessions by created_at in descending order", async () => {
		const mockArticleData = [
			{
				id: "1",
				item_id: "session-1",
				item_type: "source",
				data: "{}",
				created_at: "2023-01-01T00:00:00Z",
			},
			{
				id: "2",
				item_id: "session-2",
				item_type: "source",
				data: "{}",
				created_at: "2023-01-03T00:00:00Z",
			},
			{
				id: "3",
				item_id: "session-3",
				item_type: "source",
				data: "{}",
				created_at: "2023-01-02T00:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockArticleData);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result.sessions[0].created_at).toBe("2023-01-03T00:00:00Z");
		expect(result.sessions[1].created_at).toBe("2023-01-02T00:00:00Z");
		expect(result.sessions[2].created_at).toBe("2023-01-01T00:00:00Z");
	});

	it("should skip items without item_id", async () => {
		const mockArticleData = [
			{
				id: "1",
				item_id: null,
				item_type: "source",
				data: "{}",
				created_at: "2023-01-01T00:00:00Z",
			},
			{
				id: "2",
				item_id: "session-1",
				item_type: "source",
				data: "{}",
				created_at: "2023-01-01T00:00:00Z",
			},
		];

		mockAppDataRepo.getAppDataByUserAndApp.mockResolvedValue(mockArticleData);

		const result = await listArticles({ env: mockEnv, userId: 123 });

		expect(result.sessions).toHaveLength(1);
		expect(result.sessions[0].item_id).toBe("session-1");
	});

	it("should throw AssistantError when repository throws non-AssistantError", async () => {
		mockAppDataRepo.getAppDataByUserAndApp.mockRejectedValue(
			new Error("Database error"),
		);

		await expect(listArticles({ env: mockEnv, userId: 123 })).rejects.toThrow(
			AssistantError,
		);

		await expect(listArticles({ env: mockEnv, userId: 123 })).rejects.toThrow(
			"Failed to list article sessions",
		);
	});

	it("should rethrow AssistantError from repository", async () => {
		const originalError = new AssistantError(
			"Custom error",
			ErrorType.NOT_FOUND,
		);
		mockAppDataRepo.getAppDataByUserAndApp.mockRejectedValue(originalError);

		await expect(listArticles({ env: mockEnv, userId: 123 })).rejects.toThrow(
			originalError,
		);
	});
});
