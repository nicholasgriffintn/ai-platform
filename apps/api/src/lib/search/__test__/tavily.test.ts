import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnv, SearchOptions } from "~/types";
import { TavilyProvider } from "../tavily";

global.fetch = vi.fn();

describe("TavilyProvider", () => {
	const mockEnv: IEnv = {
		TAVILY_API_KEY: "test-tavily-key",
	} as IEnv;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should create instance with valid API key", () => {
			expect(() => new TavilyProvider(mockEnv)).not.toThrow();
		});

		it("should create instance even without API key (validation happens at runtime)", () => {
			const envWithoutKey = { ...mockEnv, TAVILY_API_KEY: undefined } as IEnv;
			expect(() => new TavilyProvider(envWithoutKey)).not.toThrow();
		});
	});

	describe("performWebSearch", () => {
		let provider: TavilyProvider;

		beforeEach(() => {
			provider = new TavilyProvider(mockEnv);
		});

		it("should perform successful search with default options", async () => {
			const mockResponse = {
				results: [
					{
						title: "Test Result",
						content: "Test content",
						url: "https://example.com",
						score: 0.95,
					},
					{
						title: "Test Result 2",
						content: "Test content 2",
						url: "https://example2.com",
						score: 0.87,
					},
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await provider.performWebSearch("test query");

			expect(fetch).toHaveBeenCalledWith("https://api.tavily.com/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-tavily-key",
				},
				body: JSON.stringify({
					query: "test query",
					search_depth: "basic",
					include_answer: false,
					include_raw_content: false,
					include_images: false,
					max_results: 9,
				}),
			});

			expect(result).toEqual({ ...mockResponse, provider: "tavily" });
		});

		it("should perform search with custom options", async () => {
			const mockResponse = {
				results: [
					{
						title: "Advanced Result",
						content: "Advanced content",
						url: "https://advanced.com",
						score: 0.98,
					},
				],
				answer: "This is an AI-generated answer",
				images: [
					{ url: "https://example.com/image1.jpg" },
					{ url: "https://example.com/image2.jpg" },
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const options: SearchOptions = {
				search_depth: "advanced",
				include_answer: true,
				include_raw_content: true,
				include_images: true,
				max_results: 15,
			};

			const result = await provider.performWebSearch("advanced query", options);

			expect(fetch).toHaveBeenCalledWith("https://api.tavily.com/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer test-tavily-key",
				},
				body: JSON.stringify({
					query: "advanced query",
					search_depth: "advanced",
					include_answer: true,
					include_raw_content: true,
					include_images: true,
					max_results: 15,
				}),
			});

			expect(result).toEqual({ ...mockResponse, provider: "tavily" });
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

		it("should work with undefined API key but fail at runtime", async () => {
			const envWithoutKey = { ...mockEnv, TAVILY_API_KEY: undefined } as IEnv;
			const providerWithoutKey = new TavilyProvider(envWithoutKey);

			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				text: async () => "Unauthorized",
			} as Response);

			const result = await providerWithoutKey.performWebSearch("test query");

			expect(fetch).toHaveBeenCalledWith("https://api.tavily.com/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer undefined",
				},
				body: JSON.stringify({
					query: "test query",
					search_depth: "basic",
					include_answer: false,
					include_raw_content: false,
					include_images: false,
					max_results: 9,
				}),
			});

			expect(result).toEqual({
				status: "error",
				error: "Error performing web search: Unauthorized",
			});
		});

		it("should handle empty results", async () => {
			const mockResponse = {
				results: [],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await provider.performWebSearch("empty query");

			expect(result).toEqual({ ...mockResponse, provider: "tavily" });
		});
	});
});
