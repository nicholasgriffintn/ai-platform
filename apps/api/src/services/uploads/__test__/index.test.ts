import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import { handleFileUpload } from "../index";

const mockStorageService = {
  uploadObject: vi.fn(),
};

vi.mock("~/lib/storage", () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorageService),
}));

vi.mock("~/lib/documentConverter", () => ({
  convertToMarkdownViaCloudflare: vi.fn(),
}));

const mockUUID = "test-uuid-123";
vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue(mockUUID) });

const mockEnv: IEnv = {
  ASSETS_BUCKET: "test-bucket",
  PUBLIC_ASSETS_URL: "https://assets.example.com",
} as IEnv;

describe("handleFileUpload", () => {
  let mockConvertToMarkdownViaCloudflare: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const converterModule = await import("~/lib/documentConverter");
    mockConvertToMarkdownViaCloudflare = vi.mocked(
      converterModule.convertToMarkdownViaCloudflare,
    );
  });

  describe("parameter validation", () => {
    it("should throw error if no file provided", async () => {
      const formData = new FormData();
      formData.append("file_type", "image");

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "No file uploaded",
      );
    });

    it("should throw error if no file_type provided", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Invalid file type. Must be 'image', 'document', 'audio', or 'code'",
      );
    });

    it("should throw error for invalid file_type", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "invalid");

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Invalid file type. Must be 'image', 'document', 'audio', or 'code'",
      );
    });
  });

  describe("file type validation", () => {
    it("should accept valid image types", async () => {
      const validImageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      for (const mimeType of validImageTypes) {
        const file = new File(["test"], "test.jpg", { type: mimeType });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("file_type", "image");

        mockStorageService.uploadObject.mockResolvedValue("test-key");

        const result = await handleFileUpload(mockEnv, 1, formData);

        expect(result.type).toBe("image");
        vi.clearAllMocks();
      }
    });

    it("should accept valid document types", async () => {
      const validDocTypes = [
        "application/pdf",
        "text/html",
        "application/xml",
        "text/csv",
      ];

      for (const mimeType of validDocTypes) {
        const file = new File(["test"], "test.pdf", { type: mimeType });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("file_type", "document");

        mockStorageService.uploadObject.mockResolvedValue("test-key");

        const result = await handleFileUpload(mockEnv, 1, formData);

        expect(result.type).toBe("document");
        vi.clearAllMocks();
      }
    });

    it("should accept valid audio types", async () => {
      const validAudioTypes = [
        "audio/mpeg",
        "audio/wav",
        "audio/mp3",
        "audio/x-wav",
        "audio/mp4",
      ];

      for (const mimeType of validAudioTypes) {
        const file = new File(["test"], "test.mp3", { type: mimeType });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("file_type", "audio");

        mockStorageService.uploadObject.mockResolvedValue("test-key");

        const result = await handleFileUpload(mockEnv, 1, formData);

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

        const result = await handleFileUpload(mockEnv, 1, formData);

        expect(["code", "markdown_document"]).toContain(result.type);
        vi.clearAllMocks();
      }
    });

    it("should reject invalid image types", async () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "image");

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Invalid file type text/plain. Allowed types for image:",
      );
    });

    it("should reject invalid document types", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "document");

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Invalid file type image/jpeg. Allowed types for document:",
      );
    });

    it("should reject invalid audio types", async () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "audio");

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
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

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
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

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        `uploads/1/images/${mockUUID}.jpeg`,
        expect.any(ArrayBuffer),
        { contentType: "image/jpeg" },
      );

      expect(result).toEqual({
        url: `https://assets.example.com/uploads/1/images/${mockUUID}.jpeg`,
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

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        `uploads/1/documents/${mockUUID}.pdf`,
        expect.any(ArrayBuffer),
        { contentType: "application/pdf" },
      );

      expect(result).toEqual({
        url: `https://assets.example.com/uploads/1/documents/${mockUUID}.pdf`,
        type: "document",
        name: "test.pdf",
      });

      expect(mockConvertToMarkdownViaCloudflare).not.toHaveBeenCalled();
    });

    it("should convert non-PDF documents to markdown", async () => {
      const file = new File(["test content"], "test.html", {
        type: "text/html",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "document");

      mockStorageService.uploadObject.mockResolvedValue("test-key");
      mockConvertToMarkdownViaCloudflare.mockResolvedValue({
        result: "# Converted Markdown",
        error: null,
      });

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockConvertToMarkdownViaCloudflare).toHaveBeenCalledWith(
        mockEnv,
        `https://assets.example.com/uploads/1/documents/${mockUUID}.html`,
        "test.html",
      );

      expect(result).toEqual({
        url: `https://assets.example.com/uploads/1/documents/${mockUUID}.html`,
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
      mockConvertToMarkdownViaCloudflare.mockResolvedValue({
        result: "# PDF Converted",
        error: null,
      });

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockConvertToMarkdownViaCloudflare).toHaveBeenCalled();
      expect(result.type).toBe("markdown_document");
      expect(result.markdown).toBe("# PDF Converted");
    });

    it("should upload audio file successfully", async () => {
      const file = new File(["test audio content"], "test.mp3", {
        type: "audio/mpeg",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "audio");

      mockStorageService.uploadObject.mockResolvedValue("test-key");

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        `uploads/1/audios/${mockUUID}.mpeg`,
        expect.any(ArrayBuffer),
        { contentType: "audio/mpeg" },
      );

      expect(result).toEqual({
        url: `https://assets.example.com/uploads/1/audios/${mockUUID}.mpeg`,
        type: "audio",
        name: "test.mp3",
      });

      expect(mockConvertToMarkdownViaCloudflare).not.toHaveBeenCalled();
    });

    it("should upload WAV audio file successfully", async () => {
      const file = new File(["test audio content"], "test.wav", {
        type: "audio/wav",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "audio");

      mockStorageService.uploadObject.mockResolvedValue("test-key");

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        `uploads/1/audios/${mockUUID}.wav`,
        expect.any(ArrayBuffer),
        { contentType: "audio/wav" },
      );

      expect(result).toEqual({
        url: `https://assets.example.com/uploads/1/audios/${mockUUID}.wav`,
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

      const result = await handleFileUpload(mockEnv, 1, formData);

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

      const result = await handleFileUpload(mockEnv, 1, formData);

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

      const result = await handleFileUpload(mockEnv, 1, formData);

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

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Invalid file type application/octet-stream",
      );
    });
  });

  describe("error handling", () => {
    it("should handle file buffer conversion errors", async () => {
      const mockFile = vi.fn().mockImplementation(() => ({
        type: "image/jpeg",
        name: "test.jpg",
        arrayBuffer: vi.fn().mockRejectedValue(new Error("Buffer error")),
      }));

      const formData = new FormData();
      formData.set = vi.fn();
      formData.get = vi.fn().mockImplementation((key) => {
        if (key === "file") return new mockFile();
        if (key === "file_type") return "image";
        return null;
      });

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Failed to process file data",
      );
    });

    it("should handle storage upload errors", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "image");

      mockStorageService.uploadObject.mockRejectedValue(
        new Error("Storage error"),
      );

      await expect(handleFileUpload(mockEnv, 1, formData)).rejects.toThrow(
        "Failed to store file",
      );
    });

    it("should handle markdown conversion errors gracefully", async () => {
      const file = new File(["test"], "test.html", { type: "text/html" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "document");

      mockStorageService.uploadObject.mockResolvedValue("test-key");
      mockConvertToMarkdownViaCloudflare.mockRejectedValue(
        new Error("Conversion error"),
      );

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(result.type).toBe("document");
      expect(result.markdown).toBeUndefined();
    });

    it("should handle markdown conversion with error response", async () => {
      const file = new File(["test"], "test.html", { type: "text/html" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "document");

      mockStorageService.uploadObject.mockResolvedValue("test-key");
      mockConvertToMarkdownViaCloudflare.mockResolvedValue({
        result: null,
        error: "Conversion failed",
      });

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(result.type).toBe("document");
      expect(result.markdown).toBeUndefined();
    });
  });

  describe("URL generation", () => {
    it("should use PUBLIC_ASSETS_URL for file URLs", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "image");

      mockStorageService.uploadObject.mockResolvedValue("test-key");

      const result = await handleFileUpload(mockEnv, 1, formData);

      expect(result.url).toContain(
        "https://assets.example.com/uploads/1/images/",
      );
    });

    it("should handle missing PUBLIC_ASSETS_URL", async () => {
      const envWithoutUrl = { ...mockEnv, PUBLIC_ASSETS_URL: undefined };
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", "image");

      mockStorageService.uploadObject.mockResolvedValue("test-key");

      const result = await handleFileUpload(envWithoutUrl, 1, formData);

      expect(result.url).toMatch(/^\/uploads\/1\/images\//);
    });
  });
});
