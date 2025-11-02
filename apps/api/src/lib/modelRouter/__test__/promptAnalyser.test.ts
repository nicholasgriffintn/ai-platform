import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIProviderFactory } from "~/lib/providers/factory";
import type { IEnv, IUser } from "~/types";
import { PromptAnalyzer } from "../promptAnalyser";

vi.mock("~/lib/keywords", () => ({
	KeywordFilter: class MockKeywordFilter {
		static getAllCodingKeywords = vi
			.fn()
			.mockReturnValue(["code", "function", "variable"]);
		static getAllMathKeywords = vi
			.fn()
			.mockReturnValue(["calculate", "equation", "solve"]);
		static getAllGeneralKeywords = vi
			.fn()
			.mockReturnValue(["what", "how", "why"]);
		static getAllCreativeKeywords = vi
			.fn()
			.mockReturnValue(["creative", "story", "poem"]);
		static getAllReasoningKeywords = vi
			.fn()
			.mockReturnValue(["analyze", "think", "reason"]);

		getCategorizedMatches = vi.fn().mockReturnValue({});
		hasKeywords = vi.fn().mockReturnValue(false);
	},
}));

vi.mock("~/lib/models", () => ({
	availableCapabilities: [
		"reasoning",
		"coding",
		"math",
		"creative",
		"general_knowledge",
	],
	getAuxiliaryModel: vi.fn().mockResolvedValue({
		model: "test-model",
		provider: "test-provider",
	}),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn().mockReturnValue({
			getResponse: vi.fn(),
		}),
	},
}));

vi.mock("~/services/functions", () => ({
	availableFunctions: ["search", "calculator", "file_reader"],
}));

vi.mock("~/utils/errors", () => ({
	AssistantError: class MockAssistantError extends Error {
		constructor(
			message: string,
			public type: string,
		) {
			super(message);
		}
	},
	ErrorType: {
		UNKNOWN_ERROR: "UNKNOWN_ERROR",
		PROVIDER_ERROR: "PROVIDER_ERROR",
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		error: vi.fn(),
	}),
}));

