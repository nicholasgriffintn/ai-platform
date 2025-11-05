import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/utils/embeddings", () => ({
	chunkText: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "generated-id"),
}));

const mockDatabase = {
	getEmbeddingIdByType: vi.fn(),
	insertEmbedding: vi.fn(),
	getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
	getNamespace: vi.fn(),
	generate: vi.fn(),
	insert: vi.fn(),
};

