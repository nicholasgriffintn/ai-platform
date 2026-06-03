import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockLogger = vi.hoisted(() => ({
	error: vi.fn(),
}));

const mockFetchAIResponse = vi.hoisted(() => vi.fn());
const mockResolveModelConfig = vi.hoisted(() => vi.fn());
const mockResolveProviderApiKey = vi.hoisted(() => vi.fn());
const mockHasUserProviderApiKey = vi.hoisted(() => vi.fn());
const mockGenerateId = vi.hoisted(() => vi.fn(() => "test-uuid-123"));
const mockStorageService = vi.hoisted(() => ({
	uploadObject: vi.fn(),
	storePrivateAsset: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => mockLogger),
}));

vi.mock("~/lib/providers/lib/fetch", () => ({
	fetchAIResponse: mockFetchAIResponse,
}));

vi.mock("~/lib/providers/models", () => ({
	resolveModelConfig: mockResolveModelConfig,
}));

vi.mock("~/lib/providers/utils/apiKeys", () => ({
	hasUserProviderApiKey: mockHasUserProviderApiKey,
	resolveProviderApiKey: mockResolveProviderApiKey,
}));

vi.mock("~/utils/id", () => ({
	generateId: mockGenerateId,
}));

vi.mock("~/lib/storage", () => ({
	StorageService: class {
		static forPrivateAssets() {
			return mockStorageService;
		}

		constructor() {
			return mockStorageService;
		}
	},
}));

vi.mock("~/utils/markdown", () => ({
	convertMarkdownToHtml: vi.fn((markdown: string) => `<p>${markdown}</p>`),
}));

import { MistralOcrProvider } from "../providers/MistralOcrProvider";
import type { OcrExtractionRequest } from "../types";

