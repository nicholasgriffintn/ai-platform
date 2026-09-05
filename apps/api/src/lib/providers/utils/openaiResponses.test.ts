import { describe, expect, it } from "vitest";

import { getProviderModels } from "~/lib/providers/models/catalogue";
import type { ChatCompletionParameters } from "~/types";

import { buildOpenAIResponsesBody, shouldUseOpenAIResponsesApi } from "./openaiResponses";

const baseParams = {
  model: "test",
  messages: [],
} as unknown as ChatCompletionParameters;

describe("shouldUseOpenAIResponsesApi", () => {
  it("forces the responses API for models that only support it", () => {
    for (const modelId of [
      "gpt-6-astra",
      "gpt-5.3-codex",
      "gpt-5-codex",
      "codex-mini-latest",
      "gpt-5-pro",
    ]) {
      const modelConfig = getProviderModels("openai")[modelId];

      expect(modelConfig, `${modelId} is missing from the catalogue`).toBeDefined();
      expect(shouldUseOpenAIResponsesApi(baseParams, modelConfig), modelId).toBe(true);
    }
  });

  it("keeps chat completions for models that do not require the responses API", () => {
    const modelConfig = getProviderModels("openai")["gpt-5.2"];

    expect(shouldUseOpenAIResponsesApi(baseParams, modelConfig)).toBe(false);
    expect(shouldUseOpenAIResponsesApi({ ...baseParams, use_responses: true }, modelConfig)).toBe(
      true,
    );
  });

  it("uses the responses API when a message contains a document", () => {
    const modelConfig = getProviderModels("openai")["gpt-5.6"];
    const params: ChatCompletionParameters = {
      ...baseParams,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Summarise this document" },
            {
              type: "document_url",
              document_url: {
                url: "data:application/pdf;base64,JVBERi0xLjQ=",
                name: "brief.pdf",
              },
            },
          ],
        },
      ],
    };

    expect(shouldUseOpenAIResponsesApi(params, modelConfig)).toBe(true);
  });

  it("uses the responses API for hosted tools", () => {
    const modelConfig = getProviderModels("openai")["gpt-5.4"];

    expect(
      shouldUseOpenAIResponsesApi(
        { ...baseParams, enabled_tools: ["code_execution"] },
        modelConfig,
      ),
    ).toBe(true);
  });

  it("uses the responses API for function tools with reasoning", () => {
    const modelConfig = getProviderModels("openai")["gpt-5.4"];

    expect(
      shouldUseOpenAIResponsesApi(
        {
          ...baseParams,
          enabled_tools: ["get_weather"],
          reasoning_effort: "medium",
        },
        modelConfig,
      ),
    ).toBe(true);
    expect(
      shouldUseOpenAIResponsesApi(
        {
          ...baseParams,
          enabled_tools: ["get_weather"],
          reasoning_effort: "none",
        },
        modelConfig,
      ),
    ).toBe(false);
  });

  it("prefers the responses API for GPT-5.5 and later reasoning requests", () => {
    for (const modelId of ["gpt-5.5", "gpt-5.6", "gpt-5.6-terra"]) {
      expect(
        shouldUseOpenAIResponsesApi(
          { ...baseParams, reasoning_effort: "medium" },
          getProviderModels("openai")[modelId],
        ),
        modelId,
      ).toBe(true);
    }
  });

  it("does not force the responses API for non-text output models", () => {
    const imageModel = getProviderModels("openai")["gpt-image-2"];

    expect(shouldUseOpenAIResponsesApi({ ...baseParams, use_responses: true }, imageModel)).toBe(
      false,
    );
  });
});

