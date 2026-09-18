import { describe, expect, it } from "vitest";

import type { ProviderEnv } from "../env.js";
import {
  calculateReasoningBudget,
  createCommonParameters,
  createSamplingParameters,
  getEffectiveMaxTokens,
  getToolsForProvider,
  resolveEffectiveMaxTokens,
  resolveRequiredMaxTokens,
  shouldEnableStreaming,
} from "../parameters.js";
import type { ChatCompletionParameters } from "../types/index.js";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

function createTestEnv(): ProviderEnv {
  return Object.assign(Object.create(null), {});
}

function toolNames(tools: unknown[] | undefined): string[] {
  return (tools ?? []).map((tool) => (tool as { function: { name: string } }).function.name);
}

describe("getToolsForProvider", () => {
  const weather = {
    name: "get_weather",
    description: "Get weather",
    parameters: { type: "object", properties: {} },
  };
  const custom = {
    type: "function",
    function: { name: "custom_tool", description: "Custom", parameters: { type: "object" } },
  };

  it("formats the host-resolved functions for the provider and appends custom tools", () => {
    const names = toolNames(
      getToolsForProvider(
        { model: "gpt-5", available_functions: [weather], tools: [custom] },
        modelConfig,
        "openai",
      ).tools,
    );

    expect(names).toEqual(["get_weather", "custom_tool"]);
  });

  it("sends nothing when the model cannot call tools or functions are disabled", () => {
    expect(
      getToolsForProvider(
        { model: "gpt-5", available_functions: [weather] },
        { supportsToolCalls: false },
        "openai",
      ),
    ).toEqual({});
    expect(
      getToolsForProvider(
        { model: "gpt-5", available_functions: [weather], disable_functions: true },
        modelConfig,
        "openai",
      ),
    ).toEqual({});
  });

  it("maps tool choice to the provider's vocabulary", () => {
    const supportsChoice = { supportsToolCalls: true, supportsToolChoice: true };

    expect(
      getToolsForProvider(
        { model: "command-r", available_functions: [weather], tool_choice: "required" },
        supportsChoice,
        "cohere",
      ),
    ).toMatchObject({ tool_choice: "REQUIRED" });
    expect(
      getToolsForProvider(
        {
          model: "gpt-5",
          available_functions: [weather],
          tool_choice: "auto",
          parallel_tool_calls: false,
        },
        supportsChoice,
        "openai",
      ),
    ).toMatchObject({ tool_choice: "auto", parallel_tool_calls: false });
  });
});

describe("shouldEnableStreaming", () => {
  it("respects models that only support buffered upstream responses", () => {
    expect(
      shouldEnableStreaming(
        {
          matchingModel: "test-model",
          provider: "test-provider",
          modalities: { input: ["text"], output: ["text"] },
          supportsStreaming: false,
        },
        true,
        true,
      ),
    ).toBe(false);
  });
});

describe("calculateReasoningBudget", () => {
  const budgetModel = {
    matchingModel: "gpt-5.6",
    provider: "openai",
    maxTokens: 10_000,
  };

  it("keeps the maximum budget strictly below the output allowance", () => {
    expect(
      calculateReasoningBudget({ reasoning_effort: "max", max_tokens: 10_000 }, budgetModel),
    ).toBe(9_999);
    expect(
      calculateReasoningBudget({ reasoning_effort: "xhigh", max_tokens: 10_000 }, budgetModel),
    ).toBe(9_999);
  });

  it("never drops below the provider minimum, even for a tiny output allowance", () => {
    expect(
      calculateReasoningBudget({ reasoning_effort: "minimal", max_tokens: 1_200 }, budgetModel),
    ).toBe(1_024);
  });

  it("scales the budget with the requested effort", () => {
    expect(
      calculateReasoningBudget({ reasoning_effort: "low", max_tokens: 10_000 }, budgetModel),
    ).toBe(5_000);
    expect(
      calculateReasoningBudget({ reasoning_effort: "high", max_tokens: 10_000 }, budgetModel),
    ).toBe(9_000);
  });
});

