import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser, ModelConfigItem, PromptRequirements } from "~/types";
import { ModelRouter } from "../index";

const mockPromptAnalyzer = vi.hoisted(() => ({
	analyzePrompt: vi.fn(),
}));

const mockModels = vi.hoisted(() => ({
	getIncludedInRouterModels: vi.fn(),
	getIncludedInRouterModelsForUser: vi.fn(),
	filterModelsForUserAccess: vi.fn(),
	getModelConfig: vi.fn(),
	getModels: vi.fn(),
	defaultModel: "claude-3-5-sonnet-20241022",
}));

const mockMonitoring = vi.hoisted(() => ({
	trackModelRoutingMetrics: vi.fn(),
}));

vi.mock("~/lib/modelRouter/promptAnalyser", () => ({
	PromptAnalyzer: mockPromptAnalyzer,
}));

vi.mock("~/lib/providers/models", () => mockModels);

vi.mock("~/lib/monitoring", () => mockMonitoring);

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

describe("ModelRouter", () => {
	// @ts-ignore - mockEnv is not typed
	const mockEnv = {
		ANALYTICS: true,
	} as IEnv;

	// @ts-ignore - mockUser is not typed
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
	} as IUser;

	const mockModelConfig: ModelConfigItem = {
		name: "Test Model",
		matchingModel: "test-model",
		type: ["text"],
		provider: "test-provider",
		contextComplexity: 3,
		costPer1kInputTokens: 0.01,
		costPer1kOutputTokens: 0.02,
		reliability: 4,
		speed: 2,
		multimodal: true,
		supportsToolCalls: true,
		strengths: ["reasoning", "coding"],
	};

	const mockRequirements: PromptRequirements = {
		expectedComplexity: 3,
		requiredCapabilities: ["reasoning", "coding"],
		criticalCapabilities: [],
		estimatedInputTokens: 1000,
		estimatedOutputTokens: 500,
		needsFunctions: false,
		hasImages: false,
		hasDocuments: false,
		benefitsFromMultipleModels: false,
		modelComparisonReason: "",
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockMonitoring.trackModelRoutingMetrics.mockImplementation(
			async (fn) => await fn(),
		);

		mockModels.getModels.mockReturnValue({});
	});

	describe("selectModel", () => {
		it("should select best model based on requirements", async () => {
			const availableModels = {
				"test-model": mockModelConfig,
				"another-model": {
					...mockModelConfig,
					id: "another-model",
					contextComplexity: 2,
					reliability: 3,
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);
			mockModels.getModelConfig.mockResolvedValue(mockModelConfig);
			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(mockRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Write some code",
				[],
				undefined,
				mockUser,
				"completion-123",
			);

			expect(result).toBe("test-model");
			expect(mockPromptAnalyzer.analyzePrompt).toHaveBeenCalledWith(
				mockEnv,
				"Write some code",
				[],
				undefined,
				mockUser,
			);
		});

		it("should return default model when no suitable models found", async () => {
			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue({});
			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(mockRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result).toBe("claude-3-5-sonnet-20241022");
		});

		it("should handle errors and return default model", async () => {
			mockModels.getIncludedInRouterModelsForUser.mockImplementation(() => {
				throw new Error("Test error");
			});

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result).toBe("claude-3-5-sonnet-20241022");
		});

		it("should filter out models with negative infinity scores", async () => {
			const criticalRequirements: PromptRequirements = {
				...mockRequirements,
				criticalCapabilities: ["math"],
			};

			const availableModels = {
				"test-model": mockModelConfig,
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);
			mockModels.getModelConfig.mockResolvedValue(mockModelConfig);
			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(criticalRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Solve math problems",
				[],
				undefined,
				mockUser,
			);

			expect(result).toBe("claude-3-5-sonnet-20241022");
		});
	});

	describe("selectMultipleModels", () => {
		it("should return single model when complexity doesn't require comparison", async () => {
			const simpleRequirements: PromptRequirements = {
				...mockRequirements,
				expectedComplexity: 2,
				requiredCapabilities: ["chat"],
			};

			const availableModels = { "test-model": mockModelConfig };

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);
			mockModels.getModelConfig.mockResolvedValue(mockModelConfig);
			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(simpleRequirements);

			const result = await ModelRouter.selectMultipleModels(
				mockEnv,
				"Simple chat",
				[],
				undefined,
				mockUser,
			);

			expect(result).toEqual(["test-model"]);
		});

		it("should return multiple models for complex reasoning tasks", async () => {
			const complexRequirements: PromptRequirements = {
				...mockRequirements,
				expectedComplexity: 4,
				requiredCapabilities: ["reasoning"],
			};

			const availableModels = {
				"model-1": {
					...mockModelConfig,
					id: "model-1",
					provider: "provider-1",
				},
				"model-2": {
					...mockModelConfig,
					id: "model-2",
					provider: "provider-2",
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);

			mockModels.getModelConfig.mockImplementation((modelId: string) => {
				return availableModels[modelId];
			});

			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(complexRequirements);

			const result = await ModelRouter.selectMultipleModels(
				mockEnv,
				"Complex reasoning task",
				[],
				undefined,
				mockUser,
			);

			expect(result.length).toBeGreaterThanOrEqual(1);
			expect(result.length).toBeLessThanOrEqual(2);
		});

		it("should handle errors and return default model array", async () => {
			mockModels.getIncludedInRouterModelsForUser.mockImplementation(() => {
				throw new Error("Test error");
			});

			const result = await ModelRouter.selectMultipleModels(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result).toEqual(["claude-3-5-sonnet-20241022"]);
		});
	});

	describe("edit model selection", () => {
		it("selectNextEditModel returns highest scoring supported model", () => {
			mockModels.getModels.mockReturnValue({
				"mercury-coder": {
					...mockModelConfig,
					provider: "inception",
					supportsNextEdit: true,
					speed: 5,
					reliability: 5,
					contextComplexity: 4,
				},
				"other-model": {
					...mockModelConfig,
					provider: "other",
					supportsNextEdit: true,
					speed: 2,
					reliability: 3,
					contextComplexity: 3,
				},
			});

			const model = ModelRouter.selectNextEditModel();
			expect(model).toBe("mercury-coder");
		});

		it("selectApplyEditModel filters by provider when provided", () => {
			mockModels.getModels.mockReturnValue({
				"mercury-coder": {
					...mockModelConfig,
					provider: "inception",
					supportsApplyEdit: true,
					speed: 3,
					reliability: 5,
				},
				"other-model": {
					...mockModelConfig,
					provider: "other",
					supportsApplyEdit: true,
					speed: 1,
					reliability: 5,
				},
			});

			const model = ModelRouter.selectApplyEditModel({
				preferredProvider: "inception",
			});

			expect(model).toBe("mercury-coder");
		});
	});

	describe("model scoring", () => {
		it("should score models based on complexity match", async () => {
			const availableModels = {
				"perfect-match": {
					...mockModelConfig,
					contextComplexity: 3,
				},
				"poor-match": {
					...mockModelConfig,
					contextComplexity: 1,
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);

			mockModels.getModelConfig.mockImplementation((modelId: string) => {
				return availableModels[modelId];
			});

			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(mockRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Test prompt",
				[],
				undefined,
				mockUser,
			);

			expect(result).toBe("perfect-match");
		});

		it("should consider budget constraints in scoring", async () => {
			const budgetRequirements: PromptRequirements = {
				...mockRequirements,
				budget_constraint: 0.05,
			};

			const availableModels = {
				"expensive-model": {
					...mockModelConfig,
					costPer1kInputTokens: 0.1,
					costPer1kOutputTokens: 0.2,
				},
				"cheap-model": {
					...mockModelConfig,
					costPer1kInputTokens: 0.001,
					costPer1kOutputTokens: 0.002,
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);

			mockModels.getModelConfig.mockImplementation((modelId: string) => {
				return availableModels[modelId];
			});

			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(budgetRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Test prompt",
				[],
				50,
				mockUser,
			);

			expect(result).toBe("cheap-model");
		});

		it("should boost multimodal models for image tasks", async () => {
			const imageRequirements: PromptRequirements = {
				...mockRequirements,
				hasImages: true,
			};

			const availableModels = {
				"multimodal-model": {
					...mockModelConfig,
					multimodal: true,
				},
				"text-only-model": {
					...mockModelConfig,
					multimodal: false,
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);

			mockModels.getModelConfig.mockImplementation((modelId: string) => {
				return availableModels[modelId];
			});

			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(imageRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Analyze this image",
				[{ type: "image", url: "base64-image" }],
				undefined,
				mockUser,
			);

			expect(result).toBe("multimodal-model");
		});
	});

	describe("capability matching", () => {
		it("should prefer models with matching capabilities", async () => {
			const codingRequirements: PromptRequirements = {
				...mockRequirements,
				requiredCapabilities: ["coding"],
			};

			const availableModels = {
				"coding-model": {
					...mockModelConfig,
					strengths: ["coding", "reasoning"],
				},
				"general-model": {
					...mockModelConfig,
					strengths: ["general_knowledge", "chat"],
				},
			};

			mockModels.getIncludedInRouterModelsForUser.mockResolvedValue(
				availableModels,
			);

			mockModels.getModelConfig.mockImplementation((modelId: string) => {
				return availableModels[modelId];
			});

			mockPromptAnalyzer.analyzePrompt.mockResolvedValue(codingRequirements);

			const result = await ModelRouter.selectModel(
				mockEnv,
				"Write some Python code",
				[],
				undefined,
				mockUser,
			);

			expect(result).toBe("coding-model");
		});
	});
});