describe("PromptAnalyzer", () => {
	// @ts-ignore - mockEnv is not typed
	const mockEnv = {
		ANALYTICS: true,
	} as IEnv;

	// @ts-ignore - mockUser is not typed
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
	} as IUser;

	const validAIResponse = {
		expectedComplexity: 3,
		requiredCapabilities: ["coding", "reasoning"],
		estimatedInputTokens: 1000,
		estimatedOutputTokens: 500,
		needsFunctions: false,
		benefitsFromMultipleModels: false,
		modelComparisonReason: "",
	};

	let mockProvider: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		mockProvider = {
			getResponse: vi.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify(validAIResponse),
						},
					},
				],
			}),
		};

		vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);
	});

	describe("analyzePrompt", () => {
		it("should analyze prompt and return requirements", async () => {
			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Write a function to calculate fibonacci numbers",
				[],
				undefined,
				mockUser,
			);

			expect(result).toEqual({
				expectedComplexity: 3,
				requiredCapabilities: ["coding", "reasoning"],
				estimatedInputTokens: 1000,
				estimatedOutputTokens: 500,
				needsFunctions: false,
				hasImages: false,
				hasDocuments: false,
				benefitsFromMultipleModels: false,
				modelComparisonReason: "",
				budget_constraint: undefined,
			});

			expect(mockProvider.getResponse).toHaveBeenCalledWith({
				env: mockEnv,
				model: "test-model",
				disable_functions: true,
				messages: [
					{
						role: "system",
						content: expect.stringContaining(
							"You are an AI assistant analyzing a user prompt",
						),
					},
					{
						role: "user",
						content: "Write a function to calculate fibonacci numbers",
					},
				],
				user: mockUser,
				response_format: { type: "json_object" },
			});
		});

		it("should detect images in attachments", async () => {
			const attachments = [
				{ type: "image", data: "base64-image-data" },
				{ type: "document", data: "pdf-content" },
			];

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Analyze this image",
				// @ts-ignore - attachments is not typed
				attachments,
				undefined,
				mockUser,
			);

			expect(result.hasImages).toBe(true);
			expect(result.hasDocuments).toBe(true);
		});

		it("should include budget constraint in result", async () => {
			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Simple task",
				[],
				0.05,
				mockUser,
			);

			expect(result.budget_constraint).toBe(0.05);
		});
	});

	describe("JSON parsing", () => {
		it("should handle valid JSON response", async () => {
			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify(validAIResponse),
						},
					},
				],
			});

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result.expectedComplexity).toBe(3);
			expect(result.requiredCapabilities).toEqual(["coding", "reasoning"]);
		});

		it("should handle JSON wrapped in code blocks", async () => {
			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: `\`\`\`json\n${JSON.stringify(validAIResponse)}\n\`\`\``,
						},
					},
				],
			});

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result.expectedComplexity).toBe(3);
		});

		it("should handle Workers AI response format", async () => {
			mockProvider.getResponse.mockResolvedValue({
				response: JSON.stringify(validAIResponse),
			});

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result.expectedComplexity).toBe(3);
		});

		it("should extract JSON from malformed response", async () => {
			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: `Here is the analysis: ${JSON.stringify(validAIResponse)} end`,
						},
					},
				],
			});

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result.expectedComplexity).toBe(3);
		});

		it("should normalize requirements with invalid values", async () => {
			const invalidResponse = {
				expectedComplexity: 10,
				requiredCapabilities: ["coding"],
				estimatedInputTokens: -100,
				estimatedOutputTokens: -50,
			};

			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify(invalidResponse),
						},
					},
				],
			});

			const result = await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result.expectedComplexity).toBe(5);
			expect(result.estimatedInputTokens).toBe(0);
			expect(result.estimatedOutputTokens).toBe(0);
		});
	});

	describe("error handling", () => {
		it("should throw error when no AI response received", async () => {
			mockProvider.getResponse.mockResolvedValue({});

			await expect(
				PromptAnalyzer.analyzePrompt(
					mockEnv,
					"Test prompt",
					[],
					undefined,
					mockUser,
				),
			).rejects.toThrow("No valid AI response received");
		});

		it("should throw error for invalid JSON structure", async () => {
			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify({
								invalidField: "value",
							}),
						},
					},
				],
			});

			await expect(
				PromptAnalyzer.analyzePrompt(
					mockEnv,
					"Test prompt",
					[],
					undefined,
					mockUser,
				),
			).rejects.toThrow("Incomplete or invalid AI analysis structure");
		});

		it("should throw error for unparseable JSON", async () => {
			mockProvider.getResponse.mockResolvedValue({
				choices: [
					{
						message: {
							content: "Invalid JSON content {not valid}",
						},
					},
				],
			});

			await expect(
				PromptAnalyzer.analyzePrompt(
					mockEnv,
					"Test prompt",
					[],
					undefined,
					mockUser,
				),
			).rejects.toThrow("Invalid JSON response from AI analysis");
		});

		it("should handle AI provider errors", async () => {
			mockProvider.getResponse.mockRejectedValue(new Error("Provider error"));

			await expect(
				PromptAnalyzer.analyzePrompt(
					mockEnv,
					"Test prompt",
					[],
					undefined,
					mockUser,
				),
			).rejects.toThrow("Prompt analysis failed: Provider error");
		});
	});

	describe("keyword extraction", () => {
		it("should extract keywords using filters", async () => {
			const { KeywordFilter } =
				await vi.importMock<typeof import("~/lib/keywords")>("~/lib/keywords");
			const mockFilter = new KeywordFilter([]);
			vi.mocked(mockFilter.getCategorizedMatches).mockReturnValue({
				coding: ["function", "code"],
				math: ["calculate"],
			});

			await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Write a function to calculate something",
				[],
				undefined,
				mockUser,
			);

			expect(mockProvider.getResponse).toHaveBeenCalled();
		});

		it("should use fallback keyword extraction when no matches found", async () => {
			await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"write some code function test",
				[],
				undefined,
				mockUser,
			);

			expect(mockProvider.getResponse).toHaveBeenCalled();
		});
	});

	describe("system prompt construction", () => {
		it("should include available capabilities in system prompt", async () => {
			await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			const systemPrompt =
				mockProvider.getResponse.mock.calls[0][0].messages[0].content;
			expect(systemPrompt).toContain("reasoning");
			expect(systemPrompt).toContain("coding");
			expect(systemPrompt).toContain("math");
		});

		it("should include available functions in system prompt", async () => {
			await PromptAnalyzer.analyzePrompt(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			const systemPrompt =
				mockProvider.getResponse.mock.calls[0][0].messages[0].content;
			expect(systemPrompt).toContain("search");
			expect(systemPrompt).toContain("calculator");
			expect(systemPrompt).toContain("file_reader");
		});
	});
});
