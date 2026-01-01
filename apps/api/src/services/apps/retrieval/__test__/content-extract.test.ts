import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as embeddingHelpers from "~/lib/providers/capabilities/embedding/helpers";
import type {
	EmbeddingMutationResult,
	EmbeddingVector,
	IRequest,
} from "~/types";
import { extractContent } from "../content-extract";

const mockRepositories = {
	userSettings: {
		getUserSettings: vi.fn(() => Promise.resolve({})),
	},
};
vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		constructor() {
			return mockRepositories;
		}
	},
}));

const mockEmbeddingProvider = {
	generate: vi.fn(() =>
		Promise.resolve([
			{ id: "vec-1", values: [0.1, 0.2], metadata: {} },
		] as EmbeddingVector[]),
	),
	insert: vi.fn(() =>
		Promise.resolve({
			status: "success",
			error: null,
		} as EmbeddingMutationResult),
	),
};

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
	getEmbeddingProvider: vi.fn(() => mockEmbeddingProvider),
}));

describe("extractContent", () => {
	const mockUser = {
		id: "user-123",
		email: "test@example.com",
		plan: "free",
		created_at: Date.now(),
	} as any;

	const mockEnv = {
		DB: {} as any,
		TAVILY_API_KEY: "test-tavily-key",
		ASSETS_BUCKET: "test-bucket",
	} as any;

	const mockRequest: IRequest = {
		user: mockUser,
		env: mockEnv,
	} as any;
	const mockedGetEmbeddingProvider = vi.mocked(
		embeddingHelpers.getEmbeddingProvider,
	);

	beforeEach(() => {
		vi.clearAllMocks();
		mockEmbeddingProvider.generate.mockClear();
		mockEmbeddingProvider.insert.mockClear();
		mockEmbeddingProvider.generate.mockResolvedValue([
			{ id: "vec-1", values: [0.1, 0.2], metadata: {} },
		]);
		mockEmbeddingProvider.insert.mockResolvedValue({
			status: "success",
			error: null,
		});
		mockedGetEmbeddingProvider.mockReturnValue(mockEmbeddingProvider as any);

		vi.stubGlobal("crypto", {
			subtle: {
				digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
			},
		});

		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should successfully extract content from single URL", async () => {
		const params = {
			urls: "https://example.com",
			extract_depth: "basic" as const,
			include_images: false,
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "This is the extracted content from the webpage.",
					images: [],
				},
			],
			failed_results: [],
			response_time: 1.2,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		const result = await extractContent(params, mockRequest);

		expect(result).toEqual({
			status: "success",
			data: {
				extracted: mockTavilyResponse,
			},
		});

		expect(fetch).toHaveBeenCalledWith("https://api.tavily.com/extract", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer test-tavily-key",
			},
			body: JSON.stringify({
				urls: "https://example.com",
				extract_depth: "basic",
				include_images: false,
			}),
		});
	});

	it("should successfully extract content from multiple URLs", async () => {
		const params = {
			urls: ["https://example.com", "https://test.com"],
			extract_depth: "advanced" as const,
			include_images: true,
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Content from example.com",
					images: ["image1.jpg"],
				},
				{
					url: "https://test.com",
					raw_content: "Content from test.com",
					images: [],
				},
			],
			failed_results: [],
			response_time: 2.5,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		const result = await extractContent(params, mockRequest);

		expect(result.status).toBe("success");
		expect(result.data?.extracted.results).toHaveLength(2);
	});

	it("should handle vectorization when requested", async () => {
		const params = {
			urls: "https://example.com",
			should_vectorize: true,
			namespace: "custom-namespace",
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Content to vectorize",
				},
			],
			failed_results: [],
			response_time: 1.0,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		const generatedVectors = [
			{ id: "vec-1", values: [0.1, 0.2], metadata: {} },
		];
		mockEmbeddingProvider.generate.mockResolvedValue(generatedVectors);
		mockEmbeddingProvider.insert.mockResolvedValue({
			status: "success",
			error: null,
		});

		const result = await extractContent(params, mockRequest);

		expect(result.status).toBe("success");
		expect(result.data?.vectorized).toEqual({
			success: true,
		});

		expect(mockEmbeddingProvider.generate).toHaveBeenCalledWith(
			"webpage",
			"Content to vectorize",
			expect.any(String),
			{
				url: "https://example.com",
				type: "webpage",
				source: "tavily_extract",
			},
		);

		expect(mockEmbeddingProvider.insert).toHaveBeenCalledWith(
			generatedVectors,
			{
				namespace: "custom-namespace",
			},
		);
	});

	it("should use default namespace for vectorization", async () => {
		const params = {
			urls: "https://example.com",
			should_vectorize: true,
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Content to vectorize",
				},
			],
			failed_results: [],
			response_time: 1.0,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		const defaultVectors = [{ id: "vec-1", values: [0.2, 0.3], metadata: {} }];
		mockEmbeddingProvider.generate.mockResolvedValue(defaultVectors);
		mockEmbeddingProvider.insert.mockResolvedValue({
			status: "success",
			error: null,
		});

		const _result = await extractContent(params, mockRequest);

		expect(mockEmbeddingProvider.insert).toHaveBeenCalledWith(defaultVectors, {
			namespace: "webpages",
		});
	});

	it("should return error for missing API key", async () => {
		const envWithoutKey = {};
		const requestWithoutKey = { ...mockRequest, env: envWithoutKey };

		const params = {
			urls: "https://example.com",
		};

		// @ts-ignore - requestWithoutKey.env is required
		const result = await extractContent(params, requestWithoutKey);

		expect(result).toEqual({
			status: "error",
			error: "Tavily API key not configured",
		});
	});

	it("should handle Tavily API errors", async () => {
		const params = {
			urls: "https://example.com",
		};

		(fetch as any).mockResolvedValue({
			ok: false,
			text: () => Promise.resolve("API Error: Invalid request"),
		} as Response);

		const result = await extractContent(params, mockRequest);

		expect(result).toEqual({
			status: "error",
			error: "Error extracting content: API Error: Invalid request",
		});
	});

	it("should handle network errors", async () => {
		const params = {
			urls: "https://example.com",
		};

		(fetch as any).mockRejectedValue(new Error("Network error"));

		const result = await extractContent(params, mockRequest);

		expect(result).toEqual({
			status: "error",
			error: "Error extracting content: Error: Network error",
		});
	});

	it("should handle vectorization errors gracefully", async () => {
		const params = {
			urls: "https://example.com",
			should_vectorize: true,
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Content to vectorize",
				},
			],
			failed_results: [],
			response_time: 1.0,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		mockRepositories.userSettings.getUserSettings.mockRejectedValue(
			new Error("Database error"),
		);

		const result = await extractContent(params, mockRequest);

		expect(result.status).toBe("success");
		expect(result.data?.vectorized).toEqual({
			success: false,
			error: "Error vectorizing content: Error: Database error",
		});
	});

	it("should handle failed extraction results", async () => {
		const params = {
			urls: ["https://example.com", "https://invalid-url.com"],
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Successful content",
				},
			],
			failed_results: [
				{
					url: "https://invalid-url.com",
					error: "Invalid URL",
				},
			],
			response_time: 1.5,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		const result = await extractContent(params, mockRequest);

		expect(result.status).toBe("success");
		expect(result.data?.extracted.results).toHaveLength(1);
		expect(result.data?.extracted.failed_results).toHaveLength(1);
	});

	it("should skip vectorization when no results", async () => {
		const params = {
			urls: "https://example.com",
			should_vectorize: true,
		};

		const mockTavilyResponse = {
			results: [],
			failed_results: [],
			response_time: 0.5,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		const result = await extractContent(params, mockRequest);

		expect(result.status).toBe("success");
		expect(result.data?.vectorized).toBeUndefined();
		expect(mockEmbeddingProvider.generate).not.toHaveBeenCalled();
	});

	it("should handle vectorization failure due to undefined mutation ID", async () => {
		const params = {
			urls: "https://example.com",
			should_vectorize: true,
		};

		const mockTavilyResponse = {
			results: [
				{
					url: "https://example.com",
					raw_content: "Content to vectorize",
				},
			],
			failed_results: [],
			response_time: 1.0,
		};

		(fetch as any).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockTavilyResponse),
		} as Response);

		mockRepositories.userSettings.getUserSettings.mockResolvedValue({});
		const failingVectors = [{ id: "vec-1", values: [0.4, 0.5], metadata: {} }];
		mockEmbeddingProvider.generate.mockResolvedValue(failingVectors);
		mockEmbeddingProvider.insert.mockResolvedValue({
			status: "error",
			error: "Mutation ID is undefined",
		});

		const result = await extractContent(params, mockRequest);

		expect(result.data?.vectorized).toEqual({
			success: false,
			error: "Mutation ID is undefined",
		});
	});
});
