import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, SearchOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { PerplexityProvider } from "../providers/PerplexityProvider";

global.fetch = vi.fn();

describe("PerplexityProvider", () => {
	const mockEnv = {
		ACCOUNT_ID: "test-account",
		PERPLEXITY_API_KEY: "test-perplexity-key",
	} as IEnv;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("performWebSearch", () => {
		let provider: PerplexityProvider;

		beforeEach(() => {
			provider = new PerplexityProvider(mockEnv);
		});

		it("should perform a successful search with default options", async () => {
			const mockResponse = {
				results: [
					{
						title: "Example Article",
						url: "https://example.com/article",
						snippet: "A relevant excerpt from the article.",
						date: "2025-01-23",
						last_updated: "2025-09-25",
					},
				],
				id: "search-id",
				server_time: "2026-05-24T00:00:00Z",
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await provider.performWebSearch("test query");

			expect(fetch).toHaveBeenCalledWith(
				"https://gateway.ai.cloudflare.com/v1/test-account/llm-assistant/perplexity-ai/search",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-perplexity-key",
					},
					body: JSON.stringify({
						query: "test query",
						max_results: 10,
						max_tokens_per_page: 1024,
					}),
				},
			);

			expect(result).toEqual({
				provider: "perplexity",
				results: mockResponse.results,
				id: "search-id",
				server_time: "2026-05-24T00:00:00Z",
			});
		});

		it("should send supported search filters and omit unsupported answer options", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ results: [] }),
			} as Response);

			const options: SearchOptions = {
				country: "US",
				language: "en",
				include_answer: true,
				max_results: 5,
			};

			await provider.performWebSearch("filtered query", options);

			expect(fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({
						query: "filtered query",
						max_results: 5,
						max_tokens_per_page: 1024,
						country: "US",
						search_language_filter: ["en"],
					}),
				}),
			);
		});

		it("should return an error result when the API request fails", async () => {
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

		it("should throw a configuration error when no API key is available", async () => {
			const providerWithoutKey = new PerplexityProvider({
				...mockEnv,
				PERPLEXITY_API_KEY: undefined,
			} as IEnv);

			await expect(providerWithoutKey.performWebSearch("test query")).rejects.toMatchObject({
				name: "AssistantError",
				type: ErrorType.CONFIGURATION_ERROR,
				message: "PERPLEXITY_API_KEY is not set",
			} satisfies Partial<AssistantError>);
		});
	});
});