describe("MistralOcrProvider", () => {
	const env = {
		AI_GATEWAY_TOKEN: "gateway-token",
		MISTRAL_API_KEY: "mistral-key",
		ASSETS_BUCKET: "test-bucket",
		PUBLIC_ASSETS_URL: "https://assets.test.com",
	} as any;

	const user = { id: 123, plan_id: "pro" } as any;

	const baseRequest: OcrExtractionRequest = {
		env,
		user,
		document: {
			type: "document_url",
			document_url: "https://example.com/doc.pdf",
			document_name: "test.pdf",
		},
	};

	const ocrResponse = {
		pages: [
			{
				markdown: "# Page 1\nThis is content from page 1",
				images: [
					{
						id: "img-1",
						image_base64: "data:image/png;base64,testdata123",
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
		mockResolveModelConfig.mockResolvedValue({
			matchingModel: "mistral-ocr-latest",
			name: "Mistral OCR",
			provider: "mistral",
			modalities: { input: ["document", "image"], output: ["text"] },
			strengths: ["ocr"],
		});
		mockResolveProviderApiKey.mockResolvedValue("resolved-key");
		mockHasUserProviderApiKey.mockResolvedValue(false);
		mockFetchAIResponse.mockResolvedValue(ocrResponse);
		mockStorageService.uploadObject.mockResolvedValue("ocr/test-uuid-123/output.md");
	});

	it("extracts text with default OCR parameters", async () => {
		const provider = new MistralOcrProvider();

		const result = await provider.extractText(baseRequest);

		expect(mockFetchAIResponse).toHaveBeenCalledWith(
			false,
			"mistral",
			"v1/ocr",
			expect.objectContaining({
				"cf-aig-authorization": "gateway-token",
				Authorization: "Bearer resolved-key",
				"Content-Type": "application/json",
			}),
			{
				model: "mistral-ocr-latest",
				document: baseRequest.document,
				id: "test-uuid-123",
				include_image_base64: true,
			},
			env,
			expect.objectContaining({
				requestTimeout: 100000,
				maxAttempts: 2,
			}),
		);
		expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
			"ocr/test-uuid-123/output.md",
			expect.stringContaining("# Page 1"),
			{
				contentType: "text/markdown",
				contentLength: expect.any(Number),
			},
		);
		expect(result).toEqual({
			model: "mistral-ocr-latest",
			key: "ocr/test-uuid-123/output.md",
			url: "https://assets.test.com/ocr/test-uuid-123/output.md",
			outputFormat: "markdown",
		});
	});

	it("passes custom request options to the OCR provider", async () => {
		const provider = new MistralOcrProvider();

		await provider.extractText({
			...baseRequest,
			id: "custom-id-456",
			pages: [0, 3],
			include_image_base64: false,
			image_limit: 10,
			image_min_size: 256,
		});

		expect(mockFetchAIResponse).toHaveBeenCalledWith(
			expect.any(Boolean),
			expect.any(String),
			expect.any(String),
			expect.any(Object),
			expect.objectContaining({
				id: "custom-id-456",
				pages: [0, 3],
				include_image_base64: false,
				image_limit: 10,
				image_min_size: 256,
			}),
			expect.any(Object),
			expect.any(Object),
		);
	});

	it("stores JSON output when requested", async () => {
		const provider = new MistralOcrProvider();
		mockStorageService.uploadObject.mockResolvedValue("ocr/test-uuid-123/output.json");

		const result = await provider.extractText({
			...baseRequest,
			output_format: "json",
		});

		expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
			"ocr/test-uuid-123/output.json",
			JSON.stringify(ocrResponse),
			{
				contentType: "application/json",
				contentLength: JSON.stringify(ocrResponse).length,
			},
		);
		expect(result.url).toBe("https://assets.test.com/ocr/test-uuid-123/output.json");
		expect(result.outputFormat).toBe("json");
	});

	it("stores HTML output when requested", async () => {
		const provider = new MistralOcrProvider();
		mockStorageService.uploadObject.mockResolvedValue("ocr/test-uuid-123/output.html");

		const result = await provider.extractText({
			...baseRequest,
			output_format: "html",
		});

		expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
			"ocr/test-uuid-123/output.html",
			expect.stringContaining("<!DOCTYPE html>"),
			{
				contentType: "text/html",
				contentLength: expect.any(Number),
			},
		);
		expect(result.outputFormat).toBe("html");
	});

	it("replaces OCR image references with base64 data", async () => {
		const provider = new MistralOcrProvider();
		mockFetchAIResponse.mockResolvedValue({
			pages: [
				{
					markdown: "![Image 1](img.1)\nSome text after image",
					images: [
						{
							id: "img.1",
							image_base64: "data:image/png;base64,testdata123",
						},
					],
				},
			],
		});

		await provider.extractText(baseRequest);

		expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("![img.1](data:image/png;base64,testdata123)"),
			expect.any(Object),
		);
	});

	it("blocks non-Pro users without a Mistral provider key", async () => {
		const provider = new MistralOcrProvider();

		await expect(
			provider.extractText({
				...baseRequest,
				user: { id: 123, plan_id: "free" } as any,
			}),
		).rejects.toMatchObject({
			message: "OCR requires a configured mistral provider key",
			type: ErrorType.AUTHORISATION_ERROR,
		});
	});

	it("allows non-Pro users with their own Mistral provider key", async () => {
		const provider = new MistralOcrProvider();
		mockHasUserProviderApiKey.mockResolvedValue(true);

		await provider.extractText({
			...baseRequest,
			user: { id: 123, plan_id: "free" } as any,
		});

		expect(mockResolveProviderApiKey).toHaveBeenCalledWith(
			expect.objectContaining({
				providerName: "mistral",
				userId: 123,
			}),
		);
	});

	it("validates document URLs and page indexes", async () => {
		const provider = new MistralOcrProvider();

		await expect(
			provider.extractText({
				...baseRequest,
				document: {
					type: "document_url",
					document_url: "file:///tmp/doc.pdf",
				},
			}),
		).rejects.toThrow("document_url must be an HTTP or HTTPS URL");

		await expect(
			provider.extractText({
				...baseRequest,
				pages: [0, 1.5],
			}),
		).rejects.toThrow("pages must contain non-negative integers");
	});

	it("requires OCR-capable model configuration", async () => {
		const provider = new MistralOcrProvider();
		mockResolveModelConfig.mockResolvedValue({
			matchingModel: "mistral-large-latest",
			name: "Mistral Large",
			provider: "mistral",
			modalities: { input: ["text"], output: ["text"] },
			strengths: ["chat"],
		});

		await expect(provider.extractText(baseRequest)).rejects.toThrow(
			"Model Mistral Large is not configured for OCR",
		);
	});

	it("wraps unexpected provider errors", async () => {
		const provider = new MistralOcrProvider();
		mockFetchAIResponse.mockRejectedValue(new Error("Network error"));

		await expect(provider.extractText(baseRequest)).rejects.toBeInstanceOf(AssistantError);
		await expect(provider.extractText(baseRequest)).rejects.toThrow(
			"Mistral OCR error: Network error",
		);
	});

	it("builds relative asset URLs when PUBLIC_ASSETS_URL is missing", async () => {
		const provider = new MistralOcrProvider();
		mockStorageService.uploadObject.mockResolvedValue("ocr/test-uuid-123/output.md");

		const result = await provider.extractText({
			...baseRequest,
			env: {
				...env,
				PUBLIC_ASSETS_URL: "",
			},
		});

		expect(result.url).toBe("/ocr/test-uuid-123/output.md");
	});
});
