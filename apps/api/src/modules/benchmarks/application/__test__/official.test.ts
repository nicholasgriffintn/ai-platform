import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  models: {} as Record<string, ModelConfigItem>,
  enqueue: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  getModels: () => mocks.models,
}));

vi.mock("@ngriffin_uk/polychat-ai-providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-providers")>()),
  isProviderPlatformEnabled: () => true,
}));

vi.mock("../runner", () => ({ enqueueBenchmarkRunTask: mocks.enqueue }));

import type { IEnv } from "~/types";

import { officialCandidateModelIds, queueOfficialRuns } from "../official";

function model(provider: string, matchingModel: string, name: string): ModelConfigItem {
  return {
    id: matchingModel,
    provider,
    matchingModel,
    name,
    modalities: { input: ["text"], output: ["text"] },
  } as unknown as ModelConfigItem;
}

const env = {} as IEnv;

beforeEach(() => {
  mocks.enqueue.mockReset();
  mocks.models = {
    "claude-opus-5-5": model("anthropic", "claude-opus-5-5", "Claude Opus 5.5"),
    "anthropic/claude-opus-5.5": model(
      "openrouter",
      "anthropic/claude-opus-5.5",
      "Claude Opus 5.5",
    ),
    "gpt-6-astra": model("openai", "gpt-6-astra", "GPT-6 Astra"),
    "@cf/zai-org/glm-5.3": model("workers-ai", "@cf/zai-org/glm-5.3", "GLM 5.3"),
    "deepseek-v4-pro": model("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro"),
  };
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

describe("queueOfficialRuns", () => {
  it("refuses explicitly requested models outside the approved providers", async () => {
    const created: string[] = [];
    const repositories = {
      benchmarkRuns: {
        officialSpendSince: vi.fn().mockResolvedValue(0),
        listOfficialEntrantKeys: vi.fn().mockResolvedValue(new Set<string>()),
        create: vi.fn(async (input: { entrant: { kind: string; modelId?: string } }) => {
          created.push(input.entrant.modelId ?? "");

          return {
            id: `run-${created.length}`,
            benchmark_id: "countdown",
            version: 1,
            entrant: input.entrant,
            entrant_key: `model:${input.entrant.modelId}`,
            scope: "official",
            status: "queued",
            visibility: "public",
            items_total: 1,
            items_completed: 0,
            score: null,
            metrics: {},
            rating: null,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: null,
            latency_p50_ms: null,
            share_token: null,
            failure_reason: null,
            created_at: "2026-01-01 00:00:00",
            completed_at: null,
          };
        }),
      },
    };

    const result = await queueOfficialRuns(env, repositories as never, {
      benchmarkIds: ["countdown"],
      modelIds: ["claude-opus-5-5", "anthropic/claude-opus-5.5", "@cf/zai-org/glm-5.3"],
    });

    expect(created).toEqual(["claude-opus-5-5"]);
    expect(result.queued).toHaveLength(1);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });
});
