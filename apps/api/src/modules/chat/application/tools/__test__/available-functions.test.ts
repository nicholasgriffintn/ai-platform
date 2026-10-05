import { getToolsForProvider } from "@ngriffin_uk/polychat-ai-providers";
import { describe, expect, it } from "vitest";

import {
  resolveAvailableFunctions,
  type AvailableFunctionsSource,
} from "~/modules/chat/application/tools/available-functions";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

function toolNames(tools: unknown[] | undefined): string[] {
  return (tools ?? []).map((tool) => (tool as { function: { name: string } }).function.name);
}

function providerTools(params: AvailableFunctionsSource & { model: string }, provider = "openai") {
  return toolNames(
    getToolsForProvider({ ...params, ...resolveAvailableFunctions(params) }, modelConfig, provider)
      .tools,
  );
}

function paramsForMode(mode: string): AvailableFunctionsSource & { model: string } {
  return {
    model: "gpt-5",
    mode,
    enabled_tools: ["get_weather", "call_api"],
  };
}

describe("resolveAvailableFunctions", () => {
  it.each([
    ["poly", "schedule", "find_places"],
    ["poly", "delegation", "open_place"],
    ["chat", "user", "find_places"],
  ] as const)(
    "does not smuggle navigation into a %s conversation on a %s turn",
    (conversationType, trigger, name) => {
      const names = providerTools({
        model: "gpt-5",
        mode: "normal",
        conversation_type: conversationType,
        trigger,
        enabled_tools: [name],
        tools: [
          {
            type: "function",
            function: {
              name,
              description: name,
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      });

      expect(names).not.toContain(name);
    },
  );

  it("withholds tools blocked by the execution mode", () => {
    const names = providerTools(paramsForMode("plan"));

    expect(names).not.toContain("call_api");
    expect(names).toContain("get_weather");
  });

  it("uses the authoritative task-stage policy when preparing tools", () => {
    const names = providerTools({
      ...paramsForMode("plan"),
      conversation_type: "task",
      enabled_tools: ["call_api"],
      enforce_mode_tool_policy: false,
    });

    expect(names).toContain("call_api");
    expect(names).toContain("update_plan");
    expect(names).not.toContain("finish");
  });

  it("does not re-add disabled catalogue tools from the supplied definitions", () => {
    const names = providerTools(
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
      "google-ai-studio",
    );

    expect(names.filter((name) => name === "get_weather")).toHaveLength(1);
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("default_api:web_search");
  });

  it("keeps first-party web search independent from native search grounding", () => {
    const names = providerTools({
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
    });

    expect(names).toContain("web_search");
    expect(names).not.toContain("default_api:web_search");
  });

  it("exposes the whole catalogue as deferrable functions for tool search", () => {
    const resolved = resolveAvailableFunctions(paramsForMode("normal"));

    expect(resolved.deferred_functions.length).toBeGreaterThan(resolved.available_functions.length);
  });
});
