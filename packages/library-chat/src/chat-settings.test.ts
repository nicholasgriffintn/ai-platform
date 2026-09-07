import { describe, expect, it } from "vitest";

import {
  clearModelResponseSettings,
  migrateChatStore,
  migrateLegacyAutoMode,
  migrateComputeSite,
  migrateLegacyMaxOutputTokens,
  migrateLegacySamplingDefaults,
} from "./chat-settings.js";
import { setDeviceModelSource } from "./device-models.js";

describe("chat response token defaults", () => {
  it("drops the previous model's response settings but keeps the rest", () => {
    expect(
      clearModelResponseSettings({
        max_tokens: 65_536,
        temperature: 0.7,
        reasoning: { effort: "high" },
        service_tier: "fast",
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
    ).toEqual({
      chatSettings: { top_p: 0.5 },
      chatMode: "chat",
      computeSite: "hosted",
    });
  });
});

describe("model tier migration", () => {
  it("maps the retired automatic modes onto tiers and drops the old key", () => {
    expect(migrateLegacyAutoMode({ autoMode: "pro", model: null }, 2)).toEqual({
      model: null,
      modelTier: "high",
    });
    expect(migrateLegacyAutoMode({ autoMode: "auto" }, 2)).toEqual({ modelTier: null });
  });

  it("leaves already migrated state alone", () => {
    const persistedState = { modelTier: "low" };

    expect(migrateLegacyAutoMode(persistedState, 3)).toBe(persistedState);
    expect(migrateChatStore({ chatSettings: {}, modelTier: "ultra" }, 3)).toEqual({
      chatSettings: {},
      modelTier: "ultra",
      chatMode: "chat",
      computeSite: "hosted",
    });
  });
});

describe("storage mode migration", () => {
  it("drops local-only mode while extending the existing v4 migration", () => {
    const persistedState = {
      localOnlyMode: true,
      chatMode: "remote",
      chatSettings: { enabled_tools: [] },
    };

    expect(migrateChatStore(persistedState, 3)).toEqual({
      chatSettings: { enabled_tools: [] },
      chatMode: "chat",
      computeSite: "hosted",
    });
  });

  it("leaves a v4 store alone", () => {
    const persistedState = { chatMode: "chat", computeSite: "hosted" };

    expect(migrateComputeSite(persistedState, 4)).toBe(persistedState);
  });
});

describe("compute site migration", () => {
  it.each([
    ["remote", "chat", "hosted"],
    ["local", "chat", "browser"],
    ["chat", "chat", "hosted"],
    ["tool", "tool", "hosted"],
    ["agent", "agent", "hosted"],
  ] as const)("maps %s to %s on %s", (legacyMode, chatMode, computeSite) => {
    expect(migrateComputeSite({ chatMode: legacyMode }, 3)).toEqual({
      chatMode,
      computeSite,
    });
  });

  it("maps a legacy local mode to the device when a device runtime exists", () => {
    setDeviceModelSource(async () => ({}));

    try {
      expect(migrateComputeSite({ chatMode: "local" }, 3)).toEqual({
        chatMode: "chat",
        computeSite: "device",
      });
    } finally {
      setDeviceModelSource(null);
    }
  });

  it("preserves a valid compute site already present in an older persisted state", () => {
    const persistedState = { chatMode: "chat", computeSite: "machine" };

    expect(migrateComputeSite(persistedState, 3)).toEqual(persistedState);
  });
});
