import { describe, expect, it } from "vitest";

import { openaiModelConfig } from "~/data-model/models/openai";
import type { ChatCompletionParameters } from "~/types";

import { shouldUseOpenAIResponsesApi } from "./openaiResponses";

const baseParams = {
  model: "test",
  messages: [],
} as unknown as ChatCompletionParameters;

describe("shouldUseOpenAIResponsesApi", () => {
  it("forces the responses API for models that only support it", () => {
    for (const modelId of ["gpt-5.3-codex", "gpt-5-codex", "codex-mini-latest", "gpt-5-pro"]) {
      const modelConfig = openaiModelConfig[modelId];

      expect(modelConfig, `${modelId} is missing from the catalogue`).toBeDefined();
      expect(shouldUseOpenAIResponsesApi(baseParams, modelConfig), modelId).toBe(true);
    }
  });

  it("keeps chat completions for models that do not require the responses API", () => {
    const modelConfig = openaiModelConfig["gpt-5.2"];

    expect(shouldUseOpenAIResponsesApi(baseParams, modelConfig)).toBe(false);
    expect(shouldUseOpenAIResponsesApi({ ...baseParams, use_responses: true }, modelConfig)).toBe(
      true,
    );
  });

  it("does not force the responses API for non-text output models", () => {
    const imageModel = openaiModelConfig["gpt-image-2"];

    expect(shouldUseOpenAIResponsesApi({ ...baseParams, use_responses: true }, imageModel)).toBe(
      false,
    );
  });
});