describe("current OpenAI model capabilities", () => {
  it("matches the reasoning defaults in the current model guidance", () => {
    expect(getProviderModels("openai")["gpt-4.1"].reasoningConfig).toBeUndefined();
    expect(getProviderModels("openai")["gpt-5"].reasoningConfig).toMatchObject({
      supportedEffortLevels: ["minimal", "low", "medium", "high"],
      defaultEffort: "medium",
    });
    expect(getProviderModels("openai")["gpt-5.1"].reasoningConfig?.defaultEffort).toBe("none");
    expect(getProviderModels("openai")["gpt-5.2"].reasoningConfig?.defaultEffort).toBe("none");
    expect(
      getProviderModels("openai")["gpt-5.3-codex"].reasoningConfig?.supportedEffortLevels,
    ).toEqual(["low", "medium", "high", "xhigh"]);
    expect(getProviderModels("openai")["gpt-5.4"].reasoningConfig?.defaultEffort).toBe("none");
    expect(getProviderModels("openai")["gpt-5.5"].reasoningConfig?.defaultEffort).toBe("medium");
    expect(getProviderModels("openai")["gpt-5.6"].reasoningConfig?.defaultEffort).toBe("medium");
    expect(getProviderModels("openai")["gpt-6-astra"].reasoningConfig).toMatchObject({
      supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultEffort: "medium",
    });
  });

  it("exposes Responses hosted tools on every GPT-5.6 model", () => {
    for (const modelId of ["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]) {
      const modelConfig = getProviderModels("openai")[modelId];
      const body = buildOpenAIResponsesBody(
        {
          ...baseParams,
          enabled_tools: ["code_execution", "hosted_shell", "computer_use"],
        },
        modelConfig,
      );

      expect(modelConfig, `${modelId} is missing from the catalogue`).toBeDefined();
      expect(body.tools, modelId).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "code_interpreter" }),
          expect.objectContaining({ type: "shell" }),
          expect.objectContaining({ type: "computer" }),
        ]),
      );
      expect(modelConfig.supportsToolSearch, modelId).toBe(true);
    }
  });

  it("exposes Fast processing only on supported OpenAI models", () => {
    for (const modelId of [
      "gpt-5.6",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-6-astra",
    ]) {
      expect(getProviderModels("openai")[modelId].supportedServiceTiers, modelId).toEqual([
        "default",
        "fast",
      ]);
    }

    expect(getProviderModels("openai")["gpt-5.5"].supportedServiceTiers).toBeUndefined();
  });

  it("forwards the selected service tier to the Responses API", () => {
    const body = buildOpenAIResponsesBody(
      { ...baseParams, service_tier: "fast" },
      getProviderModels("openai")["gpt-6-astra"],
    );

    expect(body.service_tier).toBe("fast");
  });

  it("keeps pro-model hosted tool restrictions accurate", () => {
    expect(getProviderModels("openai")["gpt-5.4-pro"]).toMatchObject({
      supportsCodeExecution: false,
      supportsComputerUse: true,
      supportsToolSearch: true,
    });
    expect(getProviderModels("openai")["gpt-5.4-pro"].supportsHostedShell).toBeUndefined();
    expect(getProviderModels("openai")["gpt-5.5-pro"]).toMatchObject({
      supportsCodeExecution: true,
      supportsHostedShell: true,
      supportsStreaming: false,
    });
    expect(getProviderModels("openai")["gpt-5.5-pro"].supportsComputerUse).toBeUndefined();
    expect(getProviderModels("openai")["gpt-5.5-pro"].supportsToolSearch).toBeUndefined();
  });

  it("requests Luna reasoning summaries and code interpreter outputs by default", () => {
    const body = buildOpenAIResponsesBody(
      {
        ...baseParams,
        enabled_tools: ["code_execution"],
        reasoning_effort: "medium",
      },
      getProviderModels("openai")["gpt-5.6-luna"],
    );

    expect(body.reasoning).toEqual({ effort: "medium", summary: "auto" });
    expect(body.include).toContain("code_interpreter_call.outputs");
  });

  it("honours explicit Responses output and reasoning overrides", () => {
    const body = buildOpenAIResponsesBody(
      {
        ...baseParams,
        enabled_tools: ["code_execution"],
        include_defaults: false,
        reasoning_effort: "medium",
        tool_options: { reasoning: { summary: "detailed" } },
      },
      getProviderModels("openai")["gpt-5.6-luna"],
    );

    expect(body.reasoning).toEqual({ effort: "medium", summary: "detailed" });
    expect(body.include).toBeUndefined();
  });

  it("sends the provider-native none effort for supported OpenAI models", () => {
    const body = buildOpenAIResponsesBody(
      { ...baseParams, reasoning_effort: "none" },
      getProviderModels("openai")["gpt-5.6"],
    );

    expect(body.reasoning).toEqual({ effort: "none" });
  });

  it("builds Astra requests with launch capabilities and safe parameter filtering", () => {
    const configurationUpdate = {
      type: "configuration_update",
      reasoning: { effort: "high" },
    };
    const body = buildOpenAIResponsesBody(
      {
        ...baseParams,
        input: [configurationUpdate, { role: "user", content: "Finish the migration" }],
        compaction: "off",
        truncation: "disabled",
        reasoning_effort: "medium",
        temperature: 0.4,
        top_p: 0.8,
        top_logprobs: 5,
        include: ["message.output_text.logprobs"],
        prompt_cache_options: { mode: "explicit", ttl: "30m" },
      },
      getProviderModels("openai")["gpt-6-astra"],
      [
        {
          type: "function",
          function: {
            name: "slow_lookup",
            description: "Look up a slow result",
            parameters: { type: "object" },
            strict: true,
            async: true,
          },
        },
      ],
    );

    expect(body).toMatchObject({
      model: "gpt-6-astra",
      input: [configurationUpdate, { role: "user", content: "Finish the migration" }],
      reasoning: { effort: "medium", summary: "auto" },
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    });
    expect(body.tools).toContainEqual(
      expect.objectContaining({ type: "function", name: "slow_lookup", strict: true, async: true }),
    );
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("top_logprobs");
    expect(body.include).not.toContain("message.output_text.logprobs");
  });

  it("rejects configuration updates outside Astra's compatible request shape", () => {
    const input = [{ type: "configuration_update", reasoning: { effort: "high" } }];

    expect(() =>
      buildOpenAIResponsesBody(
        { ...baseParams, input, compaction: "off", truncation: "disabled" },
        getProviderModels("openai")["gpt-5.6"],
      ),
    ).toThrow("does not support configuration_update");

    expect(() =>
      buildOpenAIResponsesBody(
        { ...baseParams, input, compaction: "auto", truncation: "disabled" },
        getProviderModels("openai")["gpt-6-astra"],
      ),
    ).toThrow("require compaction=off");
  });

  it("rejects the new cache policy on older OpenAI models", () => {
    expect(() =>
      buildOpenAIResponsesBody(
        { ...baseParams, prompt_cache_options: { ttl: "30m" } },
        getProviderModels("openai")["gpt-5.5"],
      ),
    ).toThrow("does not support prompt_cache_options");
  });
});
