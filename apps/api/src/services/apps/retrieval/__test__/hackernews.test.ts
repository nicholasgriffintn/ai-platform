import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuxiliaryModelForRetrieval } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import {
	analyseHackerNewsStories,
	retrieveHackerNewsTopStories,
} from "../hackernews";

vi.mock("~/lib/models", () => ({
	getAuxiliaryModelForRetrieval: vi.fn(() =>
		Promise.resolve({ model: "gpt-4o-mini", provider: "openai" }),
	),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => ({
			getResponse: vi.fn(() =>
				Promise.resolve({
					response: "Mocked AI analysis of HackerNews stories",
				}),
			),
		})),
	},
}));

vi.mock("~/utils/errors", () => ({
	AssistantError: class extends Error {
		type: string;
		constructor(message: string, type?: string) {
			super(message);
			this.type = type || "UNKNOWN";
		}
	},
	ErrorType: {
		PARAMS_ERROR: "PARAMS_ERROR",
		PROVIDER_ERROR: "PROVIDER_ERROR",
	},
}));

global.fetch = vi.fn();

describe("HackerNews Services", () => {
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		plan: "free",
		created_at: Date.now(),
	} as any;

	const mockEnv = {
		ACCOUNT_ID: "test-account-id",
		BROWSER_RENDERING_API_KEY: "test-browser-key",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("retrieveHackerNewsTopStories", () => {
		it("should successfully retrieve HackerNews stories", async () => {
			const mockResponse = {
				status: true,
				result: [
					{
						results: [
							{
								html: '<a href="https://example.com/story1">First Story Title</a>',
								attributes: [],
								height: 100,
								left: 0,
								text: "First Story Title",
								top: 0,
								width: 200,
							},
							{
								html: '<a href="/item?id=123456">Second Story Title</a>',
								attributes: [],
								height: 100,
								left: 0,
								text: "Second Story Title",
								top: 0,
								width: 200,
							},
						],
						selector: ".athing",
					},
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			} as Response);

			const result = await retrieveHackerNewsTopStories({
				count: 2,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toEqual([
				{ title: "First Story Title", link: "https://example.com/story1" },
				{
					title: "Second Story Title",
					link: "https://news.ycombinator.com/item?id=123456",
				},
			]);

			expect(fetch).toHaveBeenCalledWith(
				`https://api.cloudflare.com/client/v4/accounts/test-account-id/browser-rendering/scrape`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer test-browser-key",
					},
					body: JSON.stringify({
						url: "https://news.ycombinator.com",
						elements: [{ selector: ".athing" }],
					}),
				},
			);
		});

		it("should handle relative URLs correctly", async () => {
			const mockResponse = {
				status: true,
				result: [
					{
						results: [
							{
								html: '<a href="/item?id=123">Relative URL Story</a>',
								attributes: [],
								height: 100,
								left: 0,
								text: "Relative URL Story",
								top: 0,
								width: 200,
							},
						],
						selector: ".athing",
					},
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			} as Response);

			const result = await retrieveHackerNewsTopStories({
				count: 1,
				env: mockEnv,
				user: mockUser,
			});

			expect(result[0].link).toBe("https://news.ycombinator.com/item?id=123");
		});

		it("should return empty array for missing ACCOUNT_ID", async () => {
			const envWithoutAccountId = { BROWSER_RENDERING_API_KEY: "test-key" };

			const result = await retrieveHackerNewsTopStories({
				count: 5,
				// @ts-ignore - envWithoutAccountId is missing required properties
				env: envWithoutAccountId,
				user: mockUser,
			});

			expect(result).toEqual([]);
		});

		it("should return empty array for missing BROWSER_RENDERING_API_KEY", async () => {
			const envWithoutKey = { ACCOUNT_ID: "test-account" };

			const result = await retrieveHackerNewsTopStories({
				count: 5,
				// @ts-ignore - envWithoutKey is missing required properties
				env: envWithoutKey,
				user: mockUser,
			});

			expect(result).toEqual([]);
		});

		it("should return empty array for API errors", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				text: () => Promise.resolve("API Error"),
			} as Response);

			const result = await retrieveHackerNewsTopStories({
				count: 5,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toEqual([]);
		});

		it("should return empty array for malformed response", async () => {
			const malformedResponse = {
				status: true,
				result: [
					{
						results: [],
						selector: ".athing",
					},
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(malformedResponse),
			} as Response);

			const result = await retrieveHackerNewsTopStories({
				count: 5,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toEqual([]);
		});

		it("should limit results to requested count", async () => {
			const mockResponse = {
				status: true,
				result: [
					{
						results: Array.from({ length: 10 }, (_, i) => ({
							html: `<a href="https://example${i}.com">Story ${i}</a>`,
							attributes: [],
							height: 100,
							left: 0,
							text: `Story ${i}`,
							top: 0,
							width: 200,
						})),
						selector: ".athing",
					},
				],
			};

			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			} as Response);

			const result = await retrieveHackerNewsTopStories({
				count: 3,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toHaveLength(3);
		});
	});

	describe("analyseHackerNewsStories", () => {
		const mockStories = [
			{ title: "New AI Breakthrough", link: "https://example.com/ai" },
			{ title: "Startup Raises $100M", link: "https://example.com/startup" },
		];

		const mockProvider = {
			getResponse: vi.fn(),
		};

		beforeEach(() => {
			// @ts-ignore - mockProvider is missing required properties
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);
			vi.mocked(getAuxiliaryModelForRetrieval).mockResolvedValue({
				model: "gpt-4o-mini",
				provider: "openai",
			});
		});

		it("should analyze stories with normal character", async () => {
			const mockResponse = { response: "Analysis of tech stories" };
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			const result = await analyseHackerNewsStories({
				character: "normal",
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toEqual(mockResponse);
			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o-mini",
					env: mockEnv,
					user: mockUser,
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content:
								"You are a neutral AI assistant. Summarize these Hacker News posts without any personal opinions or biases.",
						}),
						expect.objectContaining({
							role: "user",
							content: expect.stringContaining(
								"1. New AI Breakthrough\n2. Startup Raises $100M",
							),
						}),
					]),
				}),
				"user-123",
			);
		});

		it("should analyze stories with Kermit the Frog character", async () => {
			const mockResponse = {
				response: "Yaaay! These tech stories are amazing!",
			};
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			const result = await analyseHackerNewsStories({
				character: "kermitthefrog",
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toEqual(mockResponse);
			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.stringContaining("You are Kermit the Frog"),
						}),
					]),
				}),
				"user-123",
			);
		});

		it("should analyze stories with Gordon Ramsay character", async () => {
			const mockResponse = { response: "These startups are RAW!" };
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			const _result = await analyseHackerNewsStories({
				character: "gordonramsay",
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.stringContaining("You are Gordon Ramsay"),
						}),
					]),
				}),
				"user-123",
			);
		});

		it("should analyze stories with David Attenborough character", async () => {
			const mockResponse = {
				response: "In the vast ecosystem of technology...",
			};
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			const _result = await analyseHackerNewsStories({
				character: "davidattenborough",
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.stringContaining(
								"You are Sir David Attenborough",
							),
						}),
					]),
				}),
				"user-123",
			);
		});

		it("should analyze stories with Clippy character", async () => {
			const mockResponse = {
				response: "It looks like you're trying to disrupt an industry!",
			};
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			const _result = await analyseHackerNewsStories({
				character: "clippy",
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.stringContaining("You are Clippy"),
						}),
					]),
				}),
				"user-123",
			);
		});

		it("should return empty string for empty stories", async () => {
			const result = await analyseHackerNewsStories({
				stories: [],
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toBe("");
			expect(mockProvider.getResponse).not.toHaveBeenCalled();
		});

		it("should return empty string for null stories", async () => {
			const result = await analyseHackerNewsStories({
				stories: null as any,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toBe("");
		});

		it("should handle AI provider errors gracefully", async () => {
			mockProvider.getResponse.mockRejectedValue(
				new Error("AI Provider Error"),
			);

			const result = await analyseHackerNewsStories({
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toBe("");
		});

		it("should handle missing response from AI provider", async () => {
			mockProvider.getResponse.mockResolvedValue({ response: null });

			const result = await analyseHackerNewsStories({
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(result).toBe("");
		});

		it("should use correct AI model parameters", async () => {
			const mockResponse = { response: "Analysis" };
			mockProvider.getResponse.mockResolvedValue(mockResponse);

			await analyseHackerNewsStories({
				stories: mockStories,
				env: mockEnv,
				user: mockUser,
			});

			expect(mockProvider.getResponse).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 2048,
					temperature: 0.7,
				}),
				"user-123",
			);
		});
	});
});
