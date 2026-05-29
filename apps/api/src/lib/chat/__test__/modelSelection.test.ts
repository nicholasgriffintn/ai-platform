import { beforeEach, describe, expect, it, vi } from "vitest";

const mockModelRouter = {
	selectModel: vi.fn(),
	selectMultipleModels: vi.fn(),
};

const mockModels = {
	filterModelsForUserAccess: vi.fn(),
	findModelConfig: vi.fn(),
	getModels: vi.fn(),
};

vi.mock("~/lib/modelRouter", () => ({
	ModelRouter: mockModelRouter,
}));

vi.mock("~/lib/providers/models", () => mockModels);

describe("selectModels", () => {
	let selectModels: any;

	beforeEach(async () => {
		vi.clearAllMocks();
		const availableModels = {
			"primary-model": {
				matchingModel: "primary-model",
				provider: "free-provider",
				isFree: true,
			},
			"second-model": {
				matchingModel: "second-model",
				provider: "free-provider",
				isFree: true,
			},
			"pro-model": {
				matchingModel: "pro-model",
				provider: "pro-provider",
			},
		};
		mockModels.getModels.mockReturnValue(availableModels);
		mockModels.filterModelsForUserAccess.mockResolvedValue(availableModels);
		mockModels.findModelConfig.mockImplementation(async (model: string) => availableModels[model]);

		const module = await import("../modelSelection");
		selectModels = module.selectModels;
	});

	const mockEnv = { DB: {} } as any;
	const mockUser = { id: 123 } as any;
	const mockAttachments = [];
	const lastMessageText = "Hello world";
	const completionId = "completion-123";
	const budgetConstraint = 100;

	describe("when use_multi_model is true and no requestedModel", () => {
		it("should call selectMultipleModels and return result", async () => {
			const expectedModels = ["model1", "model2"];
			mockModelRouter.selectMultipleModels.mockResolvedValue(expectedModels);

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				undefined,
				true,
			);

			expect(mockModelRouter.selectMultipleModels).toHaveBeenCalledWith(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
			);
			expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
			expect(result).toEqual(expectedModels);
		});
	});

	describe("when requestedModels are provided", () => {
		it("should return the explicit models without invoking router selection", async () => {
			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				"primary-model",
				true,
				["primary-model", "second-model", "primary-model", ""],
			);

			expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
			expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
			expect(mockModels.filterModelsForUserAccess).toHaveBeenCalled();
			expect(result).toEqual(["primary-model", "second-model"]);
		});

		it("should reject explicit models the user cannot access", async () => {
			mockModels.filterModelsForUserAccess.mockResolvedValue({
				"primary-model": {
					matchingModel: "primary-model",
					provider: "free-provider",
					isFree: true,
				},
			});

			await expect(
				selectModels(
					mockEnv,
					lastMessageText,
					mockAttachments,
					budgetConstraint,
					mockUser,
					completionId,
					"primary-model",
					true,
					["primary-model", "pro-model"],
				),
			).rejects.toMatchObject({
				message: "Model not found or user does not have access: pro-model",
				statusCode: 403,
			});

			expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
			expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
		});

		it("should pass provider constraints when validating explicit models", async () => {
			await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				"primary-model",
				true,
				["primary-model"],
				"free-provider",
			);

			expect(mockModels.findModelConfig).toHaveBeenCalledWith(
				"primary-model",
				mockEnv,
				"free-provider",
			);
		});
	});

	describe("when use_multi_model is true but requestedModel is provided", () => {
		it("should return the requested model in an array", async () => {
			const requestedModel = "specific-model";

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				requestedModel,
				true,
			);

			expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
			expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
			expect(result).toEqual([requestedModel]);
		});
	});

	describe("when requestedModel is provided", () => {
		it("should return the requested model in an array", async () => {
			const requestedModel = "specific-model";

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				requestedModel,
				false,
			);

			expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
			expect(mockModelRouter.selectModel).not.toHaveBeenCalled();
			expect(result).toEqual([requestedModel]);
		});
	});

	describe("when no requestedModel and use_multi_model is false", () => {
		it("should call selectModel and return result in an array", async () => {
			const selectedModel = "auto-selected-model";
			mockModelRouter.selectModel.mockResolvedValue(selectedModel);

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
				undefined,
				false,
			);

			expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
			);
			expect(mockModelRouter.selectMultipleModels).not.toHaveBeenCalled();
			expect(result).toEqual([selectedModel]);
		});
	});

	describe("when use_multi_model is undefined", () => {
		it("should default to single model selection", async () => {
			const selectedModel = "auto-selected-model";
			mockModelRouter.selectModel.mockResolvedValue(selectedModel);

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
			);

			expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
				mockEnv,
				lastMessageText,
				mockAttachments,
				budgetConstraint,
				mockUser,
				completionId,
			);
			expect(result).toEqual([selectedModel]);
		});
	});

	describe("with optional parameters", () => {
		it("should handle undefined budgetConstraint", async () => {
			const selectedModel = "auto-selected-model";
			mockModelRouter.selectModel.mockResolvedValue(selectedModel);

			const result = await selectModels(
				mockEnv,
				lastMessageText,
				mockAttachments,
				undefined,
				mockUser,
				completionId,
			);

			expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
				mockEnv,
				lastMessageText,
				mockAttachments,
				undefined,
				mockUser,
				completionId,
			);
			expect(result).toEqual([selectedModel]);
		});

		it("should handle different attachment types", async () => {
			const attachmentsWithImage = [{ type: "image", data: "base64data" }] as any;
			const selectedModel = "vision-model";
			mockModelRouter.selectModel.mockResolvedValue(selectedModel);

			const result = await selectModels(
				mockEnv,
				"Analyze this image",
				attachmentsWithImage,
				budgetConstraint,
				mockUser,
				completionId,
			);

			expect(mockModelRouter.selectModel).toHaveBeenCalledWith(
				mockEnv,
				"Analyze this image",
				attachmentsWithImage,
				budgetConstraint,
				mockUser,
				completionId,
			);
			expect(result).toEqual([selectedModel]);
		});
	});
});
