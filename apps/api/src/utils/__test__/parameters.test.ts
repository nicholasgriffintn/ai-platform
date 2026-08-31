import { describe, expect, it } from "vitest";

import {
  calculateReasoningBudget,
  getEffectiveMaxTokens,
  getToolsForProvider,
  resolveEffectiveMaxTokens,
  shouldEnableStreaming,
} from "../parameters";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

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
  it("allocates the full output budget for maximum reasoning", () => {
    expect(
      calculateReasoningBudget(
        {
          reasoning_effort: "max",
          max_tokens: 10_000,
        },
        {
          matchingModel: "gpt-5.6",
          provider: "openai",
          maxTokens: 10_000,
        },
      ),
    ).toBe(10_000);
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
