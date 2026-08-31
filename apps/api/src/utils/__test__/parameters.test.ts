import { describe, expect, it } from "vitest";

import type { ChatCompletionParameters, IEnv } from "~/types";

import {
  calculateReasoningBudget,
  createCommonParameters,
  getEffectiveMaxTokens,
  getToolsForProvider,
  resolveEffectiveMaxTokens,
  shouldEnableStreaming,
} from "../parameters";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

function createTestEnv(): IEnv {
  return Object.assign(Object.create(null), {});
}

function toolNames(tools: unknown[] | undefined): string[] {
  return (tools ?? []).map((tool) => (tool as { function: { name: string } }).function.name);
}

function paramsForMode(mode: string): Parameters<typeof getToolsForProvider>[0] {
  return {
    model: "gpt-5",
    mode,
    enabled_tools: ["get_weather", "delegate_to_team_member"],
  };
}

describe("getToolsForProvider", () => {
  it("offers the agent control tools in an agent execution mode", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("build"), modelConfig, "openai").tools,
    );

    expect(names).toEqual(expect.arrayContaining(["update_plan", "finish"]));
  });

  it("withholds the control tools from ordinary chat, where nothing handles them", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("normal"), modelConfig, "openai").tools,
    );

    expect(names).not.toContain("update_plan");
    expect(names).not.toContain("finish");
  });

  it("withholds tools blocked by the execution mode", () => {
    const names = toolNames(
      getToolsForProvider(paramsForMode("plan"), modelConfig, "openai").tools,
    );

    expect(names).not.toContain("delegate_to_team_member");
    expect(names).toContain("get_weather");
  });

  it("offers ask_user in plan mode so the model can pause for a person", () => {
    const names = toolNames(
      getToolsForProvider(
        {
          ...paramsForMode("plan"),
          enabled_tools: ["ask_user"],
        },
        modelConfig,
        "openai",
      ).tools,
    );

    expect(names).toContain("ask_user");
  });

  it("uses the authoritative task-stage policy when preparing tools", () => {
    const names = toolNames(
      getToolsForProvider(
        {
          ...paramsForMode("plan"),
          conversation_type: "task",
          enabled_tools: ["delegate_to_team_member"],
          enforce_mode_tool_policy: false,
        },
        modelConfig,
        "openai",
      ).tools,
    );

    expect(names).toContain("delegate_to_team_member");
    expect(names).toContain("update_plan");
    expect(names).not.toContain("finish");
  });

  it("does not re-add disabled catalogue tools from the supplied definitions", () => {
    const names = toolNames(
      getToolsForProvider(
        {
          model: "gemini-flash-latest",
          mode: "normal",
          enabled_tools: ["get_weather"],
          tools: [
            {
              type: "function",
              function: {
                name: "get_weather",
                description: "Get weather",
                parameters: { type: "object", properties: {} },
              },
            },
            {
              type: "function",
              function: {
                name: "default_api:web_search",
                description: "Search the web",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
        },
        modelConfig,
        "google-ai-studio",
      ).tools,
    );

    expect(names.filter((name) => name === "get_weather")).toHaveLength(1);
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("default_api:web_search");
  });

  it("keeps first-party web search independent from native search grounding", () => {
    const names = toolNames(
      getToolsForProvider(
        {
          model: "third-party-model",
          mode: "normal",
          enabled_tools: ["web_search"],
          tools: [
            {
              type: "function",
              function: {
                name: "default_api:web_search",
                description: "Search the web",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
        },
        modelConfig,
        "openai",
      ).tools,
    );

    expect(names).toContain("web_search");
    expect(names).not.toContain("default_api:web_search");
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
  const hybridModel = {
    matchingModel: "mistral-small-latest",
    provider: "mistral",
    modalities: { input: ["text"], output: ["text"] },
    reasoningConfig: {
      supportedEffortLevels: ["none", "high"],
      defaultEffort: "none",
    },
  };

  it.each(["mistral", "openrouter", "requesty"])(
    "forwards configured reasoning effort through %s",
    (provider) => {
      const params: ChatCompletionParameters = {
        model: "mistral-small",
        env: createTestEnv(),
        messages: [{ role: "user", content: "hello" }],
        reasoning_effort: "high",
      };
      const body = createCommonParameters(params, hybridModel, provider);

      expect(body.reasoning_effort).toBe("high");
    },
  );

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

  it("uses the normal chat default when no override is supplied", () => {
    expect(resolveEffectiveMaxTokens({}, capableModel)).toBe(8_192);
  });

  it("uses the short default for structured JSON responses", () => {
    expect(
      resolveEffectiveMaxTokens({ response_format: { type: "json_object" } }, capableModel),
    ).toBe(2_048);
  });

  it("uses the long default for agent and coding work", () => {
    expect(resolveEffectiveMaxTokens({ mode: "build" }, capableModel)).toBe(16_384);
    expect(
      resolveEffectiveMaxTokens(
        { options: { sandbox: { enabled: true, taskType: "feature-implementation" } } },
        capableModel,
      ),
    ).toBe(16_384);
  });

  it("uses the reasoning default for reasoning models", () => {
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
    ).toBe(32_768);
  });

  it("allows explicit values above the defaults and clamps only to the model limit", () => {
    expect(resolveEffectiveMaxTokens({ max_tokens: 131_072 }, capableModel)).toBe(131_072);
    expect(getEffectiveMaxTokens(524_288, capableModel.maxTokens, 8_192)).toBe(262_144);
  });
});
