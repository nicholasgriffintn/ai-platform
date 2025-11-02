import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoreChatOptions } from "~/types";
import type { ValidationContext } from "../../ValidationPipeline";
import { ContextLimitValidator } from "../ContextLimitValidator";

vi.mock("~/lib/chat/utils", () => ({
	checkContextWindowLimits: vi.fn(),
	getAllAttachments: vi.fn(),
	pruneMessagesToFitContext: vi.fn(),
	sanitiseInput: vi.fn(),
}));

describe("ContextLimitValidator", () => {
	let validator: ContextLimitValidator;
	let baseOptions: CoreChatOptions;
	let baseContext: ValidationContext;
	let mockCheckContextWindowLimits: any;
	let mockGetAllAttachments: any;
	let mockPruneMessagesToFitContext: any;
	let mockSanitiseInput: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const {
			checkContextWindowLimits,
			getAllAttachments,
			pruneMessagesToFitContext,
			sanitiseInput,
		} =
			await vi.importMock<typeof import("~/lib/chat/utils")>(
				"~/lib/chat/utils",
			);

		mockCheckContextWindowLimits = vi.mocked(checkContextWindowLimits);
		mockGetAllAttachments = vi.mocked(getAllAttachments);
		mockPruneMessagesToFitContext = vi.mocked(pruneMessagesToFitContext);
		mockSanitiseInput = vi.mocked(sanitiseInput);

		validator = new ContextLimitValidator();

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
		};

		baseContext = {
			sanitizedMessages: [{ role: "user", content: "Hello world" }],
			lastMessage: { role: "user", content: "Hello world" },
			modelConfig: {
				matchingModel: "claude-3-sonnet",
				provider: "anthropic",
				contextWindow: 200000,
				maxOutputTokens: 4096,
			},
		};

		mockGetAllAttachments.mockReturnValue({
			markdownAttachments: [],
		});

		mockSanitiseInput.mockReturnValue("Hello world");
		mockPruneMessagesToFitContext.mockReturnValue([
			{ role: "user", content: "Hello world" },
		]);
		mockCheckContextWindowLimits.mockReturnValue(undefined);
	});

	describe("validate", () => {
		it("should successfully validate with valid context", async () => {
			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.messageWithContext).toBe("Hello world");

			expect(mockGetAllAttachments).toHaveBeenCalledWith([
				{ type: "text", text: "Hello world" },
			]);
			expect(mockSanitiseInput).toHaveBeenCalledWith("Hello world");
			expect(mockPruneMessagesToFitContext).toHaveBeenCalledWith(
				baseContext.sanitizedMessages,
				"Hello world",
				baseContext.modelConfig,
			);
			expect(mockCheckContextWindowLimits).toHaveBeenCalledWith(
				[{ role: "user", content: "Hello world" }],
				"Hello world",
				baseContext.modelConfig,
			);
		});

		it("should fail validation when sanitizedMessages is missing", async () => {
			const contextWithoutMessages = {
				lastMessage: { role: "user", content: "Hello world" },
				modelConfig: baseContext.modelConfig,
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutMessages,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing required context for validation",
			);
			expect(result.validation.validationType).toBe("context");
			expect(result.context).toEqual({});
		});

		it("should fail validation when lastMessage is missing", async () => {
			const contextWithoutLastMessage = {
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
				modelConfig: baseContext.modelConfig,
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutLastMessage,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing required context for validation",
			);
			expect(result.validation.validationType).toBe("context");
			expect(result.context).toEqual({});
		});

		it("should fail validation when modelConfig is missing", async () => {
			const contextWithoutModelConfig = {
				sanitizedMessages: [{ role: "user", content: "Hello world" }],
				lastMessage: { role: "user", content: "Hello world" },
			};

			const result = await validator.validate(
				baseOptions,
				contextWithoutModelConfig,
			);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe(
				"Missing required context for validation",
			);
			expect(result.validation.validationType).toBe("context");
			expect(result.context).toEqual({});
		});

		it("should handle array content in last message", async () => {
			const contextWithArrayContent = {
				...baseContext,
				lastMessage: {
					role: "user",
					content: [
						{ type: "text", text: "Hello world" },
						{ type: "image", image_url: { url: "data:image/jpeg;base64,..." } },
					],
				},
			};

			const result = await validator.validate(
				baseOptions,
				contextWithArrayContent,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockGetAllAttachments).toHaveBeenCalledWith([
				{ type: "text", text: "Hello world" },
				{ type: "image", image_url: { url: "data:image/jpeg;base64,..." } },
			]);
		});

		it("should handle string content in last message", async () => {
			const contextWithStringContent = {
				...baseContext,
				lastMessage: { role: "user", content: "Simple text message" },
			};

			const result = await validator.validate(
				baseOptions,
				contextWithStringContent,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockGetAllAttachments).toHaveBeenCalledWith([
				{ type: "text", text: "Simple text message" },
			]);
		});

		it("should handle content with no text part", async () => {
			const contextWithNoTextContent = {
				...baseContext,
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
			expect(mockSanitiseInput).toHaveBeenCalledWith("");
		});

		it("should handle markdown attachments", async () => {
			const markdownAttachments = [
				{ name: "document.md", markdown: "# Document Title\nContent here" },
				{ markdown: "Another document without name" },
			];

			mockGetAllAttachments.mockReturnValue({
				markdownAttachments,
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.messageWithContext).toBe(
				"Hello world\n\nContext from attached documents:\n" +
					"# document.md\n# Document Title\nContent here\n\n" +
					"Another document without name",
			);
		});

		it("should handle markdown attachments without names", async () => {
			const markdownAttachments = [
				{ markdown: "Document content without name" },
			];

			mockGetAllAttachments.mockReturnValue({
				markdownAttachments,
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.messageWithContext).toBe(
				"Hello world\n\nContext from attached documents:\n" +
					"Document content without name",
			);
		});

		it("should handle empty sanitized messages array", async () => {
			const contextWithEmptyMessages = {
				...baseContext,
				sanitizedMessages: [],
			};

			const result = await validator.validate(
				baseOptions,
				contextWithEmptyMessages,
			);

			expect(result.validation.isValid).toBe(true);
			expect(mockPruneMessagesToFitContext).not.toHaveBeenCalled();
		});

		it("should handle checkContextWindowLimits throwing an error", async () => {
			mockCheckContextWindowLimits.mockImplementation(() => {
				throw new Error("Context window exceeded");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Context window exceeded");
			expect(result.validation.validationType).toBe("context");
			expect(result.context).toEqual({});
		});

		it("should handle pruneMessagesToFitContext throwing an error", async () => {
			mockPruneMessagesToFitContext.mockImplementation(() => {
				throw new Error("Pruning failed");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Pruning failed");
			expect(result.validation.validationType).toBe("context");
		});

		it("should handle getAllAttachments throwing an error", async () => {
			mockGetAllAttachments.mockImplementation(() => {
				throw new Error("Attachment processing failed");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Attachment processing failed");
			expect(result.validation.validationType).toBe("context");
		});

		it("should handle sanitiseInput throwing an error", async () => {
			mockSanitiseInput.mockImplementation(() => {
				throw new Error("Input sanitization failed");
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Input sanitization failed");
			expect(result.validation.validationType).toBe("context");
		});

		it("should handle error without message", async () => {
			const errorWithoutMessage = new Error();
			errorWithoutMessage.message = undefined as any;
			mockCheckContextWindowLimits.mockImplementation(() => {
				throw errorWithoutMessage;
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(false);
			expect(result.validation.error).toBe("Context window validation failed");
			expect(result.validation.validationType).toBe("context");
		});

		it("should handle null return from pruneMessagesToFitContext", async () => {
			mockPruneMessagesToFitContext.mockReturnValue(null);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockCheckContextWindowLimits).toHaveBeenCalledWith(
				null,
				"Hello world",
				baseContext.modelConfig,
			);
		});

		it("should handle undefined return from pruneMessagesToFitContext", async () => {
			mockPruneMessagesToFitContext.mockReturnValue(undefined);

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(mockCheckContextWindowLimits).toHaveBeenCalledWith(
				undefined,
				"Hello world",
				baseContext.modelConfig,
			);
		});

		it("should handle mixed markdown attachments with and without names", async () => {
			const markdownAttachments = [
				{ name: "doc1.md", markdown: "First document" },
				{ markdown: "Second document" },
				{ name: "doc3.md", markdown: "Third document" },
			];

			mockGetAllAttachments.mockReturnValue({
				markdownAttachments,
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.messageWithContext).toBe(
				"Hello world\n\nContext from attached documents:\n" +
					"# doc1.md\nFirst document\n\n" +
					"Second document\n\n" +
					"# doc3.md\nThird document",
			);
		});

		it("should handle empty markdown content", async () => {
			const markdownAttachments = [{ name: "empty.md", markdown: "" }];

			mockGetAllAttachments.mockReturnValue({
				markdownAttachments,
			});

			const result = await validator.validate(baseOptions, baseContext);

			expect(result.validation.isValid).toBe(true);
			expect(result.context.messageWithContext).toBe(
				"Hello world\n\nContext from attached documents:\n# empty.md\n",
			);
		});
	});
});
