import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../ValidationPipeline";
import { ModelConfigValidator } from "../ModelConfigValidator";

vi.mock("~/lib/chat/modelSelection", () => ({
	selectModels: vi.fn(),
}));

vi.mock("~/lib/chat/utils", () => ({
	getAllAttachments: vi.fn(),
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfig: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	})),
}));

describe("ModelConfigValidator", () => {
	let validator: ModelConfigValidator;
	let baseOptions: CoreChatOptions;
	let baseContext: ValidationContext;
	let mockSelectModels: any;
	let mockGetAllAttachments: any;
	let mockGetModelConfig: any;
	let _mockLogger: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { selectModels } = await vi.importMock<
			typeof import("~/lib/chat/modelSelection")
		>("~/lib/chat/modelSelection");
		const { getAllAttachments } =
			await vi.importMock<typeof import("~/lib/chat/utils")>(
				"~/lib/chat/utils",
			);
		const { getModelConfig } = await vi.importMock<
			typeof import("~/lib/providers/models")
		>("~/lib/providers/models");
		const { getLogger } =
			await vi.importMock<typeof import("~/utils/logger")>("~/utils/logger");

		mockSelectModels = vi.mocked(selectModels);
		mockGetAllAttachments = vi.mocked(getAllAttachments);
		mockGetModelConfig = vi.mocked(getModelConfig);
		_mockLogger = vi.mocked(getLogger)().info;

		validator = new ModelConfigValidator();

		baseOptions = {
			// @ts-expect-error - mock implementation
			env: {
				DB: {} as any,
				AI: {} as any,
				AWS_REGION: "us-east-1",
			},
			// @ts-expect-error - mock implementation
			user: {
				id: 123,
				email: "test@example.com",
				plan_id: "pro",
			},
			messages: [
				{
					role: "user",
					content: "Hello world",
				},
			],
			completion_id: "completion-123",
			platform: "api",
			mode: "normal",
			model: "claude-3-sonnet",
			use_multi_model: false,
			budget_constraint: 1000,
		};

		baseContext = {
			sanitizedMessages: [{ role: "user", content: "Hello world" }],
			lastMessage: { role: "user", content: "Hello world" },
		};

		mockGetAllAttachments.mockReturnValue({
			allAttachments: [],
		});

		mockSelectModels.mockResolvedValue(["claude-3-sonnet"]);

		mockGetModelConfig.mockResolvedValue({
			matchingModel: "claude-3-sonnet",
			provider: "anthropic",
			contextWindow: 200000,
			maxOutputTokens: 4096,
		});
	});

	describe("validate", () => {
		it("should successfully validate with valid model configuration", async () => {
			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.modelConfig).toEqual({
				matchingModel: "claude-3-sonnet",
				provider: "anthropic",
				contextWindow: 200000,
				maxOutputTokens: 4096,
			});
			expect(result.context.selectedModels).toEqual(["claude-3-sonnet"]);

			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Hello world",
				[],
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				false,
			);
			expect(mockGetModelConfig).toHaveBeenCalledWith(
				"claude-3-sonnet",
				baseOptions.env,
			);
		});

		it("should fail validation when sanitizedMessages is missing", async () => {
			const contextWithoutMessages = {
				lastMessage: { role: "user", content: "Hello world" },
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutMessages,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing sanitized messages context",
			);
			expect(result.validation.validationType).toBe("model");
			expect(result.context).toEqual({});
		});

		it("should fail validation when lastMessage is missing", async () => {
			const contextWithoutLastMessage = {
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutLastMessage,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing sanitized messages context",
			);
			expect(result.validation.validationType).toBe("model");
			expect(result.context).toEqual({});
		});

		it("should handle array content in last message", async () => {
			const contextWithArrayContent = {
				sanitizedMessages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "Hello world" },
							{
								type: "image",
								image_url: { url: "data:image/jpeg;base64,..." },
							},
						],
					},
				],
				lastMessage: {
					role: "user",
					content: [
						{ type: "text", text: "Hello world" },
						{ type: "image", image_url: { url: "data:image/jpeg;base64,..." } },
					],
				},
			};

			mockGetAllAttachments.mockReturnValue({
				allAttachments: [{ type: "image", url: "data:image/jpeg;base64,..." }],
			});

			const result = await validator.validate(
				baseOptions,
				contextWithArrayContent,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Hello world",
				[{ type: "image", url: "data:image/jpeg;base64,..." }],
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				false,
			);
		});

		it("should handle string content in last message", async () => {
			const contextWithStringContent = {
				sanitizedMessages: [{ role: "user", content: "Simple text message" }],
				lastMessage: { role: "user", content: "Simple text message" },
			};

			const result = await validator.validate(
				baseOptions,
				contextWithStringContent,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Simple text message",
				[],
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				false,
			);
		});

		it("should handle content with no text part", async () => {
			const contextWithNoTextContent = {
				sanitizedMessages: [
					{
						role: "user",
						content: [
							{
								type: "image",
								image_url: { url: "data:image/jpeg;base64,..." },
							},
						],
					},
				],
				lastMessage: {
					role: "user",
					content: [
						{ type: "image", image_url: { url: "data:image/jpeg;base64,..." } },
					],
				},
			};

			const result = await validator.validate(
				baseOptions,
				contextWithNoTextContent,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"",
				[],
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				false,
			);
		});

		it("should fail validation when model configuration is not found", async () => {
			mockGetModelConfig.mockResolvedValue(null);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Invalid model configuration");
			expect(result.validation.validationType).toBe("model");
			expect(result.context).toEqual({});
		});

		it("should fail validation when model configuration is undefined", async () => {
			mockGetModelConfig.mockResolvedValue(undefined);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Invalid model configuration");
			expect(result.validation.validationType).toBe("model");
		});

		it("should handle selectModels throwing an error", async () => {
			mockSelectModels.mockRejectedValue(new Error("Model selection failed"));

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Model validation failed: Model selection failed",
			);
			expect(result.validation.validationType).toBe("model");
			expect(result.context).toEqual({});
		});

		it("should handle getModelConfig throwing an error", async () => {
			mockGetModelConfig.mockRejectedValue(
				new Error("Model config fetch failed"),
			);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Model validation failed: Model config fetch failed",
			);
			expect(result.validation.validationType).toBe("model");
		});

		it("should handle multi-model configuration", async () => {
			const multiModelOptions = {
				...baseOptions,
				use_multi_model: true,
			};

			mockSelectModels.mockResolvedValue(["claude-3-sonnet", "gpt-4"]);

			const result = await validator.validate(multiModelOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.selectedModels).toEqual([
				"claude-3-sonnet",
				"gpt-4",
			]);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Hello world",
				[],
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				true,
			);
		});

		it("should handle missing optional parameters", async () => {
			const optionsWithoutOptionalParams = {
				...baseOptions,
				model: undefined,
				use_multi_model: undefined,
				budget_constraint: undefined,
			};

			const result = await validator.validate(
				optionsWithoutOptionalParams,
				baseContext,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Hello world",
				[],
				undefined,
				baseOptions.user,
				"completion-123",
				undefined,
				false,
			);
		});

		it("should handle empty selected models array", async () => {
			mockSelectModels.mockResolvedValue([]);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("No models selected");
			expect(result.validation.validationType).toBe("model");
		});

		it("should handle error with undefined message", async () => {
			const errorWithoutMessage = new Error();
			errorWithoutMessage.message = undefined as any;
			mockSelectModels.mockRejectedValue(errorWithoutMessage);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Model validation failed: undefined",
			);
			expect(result.validation.validationType).toBe("model");
		});

		it("should handle getAllAttachments returning complex attachments", async () => {
			const complexAttachments = [
				{ type: "image", url: "data:image/jpeg;base64,..." },
				{ type: "document", name: "document.pdf", content: "..." },
			];

			mockGetAllAttachments.mockReturnValue({
				allAttachments: complexAttachments,
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockSelectModels).toHaveBeenCalledWith(
				baseOptions.env,
				"Hello world",
				complexAttachments,
				1000,
				baseOptions.user,
				"completion-123",
				"claude-3-sonnet",
				false,
			);
		});
	});
});
