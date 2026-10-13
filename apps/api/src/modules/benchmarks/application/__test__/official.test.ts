import { getBenchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import type { BenchmarkEntrant, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const models: Record<string, ModelConfigItem> = {};

  return { models };
});

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  getModels: () => mocks.models,
}));

vi.mock("@ngriffin_uk/polychat-ai-providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-providers")>()),
  isProviderPlatformEnabled: () => true,
}));

import type { IEnv } from "~/types";

import { officialRunRefusal } from "../entrants";
import { officialCandidateModelIds, officialEntrantsFor } from "../official";

function model(provider: string, matchingModel: string, name: string): ModelConfigItem {
  return { provider, matchingModel, name, modalities: { input: ["text"], output: ["text"] } };
}

const env: IEnv = Object.create(null);

beforeEach(() => {
  for (const key of Object.keys(mocks.models)) {
    delete mocks.models[key];
  }

  Object.assign(mocks.models, {
    "claude-opus-5-5": model("anthropic", "claude-opus-5-5", "Claude Opus 5.5"),
    "anthropic/claude-opus-5.5": model(
      "openrouter",
      "anthropic/claude-opus-5.5",
      "Claude Opus 5.5",
    ),
    "gpt-6-astra": model("openai", "gpt-6-astra", "GPT-6 Astra"),
    "@cf/zai-org/glm-5.3": model("workers-ai", "@cf/zai-org/glm-5.3", "GLM 5.3"),
    "deepseek-v4-pro": model("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro"),
  });
});

describe("officialCandidateModelIds", () => {
  it("keeps lineup models from approved labs and drops aggregators", () => {
    const ids = officialCandidateModelIds(env);

    expect(ids).toContain("claude-opus-5-5");
    expect(ids).toContain("gpt-6-astra");
    expect(ids).toContain("deepseek-v4-pro");
    expect(ids).not.toContain("anthropic/claude-opus-5.5");
    expect(ids).not.toContain("@cf/zai-org/glm-5.3");
  });
});

describe("officialEntrantsFor", () => {
  it("refuses explicitly requested models outside the approved providers", () => {
    const entrants = officialEntrantsFor(
      env,
      getBenchmark("countdown"),
      ["claude-opus-5-5", "anthropic/claude-opus-5.5", "@cf/zai-org/glm-5.3"],
      new Set(),
    );

    expect(entrants.map((entrant) => (entrant.kind === "model" ? entrant.modelId : null))).toEqual([
      "claude-opus-5-5",
    ]);
  });
});

describe("officialRunRefusal", () => {
  it("cancels an official run queued for a provider outside the approved labs", () => {
    const entrant: BenchmarkEntrant = {
      kind: "model",
      modelId: "anthropic/claude-opus-5.5",
      provider: "openrouter",
      name: "Claude Opus 5.5",
    };

    expect(officialRunRefusal({ scope: "official", entrant })).toMatch(/openrouter/);
    expect(officialRunRefusal({ scope: "personal", entrant })).toBeNull();
  });
});
