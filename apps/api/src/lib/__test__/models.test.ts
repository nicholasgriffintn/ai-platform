import { beforeEach, describe, expect, it, vi } from "vitest";

import { KVCache } from "~/lib/cache";
import { Database } from "~/lib/database";
import type { ModelConfigItem, IUser } from "~/types";
import {
  filterModelsForUserAccess,
  getAuxiliaryGuardrailsModel,
  getAuxiliaryModel,
  getAuxiliaryModelForRetrieval,
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

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: vi.fn().mockReturnValue({
      getUserById: vi.fn(),
      getUserProviderSettings: vi.fn(),
    }),
  },
}));

const mockModelConfig: ModelConfigItem = {
  matchingModel: "test-model",
  name: "Test Model",
  description: "A test model",
  provider: "test-provider",
  type: ["text"],
  isBeta: false,
  supportsToolCalls: true,
  isFree: false,
  contextWindow: 4096,
  maxTokens: 2048,
  costPer1kInputTokens: 0.001,
  costPer1kOutputTokens: 0.002,
  strengths: ["coding", "analysis"],
  contextComplexity: 3,
  reliability: 4,
  speed: 3,
  multimodal: false,
  includedInRouter: true,
  isFeatured: false,
  supportsResponseFormat: true,
  supportsArtifacts: true,
  supportsStreaming: true,
  supportsDocuments: false,
  beta: false,
  supportsSearchGrounding: false,
  supportsCodeExecution: false,
};

const mockFreeModel: ModelConfigItem = {
  ...mockModelConfig,
  matchingModel: "free-model",
  name: "Free Model",
  provider: "free-provider",
  isFree: true,
};

const mockUser = {
  id: 123,
  email: "test@example.com",
  plan_id: "free",
} as IUser;

