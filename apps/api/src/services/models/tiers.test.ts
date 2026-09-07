import {
  MODEL_LINEUP_RUNTIMES,
  MODEL_TIER_LINEUP,
  modelTiersResponseSchema,
  type ModelConfig,
  type ModelConfigItem,
  type ModelLineupCandidate,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { resolveTierLineup } from "./tiers";

function modelForCandidate(
  candidate: ModelLineupCandidate,
  overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem {
  return {
    id: candidate.model,
    matchingModel: candidate.model,
    name: `Display ${candidate.model}`,
    provider: candidate.provider,
    modalities: { input: ["text"], output: ["text"] },
    isFree: false,
    isPlatformEnabled: true,
    isByokEnabled: false,
    ...overrides,
  };
}

function modelsForMediumAgent(
  overrides: (candidate: ModelLineupCandidate, index: number) => Partial<ModelConfigItem>,
): ModelConfig {
  return Object.fromEntries(
    MODEL_TIER_LINEUP.hosted.medium.agent.map((candidate, index) => [
      candidate.model,
      modelForCandidate(candidate, overrides(candidate, index)),
    ]),
  );
}

describe("resolveTierLineup", () => {
  it("resolves the first executable candidate for free, Pro and BYOK accounts", () => {
    const candidates = MODEL_TIER_LINEUP.hosted.medium.agent;
    const primary = candidates[0];
    const freeFallback = candidates.at(-1);

    expect(primary).toBeDefined();
    expect(freeFallback).toBeDefined();

    const freeModels = modelsForMediumAgent((candidate) => ({
      isFree: candidate.model === freeFallback?.model,
    }));
    const free = resolveTierLineup(freeModels, { plan_id: "free" });
    const pro = resolveTierLineup(freeModels, { plan_id: "pro" });
    const byokModels = {
      [primary.model]: modelForCandidate(primary, {
        isPlatformEnabled: false,
        isByokEnabled: true,
      }),
    };
    const byok = resolveTierLineup(byokModels, { plan_id: "free" });

    expect(free.runtimes.hosted.medium.agent?.id).toBe(freeFallback?.model);
    expect(pro.runtimes.hosted.medium.agent?.id).toBe(primary?.model);
    expect(byok.runtimes.hosted.medium.agent?.id).toBe(primary?.model);
  });

  it("returns explicit empty slots for runtimes with no executable candidates", () => {
    const primary = MODEL_TIER_LINEUP.hosted.medium.agent[0];
    const result = resolveTierLineup(
      { [primary.model]: modelForCandidate(primary, { isFree: true }) },
      undefined,
    );

    expect(modelTiersResponseSchema.parse(result)).toEqual(result);
    expect(Object.keys(result.runtimes)).toEqual(MODEL_LINEUP_RUNTIMES);
    expect(result.runtimes.hosted.medium.agent?.id).toBe(primary.model);
    expect(result.runtimes.browser.medium.agent).toBeNull();
    expect(result.runtimes.device.medium.agent).toBeNull();
    expect(result.runtimes.machine.medium.agent).toBeNull();
  });
});
