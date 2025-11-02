import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { analyseArticle } from "../analyse";

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
	createAppDataWithItem: vi.fn(),
};

const mockProvider = {
	name: "test-provider",
	supportsStreaming: false,
	getResponse: vi.fn(),
	createRealtimeSession: vi.fn(),
};

vi.mock("~/lib/chat/utils", () => ({
	sanitiseInput: vi.fn((input) => input),
}));

vi.mock("~/lib/models", () => ({
	getAuxiliaryModelForRetrieval: vi.fn(),
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => mockProvider),
	},
}));

vi.mock("~/repositories/AppDataRepository", () => ({
	AppDataRepository: vi.fn(() => mockAppDataRepo),
}));

vi.mock("~/utils/extract", () => ({
	extractQuotes: vi.fn(() => ["quote1", "quote2"]),
}));

vi.mock("~/utils/verify", () => ({
	verifyQuotes: vi.fn(() => ({ verified: ["quote1"], missing: ["quote2"] })),
}));

describe("analyseArticle", () => {
	const mockEnv = {} as any;
	const mockParams = {
		completion_id: "test-completion",
		app_url: "https://example.com",
		env: mockEnv,
		args: {
			article: "This is a test article content",
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
			analyseArticle({ ...mockParams, user: userWithoutId }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			analyseArticle({ ...mockParams, user: userWithoutId }),
		).rejects.toThrow("User ID is required");
	});

	it("should throw error when itemId is missing", async () => {
		const argsWithoutItemId = { ...mockParams.args, itemId: "" };

		await expect(
			analyseArticle({ ...mockParams, args: argsWithoutItemId }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			analyseArticle({ ...mockParams, args: argsWithoutItemId }),
		).rejects.toThrow("Item ID is required");
	});

	it("should throw error when article content is missing", async () => {
		const argsWithoutArticle = { ...mockParams.args, article: "" };

		await expect(
			analyseArticle({ ...mockParams, args: argsWithoutArticle }),
		).rejects.toThrow(expect.any(AssistantError));

		await expect(
			analyseArticle({ ...mockParams, args: argsWithoutArticle }),
		).rejects.toThrow("Article content is required");
	});

	it("should successfully analyse article and save data", async () => {
		const mockAnalysisResponse = {
			content: "This is the analysis content",
			response: "This is the analysis content",
			id: "analysis-id",
			citations: ["citation1"],
			log_id: "log-123",
		};

		mockProvider.getResponse.mockResolvedValue(mockAnalysisResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-data-id",
		});

		const result = await analyseArticle(mockParams);

		expect(result).toEqual({
			status: "success",
			message: "Article analysed and saved.",
			appDataId: "saved-data-id",
			itemId: "test-item-id",
			analysis: {
				content: "This is the analysis content",
				data: {
					content: "This is the analysis content",
					model: "test-model",
					id: "analysis-id",
					citations: ["citation1"],
					log_id: "log-123",
					verifiedQuotes: { verified: ["quote1"], missing: ["quote2"] },
				},
			},
		});

		expect(mockAppDataRepo.createAppDataWithItem).toHaveBeenCalledWith(
			123,
			"articles",
			"test-item-id",
			"analysis",
			{
				originalArticle: "This is a test article content",
				analysis: {
					content: "This is the analysis content",
					model: "test-model",
					id: "analysis-id",
					citations: ["citation1"],
					log_id: "log-123",
					verifiedQuotes: { verified: ["quote1"], missing: ["quote2"] },
				},
				title: "Analysis: This is a test article content...",
			},
		);
	});

	it("should handle analysis response with only response field", async () => {
		const mockAnalysisResponse = {
			response: "Analysis using response field",
			id: "analysis-id",
		};

		mockProvider.getResponse.mockResolvedValue(mockAnalysisResponse);
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-data-id",
		});

		const result = await analyseArticle(mockParams);

		expect(result.analysis?.content).toBe("Analysis using response field");
	});

	it("should throw error when analysis content is empty", async () => {
		const mockAnalysisResponse = {
			content: "",
			response: "",
		};

		mockProvider.getResponse.mockResolvedValue(mockAnalysisResponse);

		await expect(analyseArticle(mockParams)).rejects.toThrow(
			expect.any(AssistantError),
		);

		await expect(analyseArticle(mockParams)).rejects.toThrow(
			"Analysis content was empty",
		);
	});

	it("should throw AssistantError when provider throws non-AssistantError", async () => {
		mockProvider.getResponse.mockRejectedValue(new Error("API Error"));

		await expect(analyseArticle(mockParams)).rejects.toThrow(
			expect.any(AssistantError),
		);

		await expect(analyseArticle(mockParams)).rejects.toThrow(
			"Failed to analyse article",
		);
	});

	it("should rethrow AssistantError from dependencies", async () => {
		const originalError = new AssistantError(
			"Custom error",
			ErrorType.PARAMS_ERROR,
		);
		mockProvider.getResponse.mockRejectedValue(originalError);

		await expect(analyseArticle(mockParams)).rejects.toThrow(originalError);
	});

	it("should properly sanitise input article", async () => {
		mockProvider.getResponse.mockResolvedValue({
			content: "Analysis result",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-data-id",
		});

		const { sanitiseInput } = await import("~/lib/chat/utils");

		await analyseArticle(mockParams);

		expect(vi.mocked(sanitiseInput)).toHaveBeenCalledWith(
			"This is a test article content",
		);
	});

	it("should extract and verify quotes from analysis", async () => {
		mockProvider.getResponse.mockResolvedValue({
			content: "Analysis with quotes",
		});
		mockAppDataRepo.createAppDataWithItem.mockResolvedValue({
			id: "saved-data-id",
		});

		const { extractQuotes } = await import("~/utils/extract");
		const { verifyQuotes } = await import("~/utils/verify");

		await analyseArticle(mockParams);

		expect(vi.mocked(extractQuotes)).toHaveBeenCalledWith(
			"Analysis with quotes",
		);
		expect(vi.mocked(verifyQuotes)).toHaveBeenCalledWith(
			"This is a test article content",
			["quote1", "quote2"],
		);
	});
});
