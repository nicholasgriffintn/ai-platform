import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getEmbeddingProvider,
	getEmbeddingNamespace,
	augmentPrompt,
} from "../helpers";
import { providerLibrary } from "~/lib/providers/library";
import { getAuxiliaryModel } from "~/lib/providers/models";

const mockRepositoryManager = {} as any;

vi.mock("~/repositories", () => ({
	RepositoryManager: class {
		constructor() {
			return mockRepositoryManager;
		}
	},
}));

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		embedding: vi.fn(),
	},
}));

vi.mock("~/lib/monitoring", () => ({
	trackRagMetrics: vi.fn((fn: () => any) => fn()),
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn(),
}));

vi.mock("../../chat", () => ({
	getChatProvider: vi.fn(() => ({
		getResponse: vi.fn().mockResolvedValue({ content: "[]" }),
	})),
}));

describe("embedding helpers", () => {
	const baseEnv = {
		AI: {},
		VECTOR_DB: {},
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getEmbeddingProvider", () => {
		it("should configure vectorize provider with repositories", () => {
			const mockProvider = {};
			vi.mocked(providerLibrary.embedding).mockReturnValue(mockProvider as any);

			const provider = getEmbeddingProvider(baseEnv);

			expect(providerLibrary.embedding).toHaveBeenCalledWith(
				"vectorize",
				expect.objectContaining({
					env: baseEnv,
					config: expect.objectContaining({
						ai: baseEnv.AI,
						vector_db: baseEnv.VECTOR_DB,
						repositories: mockRepositoryManager,
					}),
				}),
			);
			expect(provider).toBe(mockProvider);
		});
	});

	describe("getEmbeddingNamespace", () => {
		it("should fall back to kb when namespace mismatches user", () => {
			const namespace = getEmbeddingNamespace({ id: 123 } as any, {
				namespace: "user_kb_456",
			});
			expect(namespace).toBe("kb");
		});

		it("should honor namespace when matching user", () => {
			const namespace = getEmbeddingNamespace({ id: 123 } as any, {
				namespace: "user_kb_123",
			});
			expect(namespace).toBe("user_kb_123");
		});
	});

	describe("augmentPrompt", () => {
		it("should return formatted prompt for matching docs", async () => {
			const provider = {
				searchSimilar: vi.fn().mockResolvedValue([
					{
						id: "doc-1",
						title: "Doc 1",
						content: "Relevant content",
						score: 0.9,
						type: "note",
					},
				]),
			};

			vi.mocked(getAuxiliaryModel).mockResolvedValue({
				model: "test-model",
				provider: "test-provider",
			});

			const prompt = await augmentPrompt({
				provider: provider as any,
				query: "Tell me something",
				options: {},
				env: baseEnv,
				user: { id: 1 } as any,
			});

			expect(provider.searchSimilar).toHaveBeenCalledWith(
				"Tell me something",
				expect.objectContaining({
					namespace: "user_kb_1",
					scoreThreshold: 0.7,
					topK: 10,
					type: undefined,
				}),
			);
			expect(prompt).toContain("Doc 1");
			expect(prompt).toContain("Tell me something");
		});

		it("should return empty string when no docs found", async () => {
			const provider = {
				searchSimilar: vi.fn().mockResolvedValue([]),
			};

			const prompt = await augmentPrompt({
				provider: provider as any,
				query: "No relevant docs",
				options: {},
				env: baseEnv,
			});

			expect(prompt).toBe("");
		});
	});
});
