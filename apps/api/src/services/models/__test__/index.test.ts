import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelConfig, ModelConfigItem } from "@assistant/schemas";

import {
	getModelDetails,
	listArtificialAnalysisModels,
	listStrengths,
	listModalities,
	listModels,
	listModelsByStrength,
	listModelsByModality,
} from "../index";

type ModelsLib = typeof import("~/lib/providers/models");

const repositoryMocks = vi.hoisted(() => ({
	listPage: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
	getModels: vi.fn(),
	filterModelsForUserAccess: vi.fn(),
	getModelsByCapability: vi.fn(),
	getModelsByModality: vi.fn(),
	getModelConfig: vi.fn(),
	getAvailableStrengths: vi.fn().mockReturnValue(["chat", "completion", "embedding"]),
	availableModalities: ["text", "image", "audio"],
}));

vi.mock("~/repositories", () => ({
	RepositoryManager: {
		getInstance: vi.fn(() => ({
			artificialAnalysis: {
				listPage: repositoryMocks.listPage,
			},
		})),
	},
}));

describe("Models Service", () => {
	let mockGetModels: MockedFunction<ModelsLib["getModels"]>;
	let mockFilterModelsForUserAccess: MockedFunction<ModelsLib["filterModelsForUserAccess"]>;
	let mockGetModelsByCapability: MockedFunction<ModelsLib["getModelsByCapability"]>;
	let mockGetModelsByModality: MockedFunction<ModelsLib["getModelsByModality"]>;
	let mockGetModelConfig: MockedFunction<ModelsLib["getModelConfig"]>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const modelsLib = await import("~/lib/providers/models");
		mockGetModels = vi.mocked(modelsLib.getModels);
		mockFilterModelsForUserAccess = vi.mocked(modelsLib.filterModelsForUserAccess);
		mockGetModelsByCapability = vi.mocked(modelsLib.getModelsByCapability);
		mockGetModelsByModality = vi.mocked(modelsLib.getModelsByModality);
		mockGetModelConfig = vi.mocked(modelsLib.getModelConfig);
	});

	describe("listArtificialAnalysisModels", () => {
		it("returns a paginated Artificial Analysis response with attribution", async () => {
			repositoryMocks.listPage.mockResolvedValue({
				models: [
					{
						id: "model-1",
						name: "Model 1",
						evaluations: {},
						pricing: {},
						source: "artificial_analysis",
						source_url: "https://artificialanalysis.ai/",
						ingested_at: "2026-06-23T10:00:00.000Z",
					},
				],
				total: 42,
				page: 2,
				limit: 10,
				totalPages: 5,
			});

			const result = await listArtificialAnalysisModels({} as any, { page: 2, limit: 10 });

			expect(repositoryMocks.listPage).toHaveBeenCalledWith({ page: 2, limit: 10 });
			expect(result).toEqual({
				attribution: {
					label: "Artificial Analysis",
					url: "https://artificialanalysis.ai/",
				},
				models: [
					{
						id: "model-1",
						name: "Model 1",
						evaluations: {},
						pricing: {},
						source: "artificial_analysis",
						source_url: "https://artificialanalysis.ai/",
						ingested_at: "2026-06-23T10:00:00.000Z",
					},
				],
				pagination: {
					total: 42,
					page: 2,
					limit: 10,
					totalPages: 5,
				},
			});
		});
	});

	describe("listModels", () => {
		it("should return filtered models for user", async () => {
			const mockModels = {
				"gpt-4": { id: "gpt-4" },
				"claude-3": { id: "claude-3" },
			} as unknown as ModelConfig;
			const mockFilteredModels = {
				"gpt-4": { id: "gpt-4" },
			} as unknown as Record<string, ModelConfigItem>;

			mockGetModels.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModels({} as any, 123);

			expect(mockGetModels).toHaveBeenCalledOnce();
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(mockModels, {}, 123, {
				shouldUseCache: false,
			});
			expect(result).toEqual(mockFilteredModels);
		});

		it("should work without userId", async () => {
			const mockModels = { "gpt-4": { id: "gpt-4" } } as unknown as ModelConfig;

			mockGetModels.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockModels);

			const result = await listModels({} as any);

			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(mockModels, {}, undefined, {
				shouldUseCache: false,
			});
			expect(result).toEqual(mockModels);
		});
	});

	describe("listStrengths", () => {
		it("should return available capabilities", () => {
			const result = listStrengths();

			expect(result).toEqual(["chat", "completion", "embedding"]);
		});
	});

	describe("listModelsByStrength", () => {
		it("should return filtered models by capability", async () => {
			const mockModels = { "gpt-4": { id: "gpt-4" } } as unknown as ModelConfig;
			const mockFilteredModels = {
				"gpt-4": { id: "gpt-4" },
			} as unknown as Record<string, ModelConfigItem>;

			mockGetModelsByCapability.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModelsByStrength({} as any, "chat", 123);

			expect(mockGetModelsByCapability).toHaveBeenCalledWith("chat");
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(mockModels, {}, 123, {
				includeTrainingDeployments: false,
				shouldUseCache: false,
			});
			expect(result).toEqual(mockFilteredModels);
		});
	});

	describe("listModalities", () => {
		it("should return available model modalities", () => {
			const result = listModalities();

			expect(result).toEqual(["text", "image", "audio"]);
		});
	});

	describe("listModelsByModality", () => {
		it("should return filtered models by modality", async () => {
			const mockModels = { "gpt-4": { id: "gpt-4" } } as unknown as ModelConfig;
			const mockFilteredModels = {
				"gpt-4": { id: "gpt-4" },
			} as unknown as Record<string, ModelConfigItem>;

			mockGetModelsByModality.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModelsByModality({} as any, "text", 123);

			expect(mockGetModelsByModality).toHaveBeenCalledWith("text");
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(mockModels, {}, 123, {
				includeTrainingDeployments: true,
				shouldUseCache: false,
			});
			expect(result).toEqual(mockFilteredModels);
		});
	});

	describe("getModelDetails", () => {
		it("should return model details for accessible model", async () => {
			const mockModel = {
				id: "gpt-4",
				name: "GPT-4",
			} as unknown as ModelConfigItem;
			const mockAccessibleModels = {
				"gpt-4": mockModel,
			} as unknown as Record<string, ModelConfigItem>;

			mockGetModelConfig.mockResolvedValue(mockModel);
			mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

			const result = await getModelDetails({} as any, "gpt-4", 123);

			expect(mockGetModelConfig).toHaveBeenCalledWith("gpt-4", {}, undefined, 123);
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith({ "gpt-4": mockModel }, {}, 123, {
				shouldUseCache: false,
			});
			expect(result).toEqual(mockModel);
		});

		it("should throw error for inaccessible model", async () => {
			const mockModel = {
				id: "gpt-4",
				name: "GPT-4",
			} as unknown as ModelConfigItem;
			const mockAccessibleModels = {} as unknown as Record<string, ModelConfigItem>;

			mockGetModelConfig.mockResolvedValue(mockModel);
			mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

			await expect(getModelDetails({} as any, "gpt-4", 123)).rejects.toThrow(
				"Model not found or user does not have access",
			);
		});

		it("should throw error for unknown model without filtering an undefined entry", async () => {
			mockGetModelConfig.mockResolvedValue(undefined);

			await expect(getModelDetails({} as any, "gpt-4", 123)).rejects.toThrow(
				"Model not found or user does not have access",
			);
			expect(mockFilterModelsForUserAccess).not.toHaveBeenCalled();
		});
	});
});