describe("createCommonParameters", () => {
  it("uses Workers AI model capacity instead of the provider's short output default", () => {
    const params: ChatCompletionParameters = {
      model: "@cf/openai/gpt-oss-20b",
      env: createTestEnv(),
      messages: [{ role: "user", content: "Inspect the repository" }],
    };
    const model = { matchingModel: params.model, provider: "workers-ai", maxTokens: 16_384 };

    expect(createCommonParameters(params, model, "workers-ai").max_tokens).toBe(16_384);
    expect(
      createCommonParameters({ ...params, max_tokens: 2_048 }, model, "workers-ai").max_tokens,
    ).toBe(2_048);
    expect(
      createCommonParameters({ ...params, max_tokens: 32_768 }, model, "workers-ai").max_tokens,
    ).toBe(16_384);
  });

  const hybridModel = {
    matchingModel: "mistral-small-latest",
    provider: "mistral",
    modalities: { input: ["text"], output: ["text"] },
    reasoningConfig: {
      supportedEffortLevels: ["none", "high"],
      defaultEffort: "none",
    },
  };

  it.each([
    "azure-openai",
    "cortecs",
    "deepinfra",
    "github-copilot",
    "github-models",
    "mistral",
    "opencode",
    "opencode-go",
    "openrouter",
    "requesty",
    "vercel",
  ])("forwards configured reasoning effort through %s", (provider) => {
    const params: ChatCompletionParameters = {
      model: "mistral-small",
      env: createTestEnv(),
      messages: [{ role: "user", content: "hello" }],
      reasoning_effort: "high",
    };
    const body = createCommonParameters(params, hybridModel, provider);

    expect(body.reasoning_effort).toBe("high");
  });

  it("does not forward an effort the model does not advertise", () => {
    const params: ChatCompletionParameters = {
      model: "mistral-small",
      env: createTestEnv(),
      messages: [{ role: "user", content: "hello" }],
      reasoning_effort: "medium",
    };
    const body = createCommonParameters(params, hybridModel, "mistral");

    expect(body).not.toHaveProperty("reasoning_effort");
  });
});

describe("resolveEffectiveMaxTokens", () => {
  const capableModel = {
    matchingModel: "test-model",
    provider: "test-provider",
    maxTokens: 262_144,
  };

  it("leaves output length to the provider when no override is supplied", () => {
    expect(resolveEffectiveMaxTokens({}, capableModel)).toBeUndefined();
  });

  it("does not shorten structured JSON responses", () => {
    expect(
      resolveEffectiveMaxTokens({ response_format: { type: "json_object" } }, capableModel),
    ).toBeUndefined();
  });

  it("does not impose separate limits on agent and coding work", () => {
    expect(resolveEffectiveMaxTokens({ mode: "build" }, capableModel)).toBeUndefined();
    expect(
      resolveEffectiveMaxTokens(
        { options: { sandbox: { enabled: true, taskType: "feature-implementation" } } },
        capableModel,
      ),
    ).toBeUndefined();
  });

  it("does not impose a separate limit on reasoning models", () => {
    expect(
      resolveEffectiveMaxTokens(
        {},
        {
          ...capableModel,
          reasoningConfig: {
            supportedEffortLevels: ["low", "medium", "high"],
            defaultEffort: "medium",
          },
        },
      ),
    ).toBeUndefined();
  });

  it("allows explicit values above the defaults and clamps only to the model limit", () => {
    expect(resolveEffectiveMaxTokens({ max_tokens: 131_072 }, capableModel)).toBe(131_072);
    expect(getEffectiveMaxTokens(524_288, capableModel.maxTokens)).toBe(262_144);
  });

  it("does not invent a limit when the model's output capacity is unknown", () => {
    expect(resolveEffectiveMaxTokens({}, undefined)).toBeUndefined();
    expect(resolveEffectiveMaxTokens({ max_tokens: 5000 }, undefined)).toBe(5000);
  });

  it("uses the declared capacity only when a provider requires an output limit", () => {
    expect(resolveRequiredMaxTokens({}, capableModel)).toBe(capableModel.maxTokens);
    expect(resolveRequiredMaxTokens({ max_tokens: 1000 }, capableModel)).toBe(1000);
    expect(() => resolveRequiredMaxTokens({}, undefined)).toThrow("no declared output capacity");
  });

  it.each(["openai", "mistral", "bedrock"])(
    "omits unsolicited generation settings for %s",
    (provider) => {
      const body = createCommonParameters(
        {
          env: createTestEnv(),
          model: "test-model",
          messages: [{ role: "user", content: "Answer" }],
        },
        capableModel,
        provider,
      );

      expect(body).not.toHaveProperty("max_tokens");
      expect(body).not.toHaveProperty("max_completion_tokens");
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("top_p");
      expect(body).not.toHaveProperty("frequency_penalty");
      expect(body).not.toHaveProperty("presence_penalty");
    },
  );
});

