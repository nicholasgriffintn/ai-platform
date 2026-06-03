import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { handleFileUpload } from "../index";

const mockStorageService = {
	uploadObject: vi.fn(),
	storePrivateAsset: vi.fn(),
};

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

vi.mock("~/lib/documentConverter", () => ({
	convertBlobToMarkdownViaCloudflare: vi.fn(),
}));

const mockUUID = "test-uuid-123";
vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue(mockUUID) });

const mockEnv: IEnv = {
	ASSETS_BUCKET: "test-bucket",
	PRIVATE_ASSETS_BUCKET: "private-test-bucket",
	API_BASE_URL: "https://api.example.com",
	PUBLIC_ASSETS_URL: "https://assets.example.com",
	DB: {},
} as IEnv;

describe("handleFileUpload", () => {
	let mockConvertBlobToMarkdownViaCloudflare: any;
	const mockStoredAssets = {
		createAsset: vi.fn(),
	};
	const mockContext = createServiceContext({ env: mockEnv });

	beforeEach(async () => {
		vi.clearAllMocks();
		mockStoredAssets.createAsset.mockResolvedValue({ id: mockUUID });
		mockContext.repositories.storedAssets.createAsset = mockStoredAssets.createAsset;
		mockStorageService.storePrivateAsset.mockImplementation(async (request) => {
			await mockStorageService.uploadObject(request.key, request.data, {
				contentType: request.mimeType,
			});
			await mockStoredAssets.createAsset({
				id: mockUUID,
				key: request.key,
				ownerUserId: request.ownerUserId,
				purpose: request.purpose,
				mimeType: request.mimeType,
				filename: request.filename,
				byteSize: request.byteSize,
			});
			return {
				assetId: mockUUID,
				key: request.key,
				url: mockContext.env.API_BASE_URL
					? `${mockContext.env.API_BASE_URL}/assets/${mockUUID}`
					: `/assets/${mockUUID}`,
			};
		});
		const converterModule = await import("~/lib/documentConverter");
		mockConvertBlobToMarkdownViaCloudflare = vi.mocked(
			converterModule.convertBlobToMarkdownViaCloudflare,
		);
	});

	describe("parameter validation", () => {
		it("should throw error if no file provided", async () => {
			const formData = new FormData();
			formData.append("file_type", "image");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow("No file uploaded");
		});

		it("should throw error if no file_type provided", async () => {
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type. Must be 'image', 'document', 'audio', or 'code'",
			);
		});

		it("should throw error for invalid file_type", async () => {
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "invalid");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type. Must be 'image', 'document', 'audio', or 'code'",
			);
		});
	});

	describe("file type validation", () => {
		it("should accept valid image types", async () => {
			const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

			for (const mimeType of validImageTypes) {
				const file = new File(["test"], "test.jpg", { type: mimeType });
				const formData = new FormData();
				formData.append("file", file);
				formData.append("file_type", "image");

				mockStorageService.uploadObject.mockResolvedValue("test-key");

				const result = await handleFileUpload(mockContext, 1, formData);

				expect(result.type).toBe("image");
				vi.clearAllMocks();
			}
		});

		it("should accept valid document types", async () => {
			const validDocTypes = ["application/pdf", "text/html", "application/xml", "text/csv"];

			for (const mimeType of validDocTypes) {
				const file = new File(["test"], "test.pdf", { type: mimeType });
				const formData = new FormData();
				formData.append("file", file);
				formData.append("file_type", "document");

				mockStorageService.uploadObject.mockResolvedValue("test-key");
				mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
					result: null,
					error: null,
				});

				const result = await handleFileUpload(mockContext, 1, formData);

				expect(result.type).toBe("document");
				vi.clearAllMocks();
			}
		});

		it("should accept valid audio types", async () => {
			const validAudioTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/mp4"];

			for (const mimeType of validAudioTypes) {
				const file = new File(["test"], "test.mp3", { type: mimeType });
				const formData = new FormData();
				formData.append("file", file);
				formData.append("file_type", "audio");

				mockStorageService.uploadObject.mockResolvedValue("test-key");

				const result = await handleFileUpload(mockContext, 1, formData);

				expect(result.type).toBe("audio");
				vi.clearAllMocks();
			}
		});

		it("should accept valid code types", async () => {
			const validCodeTypes = [
				{ mime: "text/typescript", name: "example.ts" },
				{ mime: "application/typescript", name: "example.tsx" },
				{ mime: "text/javascript", name: "example.js" },
				{ mime: "application/javascript", name: "example.jsx" },
				{ mime: "text/plain", name: "example.py" },
				{ mime: "application/json", name: "package.json" },
			];

			for (const { mime, name } of validCodeTypes) {
				const file = new File(["console.log('hello')"], name, { type: mime });
				const formData = new FormData();
				formData.append("file", file);
				formData.append("file_type", "code");

				mockStorageService.uploadObject.mockResolvedValue("test-key");

				const result = await handleFileUpload(mockContext, 1, formData);

				expect(["code", "markdown_document"]).toContain(result.type);
				vi.clearAllMocks();
			}
		});

		it("should reject invalid image types", async () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type text/plain. Allowed types for image:",
			);
		});

		it("should reject invalid document types", async () => {
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type image/jpeg. Allowed types for document:",
			);
		});

		it("should reject invalid audio types", async () => {
			const file = new File(["test"], "test.txt", { type: "text/plain" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "audio");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type text/plain. Allowed types for audio:",
			);
		});

		it("should enforce code size limit", async () => {
			const largeContent = "x".repeat(201 * 1024); // 201KB
			const file = new File([largeContent], "big.ts", {
				type: "text/typescript",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "code");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Code files must be 200KB or smaller",
			);
		});
	});

	describe("file processing", () => {
		it("should upload image file successfully", async () => {
			const file = new File(["test content"], "test.jpg", {
				type: "image/jpeg",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				`uploads/1/images/${mockUUID}.jpeg`,
				expect.any(ArrayBuffer),
				{ contentType: "image/jpeg" },
			);

			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/images/${mockUUID}.jpeg`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "image",
				name: "test.jpg",
			});
		});

		it("should upload document without markdown conversion", async () => {
			const file = new File(["test content"], "test.pdf", {
				type: "application/pdf",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				`uploads/1/documents/${mockUUID}.pdf`,
				expect.any(ArrayBuffer),
				{ contentType: "application/pdf" },
			);

			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/documents/${mockUUID}.pdf`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "document",
				name: "test.pdf",
			});

			expect(mockConvertBlobToMarkdownViaCloudflare).not.toHaveBeenCalled();
		});

		it("should convert non-PDF documents to markdown", async () => {
			const file = new File(["test content"], "test.html", {
				type: "text/html",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
				result: "# Converted Markdown",
				error: null,
			});

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockConvertBlobToMarkdownViaCloudflare).toHaveBeenCalledWith(
				mockEnv,
				file,
				"test.html",
				{
					html: {
						hostname: "api.example.com",
					},
				},
			);

			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/documents/${mockUUID}.html`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "markdown_document",
				name: "test.html",
				markdown: "# Converted Markdown",
			});
		});

		it("should convert PDF to markdown when explicitly requested", async () => {
			const file = new File(["test content"], "test.pdf", {
				type: "application/pdf",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");
			formData.append("convert_to_markdown", "true");

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
				result: "# PDF Converted",
				error: null,
			});

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockConvertBlobToMarkdownViaCloudflare).toHaveBeenCalledWith(
				mockEnv,
				file,
				"test.pdf",
				{
					pdf: {
						metadata: false,
					},
				},
			);
			expect(result.type).toBe("markdown_document");
			expect(result.markdown).toBe("# PDF Converted");
		});

		it("should convert images to markdown when explicitly requested", async () => {
			const file = new File(["image"], "diagram.png", {
				type: "image/png",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");
			formData.append("convert_to_markdown", "true");
			formData.append(
				"conversion_options",
				JSON.stringify({
					image: {
						descriptionLanguage: "fr",
					},
				}),
			);

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
				result: "![description](diagram)",
				error: null,
			});

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockConvertBlobToMarkdownViaCloudflare).toHaveBeenCalledWith(
				mockEnv,
				file,
				"diagram.png",
				{
					image: {
						descriptionLanguage: "fr",
					},
				},
			);
			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/images/${mockUUID}.png`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "markdown_document",
				name: "diagram.png",
				markdown: "![description](diagram)",
			});
		});

		it("should merge explicit HTML conversion options with platform defaults", async () => {
			const file = new File(["<article>test</article>"], "article.html", {
				type: "text/html",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");
			formData.append(
				"conversion_options",
				JSON.stringify({
					html: {
						cssSelector: "article.content",
					},
				}),
			);

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
				result: "# Article",
				error: null,
			});

			await handleFileUpload(mockContext, 1, formData);

			expect(mockConvertBlobToMarkdownViaCloudflare).toHaveBeenCalledWith(
				mockEnv,
				file,
				"article.html",
				{
					html: {
						cssSelector: "article.content",
						hostname: "api.example.com",
					},
				},
			);
		});

		it("should upload audio file successfully", async () => {
			const file = new File(["test audio content"], "test.mp3", {
				type: "audio/mpeg",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "audio");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				`uploads/1/audios/${mockUUID}.mpeg`,
				expect.any(ArrayBuffer),
				{ contentType: "audio/mpeg" },
			);

			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/audios/${mockUUID}.mpeg`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "audio",
				name: "test.mp3",
			});

			expect(mockConvertBlobToMarkdownViaCloudflare).not.toHaveBeenCalled();
		});

		it("should upload WAV audio file successfully", async () => {
			const file = new File(["test audio content"], "test.wav", {
				type: "audio/wav",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "audio");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
				`uploads/1/audios/${mockUUID}.wav`,
				expect.any(ArrayBuffer),
				{ contentType: "audio/wav" },
			);

			expect(result).toEqual({
				assetId: mockUUID,
				key: `uploads/1/audios/${mockUUID}.wav`,
				url: `https://api.example.com/assets/${mockUUID}`,
				type: "audio",
				name: "test.wav",
			});
		});

		it("should wrap code files in markdown fences with language", async () => {
			const file = new File(["const x: number = 1;"], "example.ts", {
				type: "text/typescript",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "code");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.type).toBe("markdown_document");
			expect(result.markdown).toContain("```typescript");
			expect(result.markdown).toContain("const x: number = 1;");
		});

		it("should handle text/plain code files by extension and wrap appropriately", async () => {
			const file = new File(["print('hi')"], "script.py", {
				type: "text/plain",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "code");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.type).toBe("markdown_document");
			expect(result.markdown).toContain("```python");
			expect(result.markdown).toContain("print('hi')");
		});

		it("should accept application/octet-stream for code with known extension and wrap", async () => {
			const file = new File(["console.log('ok')"], "app.js", {
				type: "application/octet-stream",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "code");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.type).toBe("markdown_document");
			expect(result.markdown).toContain("```javascript");
			expect(result.markdown).toContain("console.log('ok')");
		});

		it("should reject application/octet-stream for code with unknown extension", async () => {
			const file = new File(["some content"], "file.unknownext", {
				type: "application/octet-stream",
			});
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "code");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Invalid file type application/octet-stream",
			);
		});
	});

	describe("error handling", () => {
		it("should handle file buffer conversion errors", async () => {
			class MockFile {
				type = "image/jpeg";
				name = "test.jpg";
				arrayBuffer = vi.fn().mockRejectedValue(new Error("Buffer error"));
			}

			const mockFile = () => new MockFile();

			const formData = new FormData();
			formData.set = vi.fn();
			formData.get = vi.fn().mockImplementation((key) => {
				if (key === "file") return mockFile();
				if (key === "file_type") return "image";
				return null;
			});

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Failed to process file data",
			);
		});

		it("should handle storage upload errors", async () => {
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");

			mockStorageService.uploadObject.mockRejectedValue(new Error("Storage error"));

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"Failed to store file",
			);
		});

		it("should reject invalid conversion options JSON", async () => {
			const file = new File(["test"], "test.html", { type: "text/html" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");
			formData.append("conversion_options", "{not-json");

			await expect(handleFileUpload(mockContext, 1, formData)).rejects.toThrow(
				"conversion_options must be valid JSON",
			);
		});

		it("should handle markdown conversion errors gracefully", async () => {
			const file = new File(["test"], "test.html", { type: "text/html" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockRejectedValue(new Error("Conversion error"));

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.type).toBe("document");
			expect(result.markdown).toBeUndefined();
		});

		it("should handle markdown conversion with error response", async () => {
			const file = new File(["test"], "test.html", { type: "text/html" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "document");

			mockStorageService.uploadObject.mockResolvedValue("test-key");
			mockConvertBlobToMarkdownViaCloudflare.mockResolvedValue({
				result: null,
				error: "Conversion failed",
			});

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.type).toBe("document");
			expect(result.markdown).toBeUndefined();
		});
	});

	describe("URL generation", () => {
		it("should use API asset URLs for file URLs", async () => {
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(mockContext, 1, formData);

			expect(result.url).toBe(`https://api.example.com/assets/${mockUUID}`);
		});

		it("should handle missing API_BASE_URL", async () => {
			const envWithoutApiBaseUrl = { ...mockEnv, API_BASE_URL: undefined };
			const contextWithoutApiBaseUrl = createServiceContext({ env: envWithoutApiBaseUrl });
			contextWithoutApiBaseUrl.repositories.storedAssets.createAsset = mockStoredAssets.createAsset;
			mockStorageService.storePrivateAsset.mockImplementationOnce(async (request) => {
				await mockStorageService.uploadObject(request.key, request.data, {
					contentType: request.mimeType,
				});
				await mockStoredAssets.createAsset({
					id: mockUUID,
					key: request.key,
					ownerUserId: request.ownerUserId,
					purpose: request.purpose,
					mimeType: request.mimeType,
					filename: request.filename,
					byteSize: request.byteSize,
				});
				return {
					assetId: mockUUID,
					key: request.key,
					url: "/assets/test-uuid-123",
				};
			});
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
			const formData = new FormData();
			formData.append("file", file);
			formData.append("file_type", "image");

			mockStorageService.uploadObject.mockResolvedValue("test-key");

			const result = await handleFileUpload(contextWithoutApiBaseUrl, 1, formData);

			expect(result.url).toBe(`/assets/${mockUUID}`);
		});
	});
});
