import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, SearchOptions } from "~/types";
import { SearchProviderFactory } from "../factory";
import { Search } from "../index";

const mockPerformWebSearch = vi.fn();

vi.mock("../factory", () => ({
	SearchProviderFactory: {
		getProvider: vi.fn(() => ({
			performWebSearch: mockPerformWebSearch,
		})),
	},
}));

describe("Search", () => {
	const mockEnv: IEnv = {
		SERPER_API_KEY: "test-serper-key",
		TAVILY_API_KEY: "test-tavily-key",
	} as IEnv;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getInstance", () => {
		it("should create new instance when called first time", () => {
			const instance = Search.getInstance(mockEnv, "serper");
			expect(instance).toBeInstanceOf(Search);
		});

		it("should return new instance when called multiple times", () => {
			const instance1 = Search.getInstance(mockEnv, "serper");
			const instance2 = Search.getInstance(mockEnv, "tavily");

			expect(instance1).not.toBe(instance2);
		});

		it("should create provider through factory", () => {
			Search.getInstance(mockEnv, "serper");

			expect(SearchProviderFactory.getProvider).toHaveBeenCalledWith(
				"serper",
				mockEnv,
				undefined,
			);
		});

		it("should work with tavily provider", () => {
			Search.getInstance(mockEnv, "tavily");

			expect(SearchProviderFactory.getProvider).toHaveBeenCalledWith(
				"tavily",
				mockEnv,
				undefined,
			);
		});

		it("should forward user to provider factory when supplied", () => {
			const user = { id: 42 } as any;
			Search.getInstance(mockEnv, "serper", user);

			expect(SearchProviderFactory.getProvider).toHaveBeenCalledWith(
				"serper",
				mockEnv,
				user,
			);
		});
	});

	describe("search", () => {
		it("should delegate search to provider with query only", async () => {
			const mockResult = {
				results: [
					{
						title: "Test Result",
						content: "Test content",
						url: "https://example.com",
						score: 0.95,
					},
				],
			};

			mockPerformWebSearch.mockResolvedValue(mockResult);

			const searchInstance = Search.getInstance(mockEnv, "serper");
			const result = await searchInstance.search("test query");

			expect(mockPerformWebSearch).toHaveBeenCalledWith(
				"test query",
				undefined,
			);
			expect(result).toEqual(mockResult);
		});

		it("should delegate search to provider with query and options", async () => {
			const mockResult = {
				searchParameters: { q: "advanced query" },
				organic: [
					{
						title: "Advanced Result",
						link: "https://advanced.com",
						snippet: "Advanced snippet",
						position: 1,
					},
				],
				peopleAlsoAsk: [],
				relatedSearches: { query: "related query" },
			};

			const options: SearchOptions = {
				search_depth: "advanced",
				include_answer: true,
				max_results: 15,
				country: "us",
				language: "en",
			};

			mockPerformWebSearch.mockResolvedValue(mockResult);

			const searchInstance = Search.getInstance(mockEnv, "serper");
			const result = await searchInstance.search("advanced query", options);

			expect(mockPerformWebSearch).toHaveBeenCalledWith(
				"advanced query",
				options,
			);
			expect(result).toEqual(mockResult);
		});

		it("should handle search errors", async () => {
			const errorResult = {
				status: "error" as const,
				error: "Search failed",
			};

			mockPerformWebSearch.mockResolvedValue(errorResult);

			const searchInstance = Search.getInstance(mockEnv, "serper");
			const result = await searchInstance.search("failing query");

			expect(result).toEqual(errorResult);
		});

		it("should handle provider throwing errors", async () => {
			mockPerformWebSearch.mockRejectedValue(new Error("Provider error"));

			const searchInstance = Search.getInstance(mockEnv, "serper");

			await expect(searchInstance.search("error query")).rejects.toThrow(
				"Provider error",
			);
		});

		it("should create separate instances for different searches", async () => {
			const mockResult1 = { results: [{ title: "Result 1" }] };
			const mockResult2 = { results: [{ title: "Result 2" }] };

			mockPerformWebSearch
				.mockResolvedValueOnce(mockResult1)
				.mockResolvedValueOnce(mockResult2);

			const searchInstance1 = Search.getInstance(mockEnv, "serper");
			const searchInstance2 = Search.getInstance(mockEnv, "tavily");

			expect(searchInstance1).not.toBe(searchInstance2);

			const result1 = await searchInstance1.search("query 1");
			const result2 = await searchInstance2.search("query 2");

			expect(result1).toEqual(mockResult1);
			expect(result2).toEqual(mockResult2);
			expect(mockPerformWebSearch).toHaveBeenCalledTimes(2);
		});
	});
});
