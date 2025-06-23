import {
  type MockedFunction,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { handleWebSearch } from "../web";

vi.mock("~/lib/chat/utils", () => ({
  sanitiseInput: vi.fn(),
}));

vi.mock("~/lib/search", () => ({
  Search: {
    getInstance: vi.fn(),
  },
}));

describe("Web Search Service", () => {
  let mockSanitiseInput: MockedFunction<any>;
  let mockSearchGetInstance: MockedFunction<any>;
  let mockSearch: { search: MockedFunction<any> };

  beforeEach(async () => {
    vi.clearAllMocks();

    const chatUtils = await import("~/lib/chat/utils");
    mockSanitiseInput = vi.mocked(chatUtils.sanitiseInput);

    const searchLib = await import("~/lib/search");
    mockSearchGetInstance = vi.mocked(searchLib.Search.getInstance);

    mockSearch = {
      search: vi.fn(),
    };
    mockSearchGetInstance.mockReturnValue(mockSearch);
  });

  describe("handleWebSearch", () => {
    const mockRequest = {
      env: {} as any,
      query: "test query",
      user: { id: 123 } as any,
    };

    it("should perform successful web search", async () => {
      const mockSearchResponse = {
        results: [{ title: "Test Result", url: "https://example.com" }],
      };

      mockSanitiseInput.mockReturnValue("test query");
      mockSearch.search.mockResolvedValue(mockSearchResponse);

      const result = await handleWebSearch(mockRequest);

      expect(mockSanitiseInput).toHaveBeenCalledWith("test query");
      expect(mockSearchGetInstance).toHaveBeenCalledWith({}, "tavily");
      expect(mockSearch.search).toHaveBeenCalledWith("test query", undefined);
      expect(result).toEqual({
        status: "success",
        content: "Search completed",
        data: mockSearchResponse,
      });
    });

    it("should use custom provider", async () => {
      const mockSearchResponse = { results: [] };
      const requestWithProvider = {
        ...mockRequest,
        provider: "serper" as const,
      };

      mockSanitiseInput.mockReturnValue("test query");
      mockSearch.search.mockResolvedValue(mockSearchResponse);

      await handleWebSearch(requestWithProvider);

      expect(mockSearchGetInstance).toHaveBeenCalledWith({}, "serper");
    });

    it("should pass search options", async () => {
      const mockSearchResponse = { results: [] };
      const searchOptions = { limit: 5 };
      const requestWithOptions = {
        ...mockRequest,
        options: searchOptions,
      };

      mockSanitiseInput.mockReturnValue("test query");
      mockSearch.search.mockResolvedValue(mockSearchResponse);

      // @ts-expect-error - mock implementation
      await handleWebSearch(requestWithOptions);

      expect(mockSearch.search).toHaveBeenCalledWith(
        "test query",
        searchOptions,
      );
    });

    it("should throw error for empty query", async () => {
      mockSanitiseInput.mockReturnValue("");

      await expect(handleWebSearch(mockRequest)).rejects.toThrow(
        new AssistantError("Missing query", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error for null query", async () => {
      mockSanitiseInput.mockReturnValue(null);

      await expect(handleWebSearch(mockRequest)).rejects.toThrow(
        new AssistantError("Missing query", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error for query too long", async () => {
      const longQuery = "a".repeat(4097);
      mockSanitiseInput.mockReturnValue(longQuery);

      await expect(
        handleWebSearch({ ...mockRequest, query: longQuery }),
      ).rejects.toThrow(
        new AssistantError("Query is too long", ErrorType.PARAMS_ERROR),
      );
    });

    it("should throw error when search returns no response", async () => {
      mockSanitiseInput.mockReturnValue("test query");
      mockSearch.search.mockResolvedValue(null);

      await expect(handleWebSearch(mockRequest)).rejects.toThrow(
        new AssistantError("No response from the web search service"),
      );
    });

    it("should handle search service errors", async () => {
      mockSanitiseInput.mockReturnValue("test query");
      mockSearch.search.mockRejectedValue(new Error("Search service error"));

      await expect(handleWebSearch(mockRequest)).rejects.toThrow(
        "Search service error",
      );
    });
  });
});
