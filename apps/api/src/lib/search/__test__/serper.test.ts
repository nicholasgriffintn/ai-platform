import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, SearchOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { SerperProvider } from "../serper";

global.fetch = vi.fn();

describe("SerperProvider", () => {
  const mockEnv: IEnv = {
    SERPER_API_KEY: "test-serper-key",
  } as IEnv;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with valid API key", () => {
      expect(() => new SerperProvider(mockEnv)).not.toThrow();
    });

    it("should throw error when API key is missing", () => {
      const envWithoutKey = { ...mockEnv, SERPER_API_KEY: undefined } as IEnv;

      expect(() => new SerperProvider(envWithoutKey)).toThrow(AssistantError);
      expect(() => new SerperProvider(envWithoutKey)).toThrow(
        "SERPER_API_KEY is not set",
      );
    });

    it("should throw error with correct error type when API key is missing", () => {
      const envWithoutKey = { ...mockEnv, SERPER_API_KEY: undefined } as IEnv;

      try {
        new SerperProvider(envWithoutKey);
      } catch (error) {
        expect(error).toBeInstanceOf(AssistantError);
        expect((error as AssistantError).type).toBe(
          ErrorType.CONFIGURATION_ERROR,
        );
      }
    });
  });

  describe("performWebSearch", () => {
    let provider: SerperProvider;

    beforeEach(() => {
      provider = new SerperProvider(mockEnv);
    });

    it("should perform successful search with default options", async () => {
      const mockResponse = {
        searchParameters: { q: "test query" },
        organic: [
          {
            title: "Test Result",
            link: "https://example.com",
            snippet: "Test snippet",
            position: 1,
          },
        ],
        peopleAlsoAsk: [],
        relatedSearches: { query: "related query" },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await provider.performWebSearch("test query");

      expect(fetch).toHaveBeenCalledWith("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": "test-serper-key",
        },
        body: JSON.stringify({
          q: "test query",
          gl: "gb",
          location: undefined,
          hl: "en",
          tbs: undefined,
          autocorrect: true,
          num: 10,
          page: 1,
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it("should perform search with custom options", async () => {
      const mockResponse = {
        searchParameters: { q: "test query" },
        organic: [],
        peopleAlsoAsk: [],
        relatedSearches: { query: "related query" },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const options: SearchOptions = {
        country: "us",
        location: "New York",
        language: "es",
        timePeriod: "d",
        autocorrect: false,
        num: 20,
        page: 2,
      };

      await provider.performWebSearch("test query", options);

      expect(fetch).toHaveBeenCalledWith("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": "test-serper-key",
        },
        body: JSON.stringify({
          q: "test query",
          gl: "us",
          location: "New York",
          hl: "es",
          tbs: "d",
          autocorrect: false,
          num: 20,
          page: 2,
        }),
      });
    });

    it("should return error result when API request fails", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        text: async () => "API Error Message",
      } as Response);

      const result = await provider.performWebSearch("test query");

      expect(result).toEqual({
        status: "error",
        error: "Error performing web search: API Error Message",
      });
    });

    it("should handle network errors", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      await expect(provider.performWebSearch("test query")).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle malformed JSON response", async () => {
      // @ts-ignore - mockResolvedValue is not typed
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as Response);

      await expect(provider.performWebSearch("test query")).rejects.toThrow(
        "Invalid JSON",
      );
    });

    it("should throw error if API key becomes undefined after construction", async () => {
      const providerWithDynamicKey = new SerperProvider(mockEnv);
      (providerWithDynamicKey as any).apiKey = undefined;

      await expect(
        providerWithDynamicKey.performWebSearch("test query"),
      ).rejects.toThrow(expect.any(AssistantError));
      await expect(
        providerWithDynamicKey.performWebSearch("test query"),
      ).rejects.toThrow("SERPER_API_KEY is not set");
    });
  });
});