describe("createSamplingParameters", () => {
  it("sends nothing when the caller leaves sampling on automatic", () => {
    expect(createSamplingParameters({}, { provider: "openai" })).toEqual({});
  });

  it("sends both temperature and top_p when the model does not restrict the pair", () => {
    expect(
      createSamplingParameters({ temperature: 0.4, top_p: 0.6 }, { provider: "openai" }),
    ).toEqual({ temperature: 0.4, top_p: 0.6 });
  });

  it("drops top_p only for models that restrict the combination", () => {
    expect(
      createSamplingParameters(
        { temperature: 0.4, top_p: 0.6 },
        { provider: "anthropic", restrictsCombinedTopPAndTemperature: true },
      ),
    ).toEqual({ temperature: 0.4 });
  });

  it("keeps top_p on a restricting model when no temperature is set", () => {
    expect(
      createSamplingParameters(
        { top_p: 0.6 },
        { provider: "anthropic", restrictsCombinedTopPAndTemperature: true },
      ),
    ).toEqual({ top_p: 0.6 });
  });

  it("drops both parameters the model declares unsupported", () => {
    expect(
      createSamplingParameters(
        { temperature: 0.4, top_p: 0.6 },
        { provider: "openai", supportsTemperature: false, supportsTopP: false },
      ),
    ).toEqual({});
  });

  it("clamps temperature to the Anthropic range", () => {
    expect(
      createSamplingParameters({ temperature: 1.8 }, { provider: "anthropic" }).temperature,
    ).toBe(1);
    expect(
      createSamplingParameters({ temperature: 1.8 }, { provider: "bedrock", family: "claude-opus" })
        .temperature,
    ).toBe(1);
    expect(createSamplingParameters({ temperature: 1.8 }, { provider: "openai" }).temperature).toBe(
      1.8,
    );
  });

  it("withholds top_p while provider thinking is active", () => {
    expect(
      createSamplingParameters({ top_p: 0.6, should_think: true }, { provider: "openai" }),
    ).toEqual({});
  });

  it("only sends constrained sampling parameters at a supported reasoning effort", () => {
    const samplingModelConfig = {
      provider: "openai",
      samplingSupportedReasoningEfforts: ["none" as const],
      reasoningConfig: { defaultEffort: "none" as const },
    };

    expect(
      createSamplingParameters(
        { temperature: 0.4, top_p: 0.6, reasoning_effort: "none" },
        samplingModelConfig,
      ),
    ).toEqual({ temperature: 0.4, top_p: 0.6 });
    expect(
      createSamplingParameters(
        { temperature: 0.4, top_p: 0.6, reasoning_effort: "medium" },
        samplingModelConfig,
      ),
    ).toEqual({});
  });
});