describe("Models", () => {
  let mockCache: any;
  let mockDatabase: any;
  let mockEnv: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockDatabase = Database.getInstance({} as any);
    mockCache = new KVCache({} as any);

    mockEnv = {
      CACHE: mockCache,
      ALWAYS_ENABLED_PROVIDERS: "always-enabled-provider",
    };

    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(true);
    mockDatabase.getUserProviderSettings.mockResolvedValue([]);
  });

  describe("getModelConfig", () => {
    it("should return default model config when no model specified", async () => {
      const result = await getModelConfig();

      expect(result).toBeDefined();
      expect(result.provider).toBe("mistral");
    });

    it("should return specific model config when model specified", async () => {
      const result = await getModelConfig("gpt-4o");

      expect(result).toBeDefined();
      expect(result.provider).toBe("openai");
    });

    it("should use cache when available", async () => {
      const cachedConfig = mockModelConfig;
      mockCache.get.mockResolvedValueOnce(cachedConfig);

      const result = await getModelConfig("test-model", mockEnv);

      expect(result).toEqual(cachedConfig);
      expect(mockCache.get).toHaveBeenCalledWith("model-config:test-model");
    });

    it("should cache result when cache is available", async () => {
      await getModelConfig("gpt-4o", mockEnv);

      expect(mockCache.set).toHaveBeenCalled();
    });

    it("should work without cache", async () => {
      const envWithoutCache = {};
      const result = await getModelConfig("gpt-4o", envWithoutCache as any);

      expect(result).toBeDefined();
      expect(mockCache.get).not.toHaveBeenCalled();
    });
  });

  describe("getModelConfigByModel", () => {
    it("should return model config for valid model", async () => {
      const result = await getModelConfigByModel("gpt-4o");

      expect(result).toBeDefined();
      expect(result.provider).toBe("openai");
    });

    it("should return undefined for invalid model", async () => {
      const result = await getModelConfigByModel("nonexistent-model");

      expect(result).toBeUndefined();
    });

    it("should use cache when available", async () => {
      const cachedConfig = mockModelConfig;
      mockCache.get.mockResolvedValueOnce(cachedConfig);

      const result = await getModelConfigByModel("test-model", mockEnv);

      expect(result).toEqual(cachedConfig);
      expect(mockCache.get).toHaveBeenCalledWith("model-by-model:test-model");
    });
  });

  describe("getMatchingModel", () => {
    it("should return matching model for valid model", async () => {
      const result = await getMatchingModel("gpt-4o");

      expect(result).toBe("gpt-4o");
    });

    it("should return default model matching when no model specified", async () => {
      const result = await getMatchingModel();

      expect(result).toBeDefined();
    });

    it("should use cache when available", async () => {
      const cachedMatchingModel = "cached-matching-model";
      mockCache.get.mockResolvedValueOnce(cachedMatchingModel);

      const result = await getMatchingModel("test-model", mockEnv);

      expect(result).toBe(cachedMatchingModel);
      expect(mockCache.get).toHaveBeenCalledWith("matching-model:test-model");
    });
  });

  describe("getModelConfigByMatchingModel", () => {
    it("should return model config for valid matching model", async () => {
      const result = await getModelConfigByMatchingModel("gpt-4o");

      expect(result).toBeDefined();
      expect(result.matchingModel).toBe("gpt-4o");
    });

    it("should return null for invalid matching model", async () => {
      const result = await getModelConfigByMatchingModel(
        "nonexistent-matching-model",
      );

      expect(result).toBeNull();
    });

    it("should use cache when available", async () => {
      const cachedConfig = mockModelConfig;
      mockCache.get.mockResolvedValueOnce(cachedConfig);

      const result = await getModelConfigByMatchingModel(
        "test-matching-model",
        mockEnv,
      );

      expect(result).toEqual(cachedConfig);
      expect(mockCache.get).toHaveBeenCalledWith(
        "model-by-matching:test-matching-model",
      );
    });
  });

  describe("getModels", () => {
    it("should return all non-beta models", () => {
      const result = getModels();

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.beta).not.toBe(true);
      }
    });

    it("should cache result on subsequent calls", () => {
      const result1 = getModels();
      const result2 = getModels();

      expect(result1).toBe(result2);
    });
  });

  describe("getFreeModels", () => {
    it("should return only free models", () => {
      const result = getFreeModels();

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.isFree).toBe(true);
      }
    });

    it("should cache result on subsequent calls", () => {
      const result1 = getFreeModels();
      const result2 = getFreeModels();

      expect(result1).toBe(result2);
    });
  });

  describe("getFeaturedModels", () => {
    it("should return only featured models", () => {
      const result = getFeaturedModels();

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.isFeatured).toBe(true);
      }
    });

    it("should cache result on subsequent calls", () => {
      const result1 = getFeaturedModels();
      const result2 = getFeaturedModels();

      expect(result1).toBe(result2);
    });
  });

  describe("getIncludedInRouterModels", () => {
    it("should return only router-included models", () => {
      const result = getIncludedInRouterModels();

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.includedInRouter).toBe(true);
      }
    });

    it("should cache result on subsequent calls", () => {
      const result1 = getIncludedInRouterModels();
      const result2 = getIncludedInRouterModels();

      expect(result1).toBe(result2);
    });
  });

  describe("getModelsByCapability", () => {
    it("should return models with specified capability", () => {
      const result = getModelsByCapability("coding");

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.strengths).toContain("coding");
      }
    });

    it("should return empty object for invalid capability", () => {
      const result = getModelsByCapability("nonexistent-capability");

      expect(result).toEqual({});
    });
  });

  describe("getModelsByType", () => {
    it("should return models with specified type", () => {
      const result = getModelsByType("text");

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");

      for (const [_key, model] of Object.entries(result)) {
        expect(model.type).toContain("text");
      }
    });

    it("should return empty object for invalid type", () => {
      const result = getModelsByType("nonexistent-type");

      expect(result).toEqual({});
    });
  });

  describe("filterModelsForUserAccess", () => {
    const testModels = {
      "free-model": {
        ...mockFreeModel,
        provider: "always-enabled-provider",
      },
      "paid-model": {
        ...mockModelConfig,
        provider: "paid-provider",
        isFree: false,
      },
      "always-enabled-model": {
        ...mockModelConfig,
        provider: "always-enabled-provider",
        isFree: false,
      },
    };

    it("should return free and always-enabled models for anonymous users", async () => {
      const result = await filterModelsForUserAccess(testModels, mockEnv);

      expect(result).toHaveProperty("free-model");
      expect(result).toHaveProperty("always-enabled-model");
      expect(result).not.toHaveProperty("paid-model");
    });

    it("should return models based on user provider settings", async () => {
      mockDatabase.getUserProviderSettings.mockResolvedValue([
        { provider_id: "paid-provider", enabled: true },
      ]);

      const result = await filterModelsForUserAccess(
        testModels,
        mockEnv,
        mockUser.id,
      );

      expect(result).toHaveProperty("free-model");
      expect(result).toHaveProperty("paid-model");
      expect(result).toHaveProperty("always-enabled-model");
    });

    it("should exclude disabled provider models", async () => {
      mockDatabase.getUserProviderSettings.mockResolvedValue([
        { provider_id: "paid-provider", enabled: false },
      ]);

      const result = await filterModelsForUserAccess(
        testModels,
        mockEnv,
        mockUser.id,
      );

      expect(result).toHaveProperty("free-model");
      expect(result).not.toHaveProperty("paid-model");
      expect(result).toHaveProperty("always-enabled-model");
    });

    it("should use cache when available", async () => {
      const cachedModels = { "cached-model": mockModelConfig };
      mockCache.get.mockResolvedValueOnce(cachedModels);

      const result = await filterModelsForUserAccess(
        testModels,
        mockEnv,
        mockUser.id,
      );

      expect(result).toEqual(cachedModels);
      expect(mockCache.get).toHaveBeenCalledWith("user-models:123");
    });

    it("should handle database errors gracefully", async () => {
      mockDatabase.getUserProviderSettings.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await filterModelsForUserAccess(
        testModels,
        mockEnv,
        mockUser.id,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should work without cache", async () => {
      const envWithoutCache = {
        ALWAYS_ENABLED_PROVIDERS: "always-enabled-provider",
      };

      const result = await filterModelsForUserAccess(
        testModels,
        envWithoutCache as any,
      );

      expect(result).toHaveProperty("free-model");
      expect(result).toHaveProperty("always-enabled-model");
    });
  });

  // TODO: fix these
  describe.skip("getAuxiliaryModel", () => {
    it("should return default model when no groq models available", async () => {
      const result = await getAuxiliaryModel(mockEnv, mockUser);

      expect(result.model).toBe("@cf/google/gemma-3-12b-it");
      expect(result.provider).toBeDefined();
    });

    it("should prefer groq model when available", async () => {
      mockDatabase.getUserProviderSettings.mockResolvedValue([
        { provider_id: "groq", enabled: true },
      ]);

      const result = await getAuxiliaryModel(mockEnv, mockUser);

      expect(result.model).toBe("llama-3.3-70b-versatile");
      expect(result.provider).toBe("groq");
    });
  });

  // TODO: fix these
  describe.skip("getAuxiliaryModelForRetrieval", () => {
    it("should return default model when no perplexity models available", async () => {
      const result = await getAuxiliaryModelForRetrieval(mockEnv, mockUser);

      expect(result.model).toBe("@cf/google/gemma-3-12b-it");
      expect(result.provider).toBeDefined();
    });

    it("should prefer perplexity model when available", async () => {
      mockDatabase.getUserProviderSettings.mockResolvedValue([
        { provider_id: "perplexity-ai", enabled: true },
      ]);

      const result = await getAuxiliaryModelForRetrieval(mockEnv, mockUser);

      expect(result.model).toBe("sonar");
      expect(result.provider).toBe("perplexity-ai");
    });
  });

  // TODO: fix these
  describe.skip("getAuxiliaryGuardrailsModel", () => {
    it("should return default model when no groq models available", async () => {
      const result = await getAuxiliaryGuardrailsModel(mockEnv, mockUser);

      expect(result.model).toBe("@cf/meta/llama-guard-3-8b");
      expect(result.provider).toBe("workers-ai");
    });

    it("should prefer groq model when available", async () => {
      mockDatabase.getUserProviderSettings.mockResolvedValue([
        { provider_id: "groq", enabled: true },
      ]);

      const result = await getAuxiliaryGuardrailsModel(mockEnv, mockUser);

      expect(result.model).toBe("meta-llama/llama-guard-4-12b");
      expect(result.provider).toBe("groq");
    });
  });

  describe("caching behavior", () => {
    it("should work without cache when cache get fails", async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await getModelConfig("gpt-4o", mockEnv);

      expect(result).toBeDefined();
      expect(result.provider).toBe("openai");
    });

    it("should not cache null or undefined results", async () => {
      const result = await getModelConfigByModel("nonexistent-model", mockEnv);

      expect(result).toBeUndefined();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });
});
