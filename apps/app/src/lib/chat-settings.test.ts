import { describe, expect, it } from "vitest";

import { applyModelResponseDefaults, migrateLegacyMaxOutputTokens } from "./chat-settings";

describe("chat response token defaults", () => {
  it("preserves an explicit output-token override when the model changes", () => {
    expect(
      applyModelResponseDefaults(
        { max_tokens: 65_536 },
        {
          matchingModel: "reasoning-model",
          provider: "test-provider",
          maxTokens: 131_072,
          reasoningConfig: {
            supportedEffortLevels: ["low", "medium", "high"],
            defaultEffort: "medium",
          },
        },
      ).max_tokens,
    ).toBe(65_536);
  });

  it("returns the old persisted 8,192 default to automatic", () => {
    expect(
      migrateLegacyMaxOutputTokens({ chatSettings: { max_tokens: 8_192, temperature: 0.7 } }, 0),
    ).toEqual({ chatSettings: { temperature: 0.7 } });
  });

  it("keeps larger persisted overrides", () => {
    const persistedState = { chatSettings: { max_tokens: 65_536 } };

    expect(migrateLegacyMaxOutputTokens(persistedState, 0)).toBe(persistedState);
  });
});
