import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDatabase = {
	getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
	delete: vi.fn(() => Promise.resolve({ status: "success" })),
};

