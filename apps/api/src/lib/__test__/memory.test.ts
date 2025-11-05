import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderFactory } from "~/lib/providers/factory";
import { parseAIResponseJson } from "~/utils/json";
import { MemoryManager } from "../memory";

vi.mock("~/lib/embedding", () => ({
	Embedding: {
		getInstance: vi.fn(() => ({
			generate: vi
				.fn()
				.mockResolvedValue([{ values: [0.1, 0.2, 0.3], id: "test-id" }]),
			getMatches: vi.fn().mockResolvedValue({ matches: [] }),
			getQuery: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }),
			insert: vi.fn().mockResolvedValue(undefined),
		})),
	},
	EmbeddingSingleton: {
		getInstance: vi.fn(() => ({
			generate: vi
				.fn()
				.mockResolvedValue([{ values: [0.1, 0.2, 0.3], id: "test-id" }]),
			getMatches: vi.fn().mockResolvedValue({ matches: [] }),
			getQuery: vi.fn().mockResolvedValue({ data: [[0.1, 0.2, 0.3]] }),
			insert: vi.fn().mockResolvedValue(undefined),
		})),
	},
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(() => ({
			getResponse: vi.fn(),
			name: "test-provider",
			supportsStreaming: false,
			createRealtimeSession: vi.fn(),
		})),
	},
}));

vi.mock("~/lib/models", () => ({
	getAuxiliaryModel: vi.fn().mockResolvedValue({
		model: "gpt-3.5-turbo",
		provider: "openai",
	}),
}));

vi.mock("~/utils/json", () => ({
	parseAIResponseJson: vi.fn(),
}));

