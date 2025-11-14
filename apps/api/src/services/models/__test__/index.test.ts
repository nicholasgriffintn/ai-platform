import {
	type MockedFunction,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import {
	getModelDetails,
	listStrengths,
	listModalities,
	listModels,
	listModelsByStrength,
	listModelsByModality,
} from "../index";

vi.mock("~/lib/providers/models", () => ({
	getModels: vi.fn(),
	filterModelsForUserAccess: vi.fn(),
	getModelsByCapability: vi.fn(),
	getModelsByModality: vi.fn(),
	getModelConfig: vi.fn(),
	getAvailableStrengths: vi
		.fn()
		.mockReturnValue(["chat", "completion", "embedding"]),
	availableModalities: ["text", "image", "audio"],
}));

describe("Models Service", () => {
	let mockGetModels: MockedFunction<any>;
	let mockFilterModelsForUserAccess: MockedFunction<any>;
	let mockGetModelsByCapability: MockedFunction<any>;
	let mockGetModelsByModality: MockedFunction<any>;
	let mockGetModelConfig: MockedFunction<any>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const modelsLib = await import("~/lib/providers/models");
		mockGetModels = vi.mocked(modelsLib.getModels);
		mockFilterModelsForUserAccess = vi.mocked(
			modelsLib.filterModelsForUserAccess,
		);
		mockGetModelsByCapability = vi.mocked(modelsLib.getModelsByCapability);
		mockGetModelsByModality = vi.mocked(modelsLib.getModelsByModality);
		mockGetModelConfig = vi.mocked(modelsLib.getModelConfig);
	});

	describe("listModels", () => {
		it("should return filtered models for user", async () => {
			const mockModels = {
				"gpt-4": { id: "gpt-4" },
				"claude-3": { id: "claude-3" },
			};
			const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

			mockGetModels.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModels({} as any, 123);

			expect(mockGetModels).toHaveBeenCalledOnce();
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
				mockModels,
				{},
				123,
				{ shouldUseCache: false },
			);
			expect(result).toEqual(mockFilteredModels);
		});

		it("should work without userId", async () => {
			const mockModels = { "gpt-4": { id: "gpt-4" } };

			mockGetModels.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockModels);

			const result = await listModels({} as any);

			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
				mockModels,
				{},
				undefined,
				{ shouldUseCache: false },
			);
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
			const mockModels = { "gpt-4": { id: "gpt-4" } };
			const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

			mockGetModelsByCapability.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModelsByStrength({} as any, "chat", 123);

			expect(mockGetModelsByCapability).toHaveBeenCalledWith("chat");
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
				mockModels,
				{},
				123,
				{ shouldUseCache: false },
			);
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
			const mockModels = { "gpt-4": { id: "gpt-4" } };
			const mockFilteredModels = { "gpt-4": { id: "gpt-4" } };

			mockGetModelsByModality.mockReturnValue(mockModels);
			mockFilterModelsForUserAccess.mockResolvedValue(mockFilteredModels);

			const result = await listModelsByModality({} as any, "text", 123);

			expect(mockGetModelsByModality).toHaveBeenCalledWith("text");
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
				mockModels,
				{},
				123,
				{ shouldUseCache: false },
			);
			expect(result).toEqual(mockFilteredModels);
		});
	});

	describe("getModelDetails", () => {
		it("should return model details for accessible model", async () => {
			const mockModel = { id: "gpt-4", name: "GPT-4" };
			const mockAccessibleModels = { "gpt-4": mockModel };

			mockGetModelConfig.mockResolvedValue(mockModel);
			mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

			const result = await getModelDetails({} as any, "gpt-4", 123);

			expect(mockGetModelConfig).toHaveBeenCalledWith("gpt-4");
			expect(mockFilterModelsForUserAccess).toHaveBeenCalledWith(
				{ "gpt-4": mockModel },
				{},
				123,
				{ shouldUseCache: false },
			);
			expect(result).toEqual(mockModel);
		});

		it("should throw error for inaccessible model", async () => {
			const mockModel = { id: "gpt-4", name: "GPT-4" };
			const mockAccessibleModels = {};

			mockGetModelConfig.mockResolvedValue(mockModel);
			mockFilterModelsForUserAccess.mockResolvedValue(mockAccessibleModels);

			await expect(getModelDetails({} as any, "gpt-4", 123)).rejects.toThrow(
				"Model not found or user does not have access",
			);
		});
	});
});
