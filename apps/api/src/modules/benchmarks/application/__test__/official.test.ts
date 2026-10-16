import { getBenchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import type { BenchmarkEntrant, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const models: Record<string, ModelConfigItem> = {};

  return { models, filterModelsForUserAccess: vi.fn() };
});

vi.mock("@ngriffin_uk/polychat-ai-models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-models")>()),
  getModels: () => mocks.models,
}));

vi.mock("~/modules/models/application/resolve", () => ({
  filterModelsForUserAccess: mocks.filterModelsForUserAccess,
}));

vi.mock("~/modules/models/application/access", () => ({
  resolveExecutableModelForRequest: vi.fn(),
}));

vi.mock("../runner", () => ({ enqueueBenchmarkRunTask: vi.fn() }));

import type { IEnv } from "~/types";

import {
  credentialSourceFor,
  isDecisionModel,
  listOfficialModels,
  officialEntrant,
  officialRunRefusal,
  type OfficialModels,
} from "../entrants";
import { officialCandidateModelIds, officialEntrantsFor } from "../official";

const NOW = Date.parse("October 15, 2026");
const env: IEnv = Object.create(null);

function model(
  provider: string,
  matchingModel: string,
  name: string,
  extra: Partial<ModelConfigItem> = {},
): ModelConfigItem {
  return {
    provider,
    matchingModel,
    name,
    modalities: { input: ["text"], output: ["text"] },
    ...extra,
  };
}

function ownModels(ids: readonly string[]): OfficialModels {
  return Object.fromEntries(
    ids.map((id) => {
      const config = { ...mocks.models[id], id, isPlatformEnabled: true };

      return [id, { id, config, runsOnId: id, runsOn: config }];
    }),
  );
}

beforeEach(() => {
  for (const key of Object.keys(mocks.models)) {
    delete mocks.models[key];
  }

  Object.assign(mocks.models, {
    "claude-opus-5-5": model("anthropic", "claude-opus-5-5", "Claude Opus 5.5", {
      family: "claude",
      releaseDate: "September 22, 2026",
    }),
    "anthropic/claude-opus-5.5": model(
      "openrouter",
      "anthropic/claude-opus-5.5",
      "Claude Opus 5.5",
      {
        family: "claude",
        releaseDate: "September 22, 2026",
      },
    ),
    "gpt-6-astra": model("openai", "gpt-6-astra", "GPT-6 Astra", {
      family: "gpt",
      isFeatured: true,
      releaseDate: "September 4, 2026",
    }),
    "gpt-4o": model("openai", "gpt-4o", "GPT-4o", { family: "gpt", releaseDate: "August 6, 2024" }),
    "zai/glm-5.3-2": model("zai", "glm-5.3", "GLM 5.3", {
      family: "glm",
      catalogueModel: "glm/glm-5-3",
      releaseDate: "August 14, 2026",
    }),
    "@cf/zai-org/glm-5.3": model("workers-ai", "@cf/zai-org/glm-5.3", "GLM 5.3", {
      family: "glm",
      catalogueModel: "glm/glm-5-3",
      releaseDate: "August 14, 2026",
    }),
    "deepseek-v4-pro": model("deepseek", "deepseek-v4-pro", "DeepSeek V4 Pro", {
      family: "deepseek",
      releaseDate: "August 22, 2026",
    }),
    "alibaba/kimi-k3": model("alibaba", "kimi-k3", "Kimi K3", {
      family: "kimi-k3",
      releaseDate: "July 16, 2026",
    }),
    "jev-latest": model("typesafe", "jev-latest", "Jev", {
      family: "typesafe/jev",
      modalities: { input: ["text"], output: ["decision"] },
    }),
    "@cf/cloudflare/clef": model("workers-ai", "@cf/cloudflare/clef", "Clef", {
      family: "cloudflare/clef",
      modalities: { input: ["text"], output: ["decision"] },
    }),
  });
  mocks.filterModelsForUserAccess.mockReset();
});

