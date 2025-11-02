import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockLogger = vi.hoisted(() => ({
	debug: vi.fn(),
	error: vi.fn(),
}));

const mockProvider = vi.hoisted(() => ({
	getResponse: vi.fn(),
}));

const mockStorageService = vi.hoisted(() => ({
	uploadObject: vi.fn(),
}));

const mockCrypto = vi.hoisted(() => ({
	randomUUID: vi.fn(() => "test-uuid-123"),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => mockLogger),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => mockProvider),
	},
}));

vi.mock("~/lib/storage", () => ({
	StorageService: vi.fn(() => mockStorageService),
}));

vi.mock("~/utils/markdown", () => ({
	convertMarkdownToHtml: vi.fn((md) => `<p>${md}</p>`),
}));

Object.defineProperty(global, "crypto", {
	value: mockCrypto,
});

import type { OcrParams } from "../ocr";
import { performOcr } from "../ocr";

describe("performOcr", () => {
	const mockRequest: IRequest = {
		env: {
			MISTRAL_API_KEY: "test-api-key",
			ASSETS_BUCKET: "test-bucket",
			PUBLIC_ASSETS_URL: "https://assets.test.com",
		},
		user: { id: "user-123" },
	} as any;

	const baseMockParams: OcrParams = {
		document: {
			type: "document_url",
			document_url: "https://example.com/doc.pdf",
			document_name: "test.pdf",
		},
	};

	const mockOcrResponse = {
		pages: [
			{
				markdown: "# Page 1\nThis is content from page 1",
				images: [
					{
						id: "img-1",
						image_base64:
							"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
					},
				],
			},
			{
				markdown: "# Page 2\nThis is content from page 2",
				images: [],
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockProvider.getResponse.mockResolvedValue(mockOcrResponse);
		mockStorageService.uploadObject.mockResolvedValue("uploaded/path.md");
	});

	describe("parameter validation", () => {
		it("should throw error when MISTRAL_API_KEY is missing", async () => {
			const reqWithoutKey = {
				...mockRequest,
				env: { ...mockRequest.env, MISTRAL_API_KEY: "" },
			};

			const result = await performOcr(baseMockParams, reqWithoutKey);

			expect(result.status).toBe("error");
			expect(result.error).toBe("Mistral API key not configured");
		});

		it("should throw error when document is missing", async () => {
			const paramsWithoutDoc = { ...baseMockParams };
			delete paramsWithoutDoc.document;

			const result = await performOcr(paramsWithoutDoc, mockRequest);

			expect(result.status).toBe("error");
			expect(result.error).toBe("Document is required");
		});
	});

	describe("successful OCR processing", () => {
		it("should perform OCR with default parameters", async () => {
			const result = await performOcr(baseMockParams, mockRequest);

			expect(mockProvider.getResponse).toHaveBeenCalledWith({
				env: mockRequest.env,
				completion_id: "test-uuid-123",
				model: "mistral-ocr-latest",
				body: {
					document: baseMockParams.document,
					model: "mistral-ocr-latest",
					id: "test-uuid-123",
					pages: undefined,
					include_image_base64: true,
					image_limit: undefined,
					image_min_size: undefined,
				},
				store: false,
				user: mockRequest.user,
			});

			expect(result.status).toBe("success");
			expect(result.data?.url).toBe("https://assets.test.com/uploaded/path.md");
		});

		it("should use custom model when provided", async () => {
			const paramsWithModel = {
				...baseMockParams,
				model: "custom-ocr-model",
			};

			await performOcr(paramsWithModel, mockRequest);

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "custom-ocr-model",
					body: expect.objectContaining({
						model: "custom-ocr-model",
					}),
				}),
			);
		});

		it("should use custom id when provided", async () => {
			const paramsWithId = {
				...baseMockParams,
				id: "custom-id-456",
			};

			await performOcr(paramsWithId, mockRequest);

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					completion_id: "custom-id-456",
					body: expect.objectContaining({
						id: "custom-id-456",
					}),
				}),
			);
		});

		it("should handle pages parameter", async () => {
			const paramsWithPages = {
				...baseMockParams,
				pages: [1, 3, 5],
			};

			await performOcr(paramsWithPages, mockRequest);

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						pages: [1, 3, 5],
					}),
				}),
			);
		});

		it("should handle image options", async () => {
			const paramsWithImageOptions = {
				...baseMockParams,
				include_image_base64: false,
				image_limit: 10,
				image_min_size: 1000,
			};

			await performOcr(paramsWithImageOptions, mockRequest);

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						include_image_base64: false,
						image_limit: 10,
						image_min_size: 1000,
					}),
				}),
			);
		});
	});

	describe("output format handling", () => {
		it("should return JSON format when requested", async () => {
			const paramsWithJson = {
				...baseMockParams,
				output_format: "json" as const,
			};

			mockStorageService.uploadObject.mockResolvedValue(
				"ocr/test-uuid-123/output.json",
			);

			const result = await performOcr(paramsWithJson, mockRequest);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				"ocr/test-uuid-123/output.json",
				JSON.stringify(mockOcrResponse),
				{
					contentType: "application/json",
					contentLength: JSON.stringify(mockOcrResponse).length,
				},
			);

			expect(result.status).toBe("success");
			expect(result.data?.url).toBe(
				"https://assets.test.com/ocr/test-uuid-123/output.json",
			);
		});

		it("should return HTML format when requested", async () => {
			const paramsWithHtml = {
				...baseMockParams,
				output_format: "html" as const,
			};

			mockStorageService.uploadObject.mockResolvedValue(
				"ocr/test-uuid-123/output.html",
			);

			const result = await performOcr(paramsWithHtml, mockRequest);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				"ocr/test-uuid-123/output.html",
				expect.stringContaining("<!DOCTYPE html>"),
				{
					contentType: "text/html",
					contentLength: expect.any(Number),
				},
			);

			expect(result.status).toBe("success");
			expect(result.data?.url).toBe(
				"https://assets.test.com/ocr/test-uuid-123/output.html",
			);
		});

		it("should return markdown format by default", async () => {
			mockStorageService.uploadObject.mockResolvedValue(
				"ocr/test-uuid-123/output.md",
			);

			const result = await performOcr(baseMockParams, mockRequest);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				"ocr/test-uuid-123/output.md",
				expect.stringContaining("# Page 1"),
				{
					contentType: "text/markdown",
					contentLength: expect.any(Number),
				},
			);

			expect(result.status).toBe("success");
		});
	});

	describe("image processing", () => {
		it("should replace image references with base64 data", async () => {
			const responseWithImageRefs = {
				pages: [
					{
						markdown: "![Image 1](img-1)\nSome text after image",
						images: [
							{
								id: "img-1",
								image_base64: "data:image/png;base64,testdata123",
							},
						],
					},
				],
			};

			mockProvider.getResponse.mockResolvedValue(responseWithImageRefs);

			const _result = await performOcr(baseMockParams, mockRequest);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("![img-1](data:image/png;base64,testdata123)"),
				expect.any(Object),
			);
		});

		it("should handle pages without images", async () => {
			const responseWithoutImages = {
				pages: [
					{
						markdown: "# Simple page without images",
						images: [],
					},
				],
			};

			mockProvider.getResponse.mockResolvedValue(responseWithoutImages);

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("success");
			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("# Simple page without images"),
				expect.any(Object),
			);
		});
	});

	describe("error handling", () => {
		it("should handle AssistantError properly", async () => {
			mockProvider.getResponse.mockRejectedValue(
				new AssistantError("API Error", ErrorType.PROVIDER_ERROR),
			);

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("error");
			expect(result.error).toBe("API Error");
			expect(mockLogger.error).toHaveBeenCalledWith("OCR error:", {
				error: expect.any(AssistantError),
			});
		});

		it("should handle generic errors", async () => {
			mockProvider.getResponse.mockRejectedValue(new Error("Network error"));

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("error");
			expect(result.error).toBe("Failed to perform OCR on the image");
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it("should handle storage upload errors", async () => {
			mockProvider.getResponse.mockResolvedValue(mockOcrResponse);
			mockStorageService.uploadObject.mockRejectedValue(
				new Error("Upload failed"),
			);

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("error");
			expect(result.error).toBe("Failed to perform OCR on the image");
		});
	});

	describe("edge cases", () => {
		it("should handle empty pages response", async () => {
			mockProvider.getResponse.mockResolvedValue({ pages: [] });

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("success");
			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				expect.any(String),
				"",
				expect.any(Object),
			);
		});

		it("should handle pages with only text (no markdown)", async () => {
			const responseWithText = {
				pages: [
					{
						text: "Plain text content",
						images: [],
					},
				],
			};

			mockProvider.getResponse.mockResolvedValue(responseWithText);

			const result = await performOcr(baseMockParams, mockRequest);

			expect(result.status).toBe("success");
			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				expect.any(String),
				expect.stringContaining("Plain text content"),
				expect.any(Object),
			);
		});

		it("should handle missing PUBLIC_ASSETS_URL", async () => {
			const reqWithoutAssetsUrl = {
				...mockRequest,
				env: { ...mockRequest.env, PUBLIC_ASSETS_URL: "" },
			};

			const result = await performOcr(baseMockParams, reqWithoutAssetsUrl);

			expect(result.status).toBe("success");
			expect(result.data?.url).toBe("/uploaded/path.md");
		});
	});
});
