import { describe, expect, it } from "vitest";

import {
  MODEL_LINEUP_RUNTIMES,
  MODEL_TIER_LINEUP,
  MODEL_TIERS,
  MODEL_TIER_ROLES,
  SYSTEM_MODEL_LINEUP,
  isLineupEligibleModel,
  resolveLineupReasoningEffort,
  resolveModelTierAlternate,
  resolveModelTierSelection,
} from "./model-lineup";
import type { ModelConfig, ModelConfigItem } from "./models";

function model(id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    id,
    matchingModel: id,
    name: id,
    provider: "anthropic",
    modalities: { input: ["text"], output: ["text"] },
    ...overrides,
  };
}

describe("model lineup", () => {
  it("declares at least one candidate for every runtime, tier and role", () => {
    for (const runtime of MODEL_LINEUP_RUNTIMES) {
      for (const tier of MODEL_TIERS) {
        for (const role of MODEL_TIER_ROLES) {
          expect(MODEL_TIER_LINEUP[runtime][tier][role].length).toBeGreaterThan(0);
        }
      }
    }

    for (const role of SYSTEM_MODEL_LINEUP) {
      expect(role.candidates.length).toBeGreaterThan(0);
    }
  });

  it("walks the hierarchy until it finds a model the account can execute", () => {
    const executable: ModelConfig = {
      "google-ai-studio/gemini-3.5-flash": model("google-ai-studio/gemini-3.5-flash", {
        provider: "google-ai-studio",
        isFree: true,
        reasoningConfig: { supportedEffortLevels: ["minimal", "low", "medium", "high"] },
      }),
    };

    const selection = resolveModelTierSelection(executable, "hosted", "ultra", "agent");

    expect(selection?.id).toBe("google-ai-studio/gemini-3.5-flash");
    expect(selection?.effort).toBe("high");
  });

  it("prefers the first candidate once the account can execute it", () => {
    const executable: ModelConfig = {
      "gpt-6-astra": model("gpt-6-astra", {
        provider: "openai",
        reasoningConfig: { supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
      }),
      "google-ai-studio/gemini-3.5-flash": model("google-ai-studio/gemini-3.5-flash", {
        provider: "google-ai-studio",
        isFree: true,
      }),
    };

    expect(resolveModelTierSelection(executable, "hosted", "ultra", "agent")?.id).toBe(
      "gpt-6-astra",
    );
  });

  it("matches provider-scoped upstream identifiers without treating a shared id as authority", () => {
    const executable: ModelConfig = {
      "zai/glm-5.3-flash-2": model("zai/glm-5.3-flash-2", {
        provider: "zai",
        matchingModel: "glm-5.3-flash",
        reasoningConfig: { supportedEffortLevels: ["low", "high", "max"] },
      }),
      "other/glm-5.3-flash": model("other/glm-5.3-flash", {
        provider: "other",
        matchingModel: "glm-5.3-flash",
      }),
    };

    const selection = resolveModelTierSelection(executable, "hosted", "low", "agent");

    expect(selection?.id).toBe("zai/glm-5.3-flash-2");
    expect(selection?.effort).toBe("low");
  });

  it("returns nothing when no candidate is executable or eligible", () => {
    expect(resolveModelTierSelection({}, "hosted", "medium", "agent")).toBeNull();

    const imageOnly: ModelConfig = {
      "claude-opus-5": model("claude-opus-5", {
        modalities: { input: ["text"], output: ["image"] },
      }),
    };

    expect(
      resolveModelTierSelection(imageOnly, "hosted", "high", "agent", {
        isEligible: isLineupEligibleModel,
      }),
    ).toBeNull();
  });

  it("chooses a comparison alternate from a different provider and family", () => {
    const executable: ModelConfig = {
      "gpt-6-astra": model("gpt-6-astra", { provider: "openai", family: "gpt-astra" }),
      "openai/gpt-6-astra": model("openai/gpt-6-astra", {
        provider: "openrouter",
        family: "gpt-astra",
      }),
      "claude-fable-5-1": model("claude-fable-5-1", { family: "claude-fable" }),
    };
    const primary = resolveModelTierSelection(executable, "hosted", "ultra", "agent");

    expect(primary?.id).toBe("gpt-6-astra");
    expect(resolveModelTierAlternate(executable, "hosted", "ultra", "agent", primary!)?.id).toBe(
      "claude-fable-5-1",
    );
  });

  it("maps a tier effort onto what the model supports", () => {
    expect(
      resolveLineupReasoningEffort(
        { reasoningConfig: { supportedEffortLevels: ["low", "high", "max"] } },
        "medium",
      ),
    ).toBe("low");
    expect(
      resolveLineupReasoningEffort(
        { reasoningConfig: { supportedEffortLevels: ["none", "thinking"] } },
        "high",
      ),
    ).toBe("thinking");
    expect(resolveLineupReasoningEffort({}, "high")).toBeUndefined();
    expect(
      resolveLineupReasoningEffort(
        { reasoningConfig: { supportedEffortLevels: ["low", "medium", "high"] } },
        undefined,
      ),
    ).toBeUndefined();
  });
});
