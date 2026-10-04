import { describe, expect, it } from "vitest";

import { buildUpdateValues } from "./model-values.mjs";

const xhighEffort = [
  { type: "toggle" },
  { type: "effort", values: ["low", "medium", "high", "xhigh"] },
];

function buildValues(remoteModel) {
  return buildUpdateValues(remoteModel, {
    modelKey: remoteModel.id,
    existingMatchingModel: remoteModel.id,
    allowMatchingModelUpdate: false,
    isNewEntry: false,
    includeProvider: false,
    provider: "openrouter",
    existingReasoningConfig: undefined,
  });
}

describe("buildUpdateValues Claude sampling rules", () => {
  it("strips sampling and adds max for xhigh-capable Claude models even when models.dev advertises temperature", () => {
    const values = buildValues({
      id: "anthropic/claude-opus-5",
      name: "Claude Opus 5",
      family: "claude-opus",
      temperature: true,
      reasoning: true,
      reasoning_options: xhighEffort,
    });

    expect(values.supportsTemperature).toBe(false);
    expect(values.supportsTopP).toBe(false);
    expect(values.reasoningConfig?.supportedEffortLevels).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
  });

  it("keeps models.dev sampling metadata for Claude models without xhigh", () => {
    const values = buildValues({
      id: "anthropic/claude-opus-4.6",
      name: "Claude Opus 4.6",
      family: "claude-opus",
      temperature: true,
      reasoning: true,
      reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "max"] }],
    });

    expect(values.supportsTemperature).toBe(true);
    expect(values).not.toHaveProperty("supportsTopP");
  });

  it("keeps models.dev sampling metadata for non-Claude xhigh models", () => {
    const values = buildValues({
      id: "x-ai/grok-4.6",
      name: "Grok 4.6",
      family: "grok",
      temperature: true,
      reasoning: true,
      reasoning_options: xhighEffort,
    });

    expect(values.supportsTemperature).toBe(true);
    expect(values).not.toHaveProperty("supportsTopP");
    expect(values.reasoningConfig?.supportedEffortLevels).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });
});

describe("buildUpdateValues model contract overrides", () => {
  it("removes the unsupported none effort from GPT-5.3-Codex", () => {
    const values = buildUpdateValues(
      {
        id: "gpt-5.3-codex",
        reasoning: true,
        reasoning_options: [{ type: "effort", values: ["none", "low", "medium", "high", "xhigh"] }],
      },
      {
        modelKey: "gpt-5.3-codex",
        existingMatchingModel: "gpt-5.3-codex",
        allowMatchingModelUpdate: false,
        isNewEntry: false,
        includeProvider: false,
        provider: "openai",
        existingReasoningConfig: {
          supportedEffortLevels: ["low", "medium", "high", "xhigh"],
          defaultEffort: "medium",
        },
      },
    );

    expect(values.reasoningConfig).toEqual({
      supportedEffortLevels: ["low", "medium", "high", "xhigh"],
      defaultEffort: "medium",
    });
  });
});

describe("Clef decision contracts", () => {
  it.each(["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"])(
    "keeps %s out of chat when upstream advertises text generation",
    (id) => {
      const values = buildUpdateValues(
        {
          id,
          name: "Clef",
          temperature: true,
          tool_call: true,
          attachment: true,
          modalities: { input: ["text", "image"], output: ["text"] },
          limit: { context: 65536, output: 4096 },
        },
        {
          modelKey: id,
          existingMatchingModel: id,
          allowMatchingModelUpdate: false,
          isNewEntry: false,
          includeProvider: false,
          provider: "workers-ai",
        },
      );

      expect(values.modalities).toEqual({ input: ["text"], output: ["decision"] });
      expect(values.supportsAttachments).toBe(false);
      expect(values.supportsToolCalls).toBe(false);
      expect(values.supportsTemperature).toBe(false);
      expect(values.maxTokens).toBe(0);
    },
  );
});
