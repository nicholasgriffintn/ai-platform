import { describe, expect, it } from "vitest";

import {
  clearModelResponseSettings,
  migrateChatStore,
  migrateLegacyMaxOutputTokens,
  migrateLegacySamplingDefaults,
} from "./chat-settings";

describe("chat response token defaults", () => {
  it("drops the previous model's response settings but keeps the rest", () => {
    expect(
      clearModelResponseSettings({
        max_tokens: 65_536,
        temperature: 0.7,
        reasoning: { effort: "high" },
        verbosity: "low",
      }),
    ).toEqual({ max_tokens: 65_536, temperature: 0.7 });
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

describe("chat sampling defaults", () => {
  it("returns the old persisted sampling defaults to automatic", () => {
    expect(
      migrateLegacySamplingDefaults(
        {
          chatSettings: {
            temperature: 0.7,
            top_p: 0.8,
            presence_penalty: 0,
            frequency_penalty: 0,
            enabled_tools: [],
          },
        },
        0,
      ),
    ).toEqual({ chatSettings: { enabled_tools: [] } });
  });

  it("keeps values the user chose deliberately", () => {
    expect(
      migrateLegacySamplingDefaults(
        { chatSettings: { temperature: 1.2, top_p: 0.8, presence_penalty: 0.4 } },
        0,
      ),
    ).toEqual({ chatSettings: { temperature: 1.2, presence_penalty: 0.4 } });
  });

  it("leaves already-migrated state alone", () => {
    const persistedState = { chatSettings: { temperature: 0.7 } };

    expect(migrateLegacySamplingDefaults(persistedState, 2)).toBe(persistedState);
  });

  it("strips the legacy token and sampling defaults in one pass", () => {
    expect(
      migrateChatStore({ chatSettings: { max_tokens: 8_192, temperature: 0.7, top_p: 0.5 } }, 0),
    ).toEqual({ chatSettings: { top_p: 0.5 } });
  });
});
