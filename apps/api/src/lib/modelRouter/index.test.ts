import type { ModelConfigItem, PromptRequirements } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const mocks = vi.hoisted(() => ({
  analyzePrompt: vi.fn(),
  getIncludedInRouterModelsForUser: vi.fn(),
}));

vi.mock("~/lib/modelRouter/promptAnalyser", () => ({
  PromptAnalyzer: { analyzePrompt: mocks.analyzePrompt },
}));
vi.mock("~/lib/monitoring", () => ({
  trackModelRoutingMetrics: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("~/lib/providers/models", () => ({
  defaultModel: "default-model",
  getIncludedInRouterModelsForUser: mocks.getIncludedInRouterModelsForUser,
  getModels: vi.fn(() => ({})),
}));

import { ModelRouter } from ".";

const env: IEnv = Object.create(null);
const requirements: PromptRequirements = {
  expectedComplexity: 3,
  requiredStrengths: ["chat"],
  criticalStrengths: [],
  estimatedInputTokens: 100,
  estimatedOutputTokens: 100,
  hasImages: false,
  hasDocuments: false,
  needsFunctions: false,
};

function makeModel(id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    id,
    name: id,
    matchingModel: id,
    provider: "test",
    modalities: { input: ["text"], output: ["text"] },
    contextComplexity: 3,
    reliability: 4,
    speed: 3,
    strengths: ["chat"],
    isFree: true,
    ...overrides,
  };
}

describe("ModelRouter automatic modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.analyzePrompt.mockResolvedValue(requirements);
  });

  it("uses the preferred mode pool when it has a suitable model", async () => {
    mocks.getIncludedInRouterModelsForUser.mockResolvedValue({
      "lite-model": makeModel("lite-model", {
        speed: 5,
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.001,
      }),
      "standard-model": makeModel("standard-model", {
        contextComplexity: 4,
        reliability: 5,
      }),
    });

    await expect(
      ModelRouter.selectModel(env, "hello", [], undefined, undefined, "1", "lite"),
    ).resolves.toBe("lite-model");
  });

  it("falls back to an accessible model when the preferred mode pool is empty", async () => {
    mocks.getIncludedInRouterModelsForUser.mockResolvedValue({
      "standard-model": makeModel("standard-model", {
        contextComplexity: 4,
        reliability: 5,
      }),
    });

    await expect(
      ModelRouter.selectModel(env, "hello", [], undefined, undefined, "1", "lite"),
    ).resolves.toBe("standard-model");
  });

  it("falls back when preferred models cannot satisfy the prompt requirements", async () => {
    mocks.analyzePrompt.mockResolvedValue({ ...requirements, needsFunctions: true });
    mocks.getIncludedInRouterModelsForUser.mockResolvedValue({
      "lite-model": makeModel("lite-model", {
        speed: 5,
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.001,
        supportsToolCalls: false,
      }),
      "tool-model": makeModel("tool-model", {
        contextComplexity: 4,
        supportsToolCalls: true,
      }),
    });

    await expect(
      ModelRouter.selectModel(env, "use a tool", [], undefined, undefined, "1", "lite"),
    ).resolves.toBe("tool-model");
  });

  it("uses the accessible fallback pool for multi-model routing", async () => {
    mocks.getIncludedInRouterModelsForUser.mockResolvedValue({
      "standard-model": makeModel("standard-model", {
        contextComplexity: 4,
        reliability: 5,
      }),
    });

    await expect(
      ModelRouter.selectMultipleModels(env, "hello", [], undefined, undefined, "1", "lite"),
    ).resolves.toEqual(["standard-model"]);
  });

  it("still fails when no accessible model can satisfy the prompt", async () => {
    mocks.analyzePrompt.mockResolvedValue({ ...requirements, needsFunctions: true });
    mocks.getIncludedInRouterModelsForUser.mockResolvedValue({
      "lite-model": makeModel("lite-model", {
        speed: 5,
        costPer1kInputTokens: 0.001,
        costPer1kOutputTokens: 0.001,
        supportsToolCalls: false,
      }),
    });

    await expect(
      ModelRouter.selectModel(env, "use a tool", [], undefined, undefined, "1", "lite"),
    ).rejects.toThrow("No suitable models found for lite automatic mode.");
  });
});
