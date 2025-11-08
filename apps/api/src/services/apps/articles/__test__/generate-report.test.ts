import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { generateArticlesReport } from "../generate-report";

const mockUser = {
	id: 123,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2023-01-01T00:00:00Z",
	updated_at: "2023-01-01T00:00:00Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
};

const mockAppDataRepo = {
	getAppDataByUserAppAndItem: vi.fn(),
	createAppDataWithItem: vi.fn(),
};

const mockProvider = {
	name: "test-provider",
	supportsStreaming: false,
	getResponse: vi.fn(),
	createRealtimeSession: vi.fn(),
};

const _mockLogger = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
};

vi.mock("~/lib/models", () => ({
	getAuxiliaryModelForRetrieval: vi.fn(),
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => mockProvider),
}));

vi.mock("~/repositories/AppDataRepository", () => ({
	AppDataRepository: vi.fn(() => mockAppDataRepo),
}));

vi.mock("~/utils/extract", () => ({
	extractQuotes: vi.fn(() => ["report quote 1", "report quote 2"]),
}));

vi.mock("~/utils/verify", () => ({
	verifyQuotes: vi.fn(() => ({
		verified: ["report quote 1"],
		missing: ["report quote 2"],
	})),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	})),
}));

describe("generateArticlesReport", () => {
	const mockEnv = { DB: {} } as any;
	const mockParams = {
		completion_id: "test-completion",
		app_url: "https://example.com",
		env: mockEnv,
		args: {
			itemId: "test-item-id",
		},
		user: mockUser,
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		const { getAuxiliaryModelForRetrieval, getModelConfigByMatchingModel } =
			await import("~/lib/models");
		vi.mocked(getAuxiliaryModelForRetrieval).mockResolvedValue({
			model: "test-model",
			provider: "test-provider",
		});
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should throw error when user ID is missing", async () => {
		const userWithoutId = { ...mockUser, id: 0 };

		await expect(
			generateArticlesReport({ ...mockParams, user: userWithoutId }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			generateArticlesReport({ ...mockParams, user: userWithoutId }),
		).rejects.toThrow("User ID is required");
	});

	it("should throw error when itemId is missing", async () => {
		const argsWithoutItemId = { ...mockParams.args, itemId: "" };

		await expect(
			generateArticlesReport({ ...mockParams, args: argsWithoutItemId }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			generateArticlesReport({ ...mockParams, args: argsWithoutItemId }),
		).rejects.toThrow("Item ID is required");
	});

	it("should throw error when no analysis data found", async () => {
		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue([]);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			AssistantError,
		);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			"No analysis data found for itemId: test-item-id",
		);
	});

	it("should filter only analysis items", async () => {
		const mockItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 1" }),
			},
			{
				id: "2",
				item_type: "summary",
				data: JSON.stringify({ originalArticle: "Article 2" }),
			},
			{
				id: "3",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 3" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(mockItems);

		const _reportItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 1" }),
			},
			{
				id: "3",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 3" }),
			},
		];

		mockProvider.getResponse.mockResolvedValue({
			content: "Generated report content",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const result = await generateArticlesReport(mockParams);

		expect(result.status).toBe("success");
		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"articles",
			"test-item-id",
			"report",
			expect.objectContaining({
				sourceItemIds: ["1", "3"],
			}),
		);
	});

	it("should successfully generate report from analysis items", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 1 content" }),
			},
			{
				id: "2",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 2 content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);

		const mockReportResponse = {
			content: "Generated comprehensive report",
			id: "report-id",
			citations: ["citation1", "citation2"],
			log_id: "log-456",
		};

		mockProvider.getResponse.mockResolvedValue(mockReportResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const result = await generateArticlesReport(mockParams);

		expect(result).toEqual({
			status: "success",
			message: "Article report generated and saved.",
			appDataId: "saved-report-id",
			itemId: "test-item-id",
		});

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"articles",
			"test-item-id",
			"report",
			{
				sourceItemIds: ["1", "2"],
				report: {
					content: "Generated comprehensive report",
					model: "test-model",
					id: "report-id",
					citations: ["citation1", "citation2"],
					log_id: "log-456",
					verifiedQuotes: {
						verified: ["report quote 1"],
						missing: ["report quote 2"],
					},
				},
				title: "Report for Analysis Session test-item-id (2 articles)",
			},
		);
	});

	it("should handle malformed JSON in analysis data", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 1" }),
			},
			{ id: "2", item_type: "analysis", data: "invalid json" },
			{
				id: "3",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article 3" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockResolvedValue({
			content: "Generated report",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const result = await generateArticlesReport(mockParams);

		expect(result.status).toBe("success");
	});

	it("should combine articles with separator", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "First article content" }),
			},
			{
				id: "2",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Second article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockResolvedValue({
			content: "Generated report",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		await generateArticlesReport(mockParams);

		const { verifyQuotes } = await import("~/utils/verify");
		expect(vi.mocked(verifyQuotes)).toHaveBeenCalledWith(
			"First article content\n\n---\n\nSecond article content",
			["report quote 1", "report quote 2"],
		);
	});

	it("should throw error when combined articles are empty", async () => {
		const mockAnalysisItems = [
			{ id: "1", item_type: "analysis", data: JSON.stringify({}) },
			{
				id: "2",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			AssistantError,
		);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			"Could not extract article content from saved analysis data.",
		);
	});

	it("should throw error when report content is empty", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);

		const mockReportResponse = {
			content: "",
			response: "",
		};

		mockProvider.getResponse.mockResolvedValue(mockReportResponse);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			AssistantError,
		);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			"Report content was empty",
		);
	});

	it("should handle report response with only response field", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);

		const mockReportResponse = {
			response: "Report using response field",
			id: "report-id",
		};

		mockProvider.getResponse.mockResolvedValue(mockReportResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const result = await generateArticlesReport(mockParams);

		expect(result.status).toBe("success");
		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"articles",
			"test-item-id",
			"report",
			expect.objectContaining({
				report: expect.objectContaining({
					content: "Report using response field",
				}),
			}),
		);
	});

	it("should extract and verify quotes from report", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockResolvedValue({
			content: "Report with quotes",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const { extractQuotes } = await import("~/utils/extract");
		const { verifyQuotes } = await import("~/utils/verify");

		await generateArticlesReport(mockParams);

		expect(vi.mocked(extractQuotes)).toHaveBeenCalledWith("Report with quotes");
		expect(vi.mocked(verifyQuotes)).toHaveBeenCalledWith("Article content", [
			"report quote 1",
			"report quote 2",
		]);
	});

	it("should call AI provider with correct prompt", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockResolvedValue({
			content: "Report result",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		await generateArticlesReport(mockParams);

		expect(mockProvider.getResponse).toHaveBeenCalledWith({
			completion_id: "test-completion",
			app_url: "https://example.com",
			model: "test-model",
			messages: [
				{
					role: "user",
					content: expect.any(String),
				},
			],
			env: mockEnv,
			user: mockUser,
		});
	});

	it("should throw AssistantError when provider throws non-AssistantError", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Article content" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockRejectedValue(new Error("API Error"));

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			AssistantError,
		);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			"Failed to generate report",
		);
	});

	it("should rethrow AssistantError from dependencies", async () => {
		const originalError = new AssistantError(
			"Custom error",
			ErrorType.PARAMS_ERROR,
		);
		mockAppDataRepo.getAppDataByUserAppAndItem.mockRejectedValue(originalError);

		await expect(generateArticlesReport(mockParams)).rejects.toThrow(
			originalError,
		);
	});

	it("should filter out articles without originalArticle content", async () => {
		const mockAnalysisItems = [
			{
				id: "1",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Valid article" }),
			},
			{
				id: "2",
				item_type: "analysis",
				data: JSON.stringify({ otherData: "no article" }),
			},
			{
				id: "3",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: null }),
			},
			{
				id: "4",
				item_type: "analysis",
				data: JSON.stringify({ originalArticle: "Another valid article" }),
			},
		];

		mockAppDataRepo.getAppDataByUserAppAndItem.mockResolvedValue(
			mockAnalysisItems,
		);
		mockProvider.getResponse.mockResolvedValue({
			content: "Generated report",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-report-id",
		});

		const { verifyQuotes } = await import("~/utils/verify");

		await generateArticlesReport(mockParams);

		expect(vi.mocked(verifyQuotes)).toHaveBeenCalledWith(
			"Valid article\n\n---\n\nAnother valid article",
			["report quote 1", "report quote 2"],
		);
	});
});
