import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IRequest } from "~/types";
import { handleGetMetrics } from "../getMetrics";

// @ts-expect-error - mock request
const mockRequest = {
  env: {
    ANALYTICS: "analytics-engine",
    ACCOUNT_ID: "test-account-id",
    ANALYTICS_API_KEY: "test-api-key",
  },
} as IRequest;

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("handleGetMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration validation", () => {
    it("should throw error when ANALYTICS is missing", async () => {
      const req = {
        env: {
          ACCOUNT_ID: "test-account-id",
          ANALYTICS_API_KEY: "test-api-key",
        },
      } as IRequest;

      await expect(handleGetMetrics(req, {})).rejects.toThrow(
        "Analytics configuration is incomplete: missing Analytics Engine, Account ID, or API Key",
      );
    });

    it("should throw error when ACCOUNT_ID is missing", async () => {
      // @ts-expect-error - mock request
      const req = {
        env: {
          ANALYTICS: "analytics-engine",
          ANALYTICS_API_KEY: "test-api-key",
        },
      } as IRequest;

      await expect(handleGetMetrics(req, {})).rejects.toThrow(
        "Analytics configuration is incomplete: missing Analytics Engine, Account ID, or API Key",
      );
    });

    it("should throw error when ANALYTICS_API_KEY is missing", async () => {
      // @ts-expect-error - mock request
      const req = {
        env: {
          ANALYTICS: "analytics-engine",
          ACCOUNT_ID: "test-account-id",
        },
      } as IRequest;

      await expect(handleGetMetrics(req, {})).rejects.toThrow(
        "Analytics configuration is incomplete: missing Analytics Engine, Account ID, or API Key",
      );
    });
  });

  describe("query options handling", () => {
    it("should use default query options", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              type: "chat",
              timestamp: "2024-01-01T00:00:00Z",
              value: 100,
            },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await handleGetMetrics(mockRequest, {});

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain("INTERVAL%20'1'%20MINUTE");
      expect(fetchCall[0]).toContain("INTERVAL%20'24'%20HOUR");
      expect(fetchCall[0]).toContain("LIMIT%20100");
    });

    it("should apply custom query options", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ type: "test", timestamp: "2024-01-01T00:00:00Z" }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await handleGetMetrics(mockRequest, {
        limit: 50,
        interval: "5",
        timeframe: "48",
        type: "chat",
        status: "success",
      });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain("INTERVAL%20'5'%20MINUTE");
      expect(fetchCall[0]).toContain("INTERVAL%20'48'%20HOUR");
      expect(fetchCall[0]).toContain("LIMIT%2050");
      expect(fetchCall[0]).toContain("blob1%20%3D%20'chat'");
      expect(fetchCall[0]).toContain("blob3%20%3D%20'success'");
    });

    it("should cap limit at 500", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ type: "test", timestamp: "2024-01-01T00:00:00Z" }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await handleGetMetrics(mockRequest, { limit: 1000 });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain("LIMIT%20500");
    });
  });

  describe("API integration", () => {
    it("should make correct API call", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ type: "test", timestamp: "2024-01-01T00:00:00Z" }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await handleGetMetrics(mockRequest, {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://api.cloudflare.com/client/v4/accounts/test-account-id/analytics_engine/sql",
        ),
        {
          method: "GET",
          headers: {
            Authorization: "Bearer test-api-key",
          },
        },
      );
    });

    it("should handle API error response", async () => {
      const mockResponse = {
        ok: false,
        text: vi.fn().mockResolvedValue("API Error"),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(handleGetMetrics(mockRequest, {})).rejects.toThrow(
        "Failed to fetch metrics from Analytics Engine",
      );
    });

    it("should handle missing data in response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(handleGetMetrics(mockRequest, {})).rejects.toThrow(
        "No metrics found in Analytics Engine",
      );
    });
  });

  describe("data processing", () => {
    it("should process metrics data correctly", async () => {
      const mockTimestamp = "2024-01-01T00:00:00Z";
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              type: "chat",
              name: "completion",
              status: "success",
              timestamp: mockTimestamp,
              value: 100,
            },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await handleGetMetrics(mockRequest, {});

      expect(result).toEqual([
        {
          type: "chat",
          name: "completion",
          status: "success",
          timestamp: mockTimestamp,
          value: 100,
          minutesAgo: expect.any(Number),
        },
      ]);
    });

    it("should calculate minutesAgo correctly", async () => {
      const pastTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              type: "test",
              timestamp: pastTimestamp,
            },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await handleGetMetrics(mockRequest, {});

      expect(result[0].minutesAgo).toBeGreaterThanOrEqual(4);
      expect(result[0].minutesAgo).toBeLessThanOrEqual(6);
    });
  });
});
