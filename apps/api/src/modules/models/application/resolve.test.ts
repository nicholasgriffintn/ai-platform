import {
  applyModelResponseDefaults,
  getModels,
  getModelsByOutputModality,
  type ModelResponseSettings,
} from "@ngriffin_uk/polychat-ai-models";
import {
  CARTESIA_REALTIME_DESCRIPTOR,
  ELEVENLABS_REALTIME_DESCRIPTOR,
  GOOGLE_REALTIME_DESCRIPTOR,
  MISTRAL_REALTIME_DESCRIPTOR,
  OPENAI_REALTIME_DESCRIPTOR,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  findModelByReference,
  isActiveModel,
  MODEL_TIER_LINEUP,
  MODEL_TIER_ROLES,
  MODEL_TIERS,
  type ModelConfigItem,
  SYSTEM_MODEL_LINEUP,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

const REALTIME_DESCRIPTORS = [
  OPENAI_REALTIME_DESCRIPTOR,
  GOOGLE_REALTIME_DESCRIPTOR,
  MISTRAL_REALTIME_DESCRIPTOR,
  ELEVENLABS_REALTIME_DESCRIPTOR,
  CARTESIA_REALTIME_DESCRIPTOR,
];

describe("model response defaults", () => {
  const modelConfig: ModelConfigItem = {
    matchingModel: "test-model",
    provider: "test-provider",
    reasoningConfig: {
      supportedEffortLevels: ["none", "low", "high"],
      defaultEffort: "low",
    },
    verbosityConfig: {
      supportedVerbosityLevels: ["low", "medium", "high"],
      defaultVerbosity: "medium",
    },
  };
  const emptyRequest: ModelResponseSettings = {};

  it("fills in the declared defaults when the request omits them", () => {
    expect(applyModelResponseDefaults(emptyRequest, modelConfig)).toEqual({
      reasoning_effort: "low",
      verbosity: "medium",
    });
  });

  it("never overrides an explicitly requested effort or verbosity", () => {
    expect(
      applyModelResponseDefaults({ reasoning_effort: "none", verbosity: "high" }, modelConfig),
    ).toEqual({ reasoning_effort: "none", verbosity: "high" });
  });

  it("ignores declared defaults the model does not list as supported", () => {
    expect(
      applyModelResponseDefaults(emptyRequest, {
        ...modelConfig,
        reasoningConfig: { supportedEffortLevels: ["none"], defaultEffort: "high" },
        verbosityConfig: { supportedVerbosityLevels: ["low"], defaultVerbosity: "high" },
      }),
    ).toEqual({});
  });
});

describe("central model policy catalogue", () => {
  it("classifies every reranking lineup candidate as a reranking model", () => {
    const rerankingModels = getModelsByOutputModality("reranking");
    const lineup = SYSTEM_MODEL_LINEUP.find((role) => role.id === "reranking");

    expect(lineup).toBeDefined();

    for (const candidate of lineup?.candidates ?? []) {
      expect(findModelByReference(rerankingModels, candidate)).not.toBeNull();
    }
  });

  it("keeps every served lineup candidate on an active catalogue model that supports its effort", () => {
    const models = getModels();
    const candidates = [
      ...(["hosted"] as const).flatMap((runtime) =>
        MODEL_TIERS.flatMap((tier) =>
          MODEL_TIER_ROLES.flatMap((role) =>
            MODEL_TIER_LINEUP[runtime][tier][role].map((candidate) => ({
              ...candidate,
              location: `${runtime}/${tier}/${role}`,
            })),
          ),
        ),
      ),
      ...SYSTEM_MODEL_LINEUP.flatMap((role) =>
        role.candidates.map((candidate) => ({ ...candidate, location: `system/${role.id}` })),
      ),
    ];
    const problems: string[] = [];

    expect(candidates.length).toBeGreaterThan(0);

    for (const candidate of candidates) {
      const entry = findModelByReference(models, candidate);
      const label = `${candidate.location}: ${candidate.provider}/${candidate.model}`;

      if (!entry) {
        problems.push(`${label} is absent from the catalogue`);
        continue;
      }

      if (!isActiveModel(entry.config)) {
        problems.push(`${label} is inactive`);
      }

      if (!candidate.effort) {
        continue;
      }

      const supported = entry.config.reasoningConfig?.supportedEffortLevels ?? [];

      if (!supported.includes(candidate.effort)) {
        problems.push(
          `${label} prescribes effort ${candidate.effort} but supports ${
            supported.length ? supported.join(", ") : "no effort levels"
          }`,
        );
      }
    }

    expect(problems).toEqual([]);
  });

  it("resolves every realtime default to an active model from the expected provider", () => {
    const models = getModels();

    for (const reference of REALTIME_DESCRIPTORS) {
      const entry = models[reference.defaultModelId];

      if (!entry) {
        throw new Error(`${reference.id}:${reference.defaultModelId} is absent from the catalogue`);
      }

      expect(entry.provider, reference.defaultModelId).toBe(reference.id);
      expect(isActiveModel(entry), `${reference.defaultModelId} is inactive`).toBe(true);
    }
  });
});
