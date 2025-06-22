import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertToMarkdownViaCloudflare } from "../documentConverter";

global.fetch = vi.fn();

const mockEnv = {
  AI: {
    toMarkdown: vi.fn(),
  },
} as any;

describe("convertToMarkdownViaCloudflare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should convert document to markdown successfully", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";
    const mockDocumentName = "test-document";
    const mockMarkdownResult = "# Test Document\n\nContent here";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);

    mockEnv.AI.toMarkdown.mockResolvedValue([
      {
        name: mockDocumentName,
        mimeType: "application/pdf",
        tokens: 100,
        data: mockMarkdownResult,
      },
    ]);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
      mockDocumentName,
    );

    expect(result).toEqual({ result: mockMarkdownResult });
    expect(global.fetch).toHaveBeenCalledWith(mockDocumentUrl);
    expect(mockEnv.AI.toMarkdown).toHaveBeenCalledWith([
      {
        name: mockDocumentName,
        blob: expect.any(Blob),
      },
    ]);
  });

  it("should use default document name when not provided", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";
    const mockMarkdownResult = "# Document\n\nContent";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);

    mockEnv.AI.toMarkdown.mockResolvedValue([
      {
        name: "document",
        mimeType: "application/pdf",
        tokens: 50,
        data: mockMarkdownResult,
      },
    ]);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({ result: mockMarkdownResult });
    expect(mockEnv.AI.toMarkdown).toHaveBeenCalledWith([
      {
        name: "document",
        blob: expect.any(Blob),
      },
    ]);
  });

  it("should return error when AI binding not available", async () => {
    const envWithoutAI = {} as any;
    const mockDocumentUrl = "https://example.com/document.pdf";

    const result = await convertToMarkdownViaCloudflare(
      envWithoutAI,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Cloudflare AI binding not available",
    });
  });

  it("should return error when document download fails", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    const mockFileResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Failed to download document: Not Found",
    });
  });

  it("should return error when toMarkdown API returns invalid response", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);
    mockEnv.AI.toMarkdown.mockResolvedValue([]);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Invalid response from Cloudflare toMarkdown API",
    });
  });

  it("should return error when toMarkdown API returns non-array", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);
    mockEnv.AI.toMarkdown.mockResolvedValue(null);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Invalid response from Cloudflare toMarkdown API",
    });
  });

  it("should return error when toMarkdown API throws", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["test content"])),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);
    mockEnv.AI.toMarkdown.mockRejectedValue(new Error("AI API error"));

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Cloudflare toMarkdown API error: AI API error",
    });
  });

  it("should handle fetch errors", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Network error",
    });
  });

  it("should handle blob conversion errors", async () => {
    const mockDocumentUrl = "https://example.com/document.pdf";

    const mockFileResponse = {
      ok: true,
      blob: vi.fn().mockRejectedValue(new Error("Blob error")),
    };

    (global.fetch as any).mockResolvedValue(mockFileResponse);

    const result = await convertToMarkdownViaCloudflare(
      mockEnv,
      mockDocumentUrl,
    );

    expect(result).toEqual({
      error: "Blob error",
    });
  });
});