describe("officialCandidateModelIds", () => {
  it("takes recent, featured and decision models from the labs' own APIs only", () => {
    const ids = officialCandidateModelIds(mocks.models, NOW);

    expect(ids).toEqual(
      expect.arrayContaining([
        "claude-opus-5-5",
        "gpt-6-astra",
        "zai/glm-5.3-2",
        "deepseek-v4-pro",
        "jev-latest",
        "@cf/cloudflare/clef",
      ]),
    );
    expect(ids).not.toContain("anthropic/claude-opus-5.5");
    expect(ids).not.toContain("@cf/zai-org/glm-5.3");
    expect(ids).not.toContain("alibaba/kimi-k3");
    expect(ids).not.toContain("gpt-4o");
  });
});

describe("isDecisionModel", () => {
  it("only counts models that answer in decisions and never in text", () => {
    expect(
      isDecisionModel({
        ...model("openai", "gpt-6-luna", "GPT-6 Luna"),
        modalities: { input: ["text"], output: ["text", "decision"] },
      }),
    ).toBe(false);
    expect(isDecisionModel(mocks.models["@cf/cloudflare/clef"])).toBe(true);
  });
});

describe("listOfficialModels", () => {
  it("runs a lab model on its Workers AI mirror when the lab key is missing", async () => {
    mocks.filterModelsForUserAccess.mockResolvedValue({
      "claude-opus-5-5": { ...mocks.models["claude-opus-5-5"], isPlatformEnabled: true },
      "gpt-6-astra": {
        ...mocks.models["gpt-6-astra"],
        isPlatformEnabled: false,
        isByokEnabled: false,
      },
      "@cf/zai-org/glm-5.3": { ...mocks.models["@cf/zai-org/glm-5.3"], isPlatformEnabled: true },
    });

    const models = await listOfficialModels(env, null);

    expect(models["claude-opus-5-5"]?.runsOnId).toBe("claude-opus-5-5");
    expect(credentialSourceFor(models["claude-opus-5-5"])).toBe("platform");
    expect(models["gpt-6-astra"]).toBeUndefined();

    const glm = models["zai/glm-5.3-2"];

    expect(glm?.runsOnId).toBe("@cf/zai-org/glm-5.3");
    expect(credentialSourceFor(glm)).toBe("mirror");
    expect(officialEntrant(glm)).toEqual({
      kind: "model",
      modelId: "zai/glm-5.3-2",
      provider: "zai",
      name: "GLM 5.3",
      via: { modelId: "@cf/zai-org/glm-5.3", provider: "workers-ai" },
    });
  });
});

describe("officialEntrantsFor", () => {
  it("leaves out lineup models the caller has no key for", () => {
    const models = ownModels(["claude-opus-5-5"]);

    expect(
      officialEntrantsFor(models, getBenchmark("countdown"), ["gpt-6-astra"], new Set()),
    ).toEqual([]);
  });

  it("keeps decision models to the benchmarks built for them", () => {
    const models = ownModels(["jev-latest", "claude-opus-5-5"]);
    const ids = (entrants: BenchmarkEntrant[]) =>
      entrants.map((entrant) => (entrant.kind === "model" ? entrant.modelId : null));

    expect(
      ids(officialEntrantsFor(models, getBenchmark("countdown"), Object.keys(models), new Set())),
    ).toEqual(["claude-opus-5-5"]);
    expect(
      ids(officialEntrantsFor(models, getBenchmark("long-odds"), Object.keys(models), new Set())),
    ).toEqual(["jev-latest", "claude-opus-5-5"]);
  });
});

describe("officialRunRefusal", () => {
  it("cancels an official run queued for a reseller instead of the lab", () => {
    const entrant: BenchmarkEntrant = {
      kind: "model",
      modelId: "anthropic/claude-opus-5.5",
      provider: "openrouter",
      name: "Claude Opus 5.5",
    };

    expect(officialRunRefusal({ scope: "official", entrant })).toMatch(/openrouter/);
    expect(officialRunRefusal({ scope: "personal", entrant })).toBeNull();
    expect(
      officialRunRefusal({
        scope: "official",
        entrant: { ...entrant, modelId: "claude-opus-5-5", provider: "anthropic" },
      }),
    ).toBeNull();
  });
});
