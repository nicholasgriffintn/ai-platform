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

vi.mock("~/lib/providers/models", () => ({
	getAuxiliarySearchProvider: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/search", () => ({
	getSearchProvider: vi.fn(),
}));

describe("Web Search Service", () => {
	let mockSanitiseInput: MockedFunction<any>;
	let mockGetSearchProvider: MockedFunction<any>;
	let mockSearchProvider: { performWebSearch: MockedFunction<any> };
	let mockGetAuxiliarySearchProvider: MockedFunction<any>;

	beforeEach(async () => {
		vi.clearAllMocks();

		const chatUtils = await import("~/lib/chat/utils");
		mockSanitiseInput = vi.mocked(chatUtils.sanitiseInput);

		const models = await import("~/lib/providers/models");
		mockGetAuxiliarySearchProvider = vi.mocked(
			models.getAuxiliarySearchProvider,
		);
		mockGetAuxiliarySearchProvider.mockResolvedValue("tavily");

		const searchCapability = await import(
			"~/lib/providers/capabilities/search"
		);
		mockGetSearchProvider = vi.mocked(searchCapability.getSearchProvider);

		mockSearchProvider = {
			performWebSearch: vi.fn(),
		};
		mockGetSearchProvider.mockReturnValue(mockSearchProvider);
	});

	describe("handleWebSearch", () => {
		const mockRequest = {
			env: {} as any,
			query: "test query",
			user: { id: 123, plan_id: "pro" } as any,
		};

		it("should perform successful web search", async () => {
			const mockSearchResponse = {
				results: [{ title: "Test Result", url: "https://example.com" }],
			};

			mockSanitiseInput.mockReturnValue("test query");
			mockSearchProvider.performWebSearch.mockResolvedValue(mockSearchResponse);

			const result = await handleWebSearch(mockRequest);

			expect(mockSanitiseInput).toHaveBeenCalledWith("test query");
			expect(mockGetAuxiliarySearchProvider).toHaveBeenCalledWith(
				{},
				mockRequest.user,
				undefined,
			);
			expect(mockGetSearchProvider).toHaveBeenCalledWith("tavily", {
				env: {},
				user: mockRequest.user,
			});
			expect(mockSearchProvider.performWebSearch).toHaveBeenCalledWith(
				"test query",
				undefined,
			);
			expect(result).toEqual({
				status: "success",
				content: "Search completed",
				data: {
					provider: "tavily",
					result: mockSearchResponse,
					results: mockSearchResponse.results,
					warning: undefined,
				},
			});
		});

		it("should use custom provider", async () => {
			const mockSearchResponse = { results: [] };
			const requestWithProvider = {
				...mockRequest,
				provider: "serper" as const,
			};

			mockSanitiseInput.mockReturnValue("test query");
			mockGetAuxiliarySearchProvider.mockResolvedValueOnce("serper");
			mockSearchProvider.performWebSearch.mockResolvedValue(mockSearchResponse);

			const result = await handleWebSearch(requestWithProvider);

			expect(mockGetAuxiliarySearchProvider).toHaveBeenCalledWith(
				{},
				mockRequest.user,
				"serper",
			);
			expect(mockGetSearchProvider).toHaveBeenCalledWith("serper", {
				env: {},
				user: mockRequest.user,
			});

			expect(result.data).toEqual({
				provider: "serper",
				result: mockSearchResponse,
				results: mockSearchResponse.results,
				warning: undefined,
			});
		});

		it("should support duckduckgo provider for free users", async () => {
			const freeUserRequest = {
				...mockRequest,
				user: { id: 456, plan_id: "free" } as any,
			};
			mockSanitiseInput.mockReturnValue("free query");
			mockGetAuxiliarySearchProvider.mockResolvedValueOnce("duckduckgo");
			mockSearchProvider.performWebSearch.mockResolvedValue({ results: [] });

			const result = await handleWebSearch(freeUserRequest);

			expect(mockGetAuxiliarySearchProvider).toHaveBeenCalledWith(
				{},
				freeUserRequest.user,
				undefined,
			);
			expect(mockGetSearchProvider).toHaveBeenCalledWith("duckduckgo", {
				env: {},
				user: freeUserRequest.user,
			});
			expect(result.data.provider).toBe("duckduckgo");
			expect(result.data.warning).toContain("Upgrade to a Pro plan");
		});

		it("should pass search options", async () => {
			const mockSearchResponse = { results: [] };
			const searchOptions = { limit: 5 };
			const requestWithOptions = {
				...mockRequest,
				options: searchOptions,
			};

			mockSanitiseInput.mockReturnValue("test query");
			mockSearchProvider.performWebSearch.mockResolvedValue(mockSearchResponse);

			// @ts-expect-error - mock implementation
			await handleWebSearch(requestWithOptions);

			expect(mockGetAuxiliarySearchProvider).toHaveBeenCalledWith(
				{},
				mockRequest.user,
				undefined,
			);
			expect(mockSearchProvider.performWebSearch).toHaveBeenCalledWith(
				"test query",
				searchOptions,
			);
		});

		it("should throw error for empty query", async () => {
			mockSanitiseInput.mockReturnValue("");

			await expect(handleWebSearch(mockRequest)).rejects.toMatchObject({
				message: "Missing query",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
			expect(mockGetAuxiliarySearchProvider).not.toHaveBeenCalled();
		});

		it("should throw error for null query", async () => {
			mockSanitiseInput.mockReturnValue(null);

			await expect(handleWebSearch(mockRequest)).rejects.toMatchObject({
				message: "Missing query",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
			expect(mockGetAuxiliarySearchProvider).not.toHaveBeenCalled();
		});

		it("should throw error for query too long", async () => {
			const longQuery = "a".repeat(4097);
			mockSanitiseInput.mockReturnValue(longQuery);

			await expect(
				handleWebSearch({ ...mockRequest, query: longQuery }),
			).rejects.toMatchObject({
				message: "Query is too long",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error when user plan does not allow search", async () => {
			const planError = new AssistantError(
				"Web search is only available for Pro users right now.",
				ErrorType.AUTHORISATION_ERROR,
			);
			mockSanitiseInput.mockReturnValue("test query");
			mockGetAuxiliarySearchProvider.mockRejectedValue(planError);

			await expect(handleWebSearch(mockRequest)).rejects.toBe(planError);
		});

		it("should throw error when search returns no response", async () => {
			mockSanitiseInput.mockReturnValue("test query");
			mockSearchProvider.performWebSearch.mockResolvedValue(null);

			await expect(handleWebSearch(mockRequest)).rejects.toMatchObject({
				message: "No response from the web search service",
				type: ErrorType.UNKNOWN_ERROR,
				name: "AssistantError",
			});
		});

		it("should handle search service errors", async () => {
			mockSanitiseInput.mockReturnValue("test query");
			mockSearchProvider.performWebSearch.mockRejectedValue(
				new Error("Search service error"),
			);

			await expect(handleWebSearch(mockRequest)).rejects.toThrow(
				"Search service error",
			);
		});
	});
});
