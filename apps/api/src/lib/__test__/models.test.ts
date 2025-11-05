import { beforeEach, describe, expect, it, vi } from "vitest";

import { KVCache } from "~/lib/cache";
import { Database } from "~/lib/database";
import type { ModelConfigItem, IUser } from "~/types";
import {
	filterModelsForUserAccess,
	getAuxiliaryGuardrailsModel,
	getAuxiliaryModel,
	getAuxiliaryModelForRetrieval,
	getAuxiliarySearchProvider,
	getFeaturedModels,
	getFreeModels,
	getIncludedInRouterModels,
	getMatchingModel,
	getModelConfig,
	getModelConfigByMatchingModel,
	getModelConfigByModel,
	getModels,
	getModelsByCapability,
	getModelsByType,
} from "../models";

vi.mock("~/lib/cache", () => {
	const mockCache = {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		has: vi.fn(),
		cacheQuery: vi.fn(),
	};

	const MockKVCache = vi.fn().mockImplementation(() => mockCache);
	// @ts-expect-error - mock implementation
	MockKVCache.createKey = vi.fn((...parts) => parts.join(":"));

	return {
		KVCache: MockKVCache,
	};
});

