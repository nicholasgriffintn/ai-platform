import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockStorageService = vi.hoisted(() => ({
  uploadObject: vi.fn(),
}));

const mockGenerateId = vi.hoisted(() => vi.fn(() => "generated-id-123"));

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("~/lib/storage", () => ({
  StorageService: vi.fn(() => mockStorageService),
}));

vi.mock("~/utils/id", () => ({
  generateId: mockGenerateId,
}));

Object.defineProperty(global, "fetch", {
  value: mockFetch,
});

import { captureScreenshot } from "../screenshot";
import type { CaptureScreenshotParams } from "../screenshot";

describe("captureScreenshot", () => {
  const mockRequest: IRequest = {
    env: {
      ACCOUNT_ID: "test-account-id",
      BROWSER_RENDERING_API_KEY: "test-api-key",
      ASSETS_BUCKET: "test-bucket",
      PUBLIC_ASSETS_URL: "https://assets.test.com",
    },
    user: { id: "user-123" },
  } as any;

  const mockImageBuffer = new ArrayBuffer(1024);
  const mockFetchResponse = {
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(mockImageBuffer),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(mockFetchResponse);
    mockStorageService.uploadObject.mockResolvedValue(undefined);
    mockGenerateId.mockReturnValue("generated-id-123");
  });

  describe("parameter validation", () => {
    it("should throw error when ACCOUNT_ID is missing", async () => {
      const reqWithoutAccountId = {
        ...mockRequest,
        env: { ...mockRequest.env, ACCOUNT_ID: "" },
      };

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, reqWithoutAccountId);

      expect(result.status).toBe("error");
      expect(result.error).toBe("Cloudflare Account ID not configured");
    });

    it("should throw error when BROWSER_RENDERING_API_KEY is missing", async () => {
      const reqWithoutApiKey = {
        ...mockRequest,
        env: { ...mockRequest.env, BROWSER_RENDERING_API_KEY: "" },
      };

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, reqWithoutApiKey);

      expect(result.status).toBe("error");
      expect(result.error).toBe("Browser Rendering API Key not configured");
    });

    it("should throw error when neither URL nor HTML is provided", async () => {
      const params: CaptureScreenshotParams = {};

      const result = await captureScreenshot(params, mockRequest);

      expect(result.status).toBe("error");
      expect(result.error).toBe("Either URL or HTML must be provided");
    });
  });

  describe("successful screenshot capture", () => {
    it("should capture screenshot with URL", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/accounts/test-account-id/browser-rendering/screenshot",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
          body: JSON.stringify({
            url: "https://example.com",
          }),
        },
      );

      expect(result.status).toBe("success");
      expect(result.data?.url).toBe("https://example.com");
      expect(result.data?.screenshotUrl).toContain(
        "https://assets.test.com/screenshots/",
      );
      expect(result.data?.key).toContain("screenshots/");
    });

    it("should capture screenshot with HTML", async () => {
      const params: CaptureScreenshotParams = {
        html: "<html><body><h1>Test Page</h1></body></html>",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            html: "<html><body><h1>Test Page</h1></body></html>",
          }),
        }),
      );

      expect(result.status).toBe("success");
      expect(result.data?.url).toBeUndefined();
      expect(result.data?.screenshotUrl).toContain(
        "https://assets.test.com/screenshots/",
      );
    });

    it("should handle screenshot options", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        screenshotOptions: {
          omitBackground: true,
          fullPage: false,
        },
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            screenshotOptions: {
              omitBackground: true,
              fullPage: false,
            },
          }),
        }),
      );
    });

    it("should handle viewport options", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        viewport: {
          width: 1920,
          height: 1080,
        },
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            viewport: {
              width: 1920,
              height: 1080,
            },
          }),
        }),
      );
    });

    it("should handle goto options", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        gotoOptions: {
          waitUntil: "networkidle0",
          timeout: 30000,
        },
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            gotoOptions: {
              waitUntil: "networkidle0",
              timeout: 30000,
            },
          }),
        }),
      );
    });

    it("should handle script tags", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        addScriptTag: [
          { url: "https://cdn.example.com/script.js" },
          { content: "console.log('test');" },
        ],
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            addScriptTag: [
              { url: "https://cdn.example.com/script.js" },
              { content: "console.log('test');" },
            ],
          }),
        }),
      );
    });

    it("should handle style tags", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        addStyleTag: [
          { url: "https://cdn.example.com/style.css" },
          { content: "body { background: red; }" },
        ],
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            addStyleTag: [
              { url: "https://cdn.example.com/style.css" },
              { content: "body { background: red; }" },
            ],
          }),
        }),
      );
    });

    it("should skip empty script and style arrays", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        addScriptTag: [],
        addStyleTag: [],
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
          }),
        }),
      );
    });
  });

  describe("storage operations", () => {
    it("should upload screenshot to storage with correct parameters", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com/page",
      };

      await captureScreenshot(params, mockRequest);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(
          /screenshots\/https___example_com_page\/\d{8}T\d{6}\.\d{3}\/generated-id-123\.png/,
        ),
        mockImageBuffer,
        {
          contentType: "image/png",
          contentLength: mockImageBuffer.byteLength,
        },
      );
    });

    it("should generate proper key for URL with special characters", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com/path?param=value&other=test#section",
      };

      await captureScreenshot(params, mockRequest);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(
          /screenshots\/https___example_com_path_param_value_other_test_section\//,
        ),
        expect.any(ArrayBuffer),
        expect.any(Object),
      );
    });

    it("should handle unknown URL case", async () => {
      const params: CaptureScreenshotParams = {
        html: "<html><body>Test</body></html>",
      };

      await captureScreenshot(params, mockRequest);

      expect(mockStorageService.uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(/screenshots\/unknown\//),
        expect.any(ArrayBuffer),
        expect.any(Object),
      );
    });
  });

  describe("error handling", () => {
    it("should handle API error response", async () => {
      const errorResponse = {
        ok: false,
        text: vi.fn().mockResolvedValue("API Error: Rate limit exceeded"),
      };
      mockFetch.mockResolvedValue(errorResponse);

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(result.status).toBe("error");
      expect(result.error).toBe(
        "Error capturing screenshot: API Error: Rate limit exceeded",
      );
    });

    it("should handle fetch network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(result.status).toBe("error");
      expect(result.error).toBe(
        "Error capturing screenshot: Error: Network error",
      );
    });

    it("should handle AssistantError properly", async () => {
      mockFetch.mockResolvedValue(mockFetchResponse);
      mockStorageService.uploadObject.mockRejectedValue(
        new AssistantError("Storage error", ErrorType.STORAGE_ERROR),
      );

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(result.status).toBe("error");
      expect(result.error).toBe("Storage error");
    });

    it("should handle storage upload errors", async () => {
      mockFetch.mockResolvedValue(mockFetchResponse);
      mockStorageService.uploadObject.mockRejectedValue(
        new Error("Upload failed"),
      );

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(result.status).toBe("error");
      expect(result.error).toBe(
        "Error capturing screenshot: Error: Upload failed",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle missing PUBLIC_ASSETS_URL", async () => {
      const reqWithoutAssetsUrl = {
        ...mockRequest,
        env: { ...mockRequest.env, PUBLIC_ASSETS_URL: "" },
      };

      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, reqWithoutAssetsUrl);

      expect(result.status).toBe("success");
      expect(result.data?.screenshotUrl).toMatch(/^\/screenshots\//);
    });

    it("should handle both URL and HTML provided", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
        html: "<html><body>Override</body></html>",
      };

      await captureScreenshot(params, mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://example.com",
            html: "<html><body>Override</body></html>",
          }),
        }),
      );
    });

    it("should generate unique screenshot keys", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result1 = await captureScreenshot(params, mockRequest);

      mockGenerateId.mockReturnValue("different-id-456");
      const result2 = await captureScreenshot(params, mockRequest);

      expect(result1.data?.key).not.toBe(result2.data?.key);
    });
  });

  describe("response format", () => {
    it("should return correct success response structure", async () => {
      const params: CaptureScreenshotParams = {
        url: "https://example.com",
      };

      const result = await captureScreenshot(params, mockRequest);

      expect(result).toMatchObject({
        status: "success",
        data: {
          url: "https://example.com",
          screenshotUrl: expect.stringContaining("screenshots/"),
          key: expect.stringContaining("screenshots/"),
        },
      });
    });

    it("should return correct error response structure", async () => {
      const params: CaptureScreenshotParams = {};

      const result = await captureScreenshot(params, mockRequest);

      expect(result).toMatchObject({
        status: "error",
        error: expect.any(String),
      });
      expect(result.data).toBeUndefined();
    });
  });
});
