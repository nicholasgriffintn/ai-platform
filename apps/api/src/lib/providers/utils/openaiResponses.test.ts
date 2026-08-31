import { describe, expect, it } from "vitest";

import { openaiModelConfig } from "~/data-model/models/openai";
import type { ChatCompletionParameters } from "~/types";

import { buildOpenAIResponsesBody, shouldUseOpenAIResponsesApi } from "./openaiResponses";

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

  it("uses the responses API when a message contains a document", () => {
    const modelConfig = openaiModelConfig["gpt-5.6"];
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
    const modelConfig = openaiModelConfig["gpt-5.4"];

    expect(
      shouldUseOpenAIResponsesApi(
        { ...baseParams, enabled_tools: ["code_execution"] },
        modelConfig,
      ),
    ).toBe(true);
  });

  it("uses the responses API for function tools with reasoning", () => {
    const modelConfig = openaiModelConfig["gpt-5.4"];

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

  it("does not force the responses API for non-text output models", () => {
    const imageModel = openaiModelConfig["gpt-image-2"];

    expect(shouldUseOpenAIResponsesApi({ ...baseParams, use_responses: true }, imageModel)).toBe(
      false,
    );
  });
});

describe("current OpenAI model capabilities", () => {
  it("exposes Responses hosted tools on every GPT-5.6 model", () => {
    for (const modelId of ["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"]) {
      const modelConfig = openaiModelConfig[modelId];
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

  it("keeps pro-model hosted tool restrictions accurate", () => {
    expect(openaiModelConfig["gpt-5.4-pro"]).toMatchObject({
      supportsCodeExecution: false,
      supportsComputerUse: true,
      supportsToolSearch: true,
    });
    expect(openaiModelConfig["gpt-5.4-pro"].supportsHostedShell).toBeUndefined();
    expect(openaiModelConfig["gpt-5.5-pro"]).toMatchObject({
      supportsCodeExecution: true,
      supportsHostedShell: true,
      supportsStreaming: false,
    });
    expect(openaiModelConfig["gpt-5.5-pro"].supportsComputerUse).toBeUndefined();
    expect(openaiModelConfig["gpt-5.5-pro"].supportsToolSearch).toBeUndefined();
  });

  it("requests Luna reasoning summaries and code interpreter outputs by default", () => {
    const body = buildOpenAIResponsesBody(
      {
        ...baseParams,
        enabled_tools: ["code_execution"],
        reasoning_effort: "medium",
      },
      openaiModelConfig["gpt-5.6-luna"],
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
      openaiModelConfig["gpt-5.6-luna"],
    );

    expect(body.reasoning).toEqual({ effort: "medium", summary: "detailed" });
    expect(body.include).toBeUndefined();
  });
});
