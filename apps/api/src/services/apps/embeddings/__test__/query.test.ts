import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantError, ErrorType } from "~/utils/errors";

const mockDatabase = {
	getUserSettings: vi.fn(() => Promise.resolve({})),
};

const mockEmbedding = {
	getNamespace: vi.fn(() => "default-namespace"),
	searchSimilar: vi.fn(() => Promise.resolve([])),
};

