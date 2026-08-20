import { describe, expect, it } from "vitest";

import { DeferredToolSession, type DeferredToolEntry } from "~/lib/tools/DeferredToolSession";
import type { ChatCompletionParameters } from "~/types";
import { getToolsForProvider } from "~/utils/parameters";

const modelConfig = { supportsToolCalls: true, supportsToolChoice: false };

const externalEntry: DeferredToolEntry = {
  group: "GitHub",
  origin: "external",
  definition: {
    name: "mcp_a1b2_create_issue",
    description: "Open an issue.",
    parameters: { type: "object", properties: { title: { type: "string" } } },
  },
};

function createParams(overrides: Partial<ChatCompletionParameters> = {}) {
  return {
    model: "claude-sonnet-5",
    enabled_tools: ["create_image", "get_weather"],
    options: {},
    ...overrides,
  } as ChatCompletionParameters;
}

function toolNames(result: { tools?: any[] }): string[] {
  return (result.tools ?? []).map((tool) => tool.name);
}

describe("getToolsForProvider with deferred tools", () => {
  it("sends every enabled tool when nothing is deferred", () => {
    const names = toolNames(getToolsForProvider(createParams(), modelConfig, "anthropic"));

    expect(names).toContain("create_image");
    expect(names).toContain("get_weather");
  });

  it("withholds the definitions the session is holding back", () => {
    const deferred = new DeferredToolSession([
      { group: "Assistant tools", origin: "function", definition: { name: "create_image" } },
    ]);
    const names = toolNames(
      getToolsForProvider(createParams({ deferred_tools: deferred }), modelConfig, "anthropic"),
    );

    expect(names).not.toContain("create_image");
    expect(names).toContain("get_weather");
  });

  it("sends a withheld tool once it has been loaded", () => {
    const deferred = new DeferredToolSession([
      { group: "Assistant tools", origin: "function", definition: { name: "create_image" } },
    ]);

    deferred.load(["create_image"]);

    const result = getToolsForProvider(
      createParams({ deferred_tools: deferred }),
      modelConfig,
      "anthropic",
    );
    const loaded = (result.tools ?? []).find((tool) => tool.name === "create_image");

    expect(loaded?.input_schema).toBeDefined();
  });

  it("leaves tools the session never heard of alone", () => {
    const deferred = new DeferredToolSession([externalEntry]);
    const names = toolNames(
      getToolsForProvider(createParams({ deferred_tools: deferred }), modelConfig, "anthropic"),
    );

    expect(names).toContain("create_image");
    expect(names).not.toContain("mcp_a1b2_create_issue");
  });

  it("adds a loaded external definition that the function registry cannot resolve", () => {
    const deferred = new DeferredToolSession([externalEntry]);

    deferred.load(["mcp_a1b2_create_issue"]);

    const result = getToolsForProvider(
      createParams({ deferred_tools: deferred }),
      modelConfig,
      "anthropic",
    );
    const loaded = (result.tools ?? []).find((tool) => tool.name === "mcp_a1b2_create_issue");

    expect(loaded?.input_schema).toEqual(externalEntry.definition.parameters);
  });
});
