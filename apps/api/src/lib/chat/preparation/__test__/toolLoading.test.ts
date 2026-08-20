import {
  CAPABILITY_DISCOVERY_DATA_KEY,
  CAPABILITY_DISCOVERY_TOOL_NAME,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { DeferredToolEntry } from "~/lib/tools/DeferredToolSession";
import { listFunctionTools } from "~/services/functions";
import type { CoreChatOptions, Message } from "~/types";

import { collectLoadedToolNames, resolveToolLoading } from "../toolLoading";

const externalEntries: DeferredToolEntry[] = Array.from({ length: 3 }, (_, index) => ({
  group: "GitHub",
  origin: "external",
  definition: {
    name: `mcp_a1b2_tool_${index}`,
    description: `Tool ${index}`,
    parameters: { type: "object", properties: { id: { type: "string" } } },
  },
}));

const everyTool = [
  "create_image",
  "create_video",
  "research",
  "extract_content",
  "capture_screenshot",
  "call_api",
  "web_search",
  "create_music",
  "create_speech",
];

function createOptions(overrides: Partial<CoreChatOptions> = {}): CoreChatOptions {
  return { env: {}, options: {}, ...overrides } as CoreChatOptions;
}

function resolve(overrides: Partial<CoreChatOptions>, enabledToolNames: string[]) {
  return resolveToolLoading({
    options: createOptions(overrides),
    enabledToolNames,
    provider: "anthropic",
    supportsToolCalls: true,
  });
}

describe("resolveToolLoading", () => {
  it("sends everything up front when a small tool set is enabled", () => {
    const resolution = resolve({}, ["get_weather"]);

    expect(resolution.deferredTools).toBeUndefined();
  });

  it("leaves the out-of-the-box tool set alone", () => {
    const defaultToolNames = listFunctionTools()
      .filter((tool) => tool.isDefault)
      .map((tool) => tool.name);

    expect(resolve({}, defaultToolNames).deferredTools).toBeUndefined();
    expect(
      resolveToolLoading({
        options: createOptions(),
        enabledToolNames: defaultToolNames,
        user: { id: 1, plan_id: "pro" },
        provider: "anthropic",
        supportsToolCalls: true,
      }).deferredTools,
    ).toBeUndefined();
  });

  it("defers once the enabled schemas outgrow the inline budget", () => {
    const resolution = resolve({}, everyTool);

    expect(resolution.deferredTools?.isWithheld("create_image")).toBe(true);
  });

  it("keeps the tools needed to discover and load others inline", () => {
    const resolution = resolve({}, everyTool);

    expect(resolution.deferredTools?.isWithheld(CAPABILITY_DISCOVERY_TOOL_NAME)).toBe(false);
    expect(resolution.deferredTools?.isWithheld("ask_user")).toBe(false);
    expect(resolution.deferredTools?.isWithheld("request_approval")).toBe(false);
  });

  it("never defers when the caller asks for eager loading", () => {
    const resolution = resolveToolLoading({
      options: createOptions({ tool_loading: "eager", deferred_tool_entries: externalEntries }),
      enabledToolNames: everyTool,
      provider: "anthropic",
      supportsToolCalls: true,
    });

    expect(resolution.deferredTools).toBeUndefined();
    expect(resolution.tools?.map((tool) => tool.name)).toEqual([
      "mcp_a1b2_tool_0",
      "mcp_a1b2_tool_1",
      "mcp_a1b2_tool_2",
    ]);
  });

  it("defers a small tool set when the caller asks for it", () => {
    const resolution = resolveToolLoading({
      options: createOptions({ tool_loading: "deferred" }),
      enabledToolNames: ["get_weather"],
      provider: "anthropic",
      supportsToolCalls: true,
    });

    expect(resolution.deferredTools?.isWithheld("get_weather")).toBe(true);
  });

  it("inlines externally supplied tools when it decides not to defer", () => {
    const resolution = resolveToolLoading({
      options: createOptions({ deferred_tool_entries: externalEntries }),
      enabledToolNames: [],
      provider: "anthropic",
      supportsToolCalls: true,
    });

    expect(resolution.deferredTools).toBeUndefined();
    expect(resolution.tools).toHaveLength(3);
  });

  it("puts externally supplied tools in the catalogue when it does defer", () => {
    const resolution = resolveToolLoading({
      options: createOptions({ deferred_tool_entries: externalEntries }),
      enabledToolNames: everyTool,
      provider: "anthropic",
      supportsToolCalls: true,
    });

    expect(resolution.tools).toBeUndefined();
    expect(resolution.deferredTools?.isWithheld("mcp_a1b2_tool_0")).toBe(true);
  });

  it("leaves tools alone for a model that cannot call them", () => {
    const resolution = resolveToolLoading({
      options: createOptions(),
      enabledToolNames: everyTool,
      provider: "anthropic",
      supportsToolCalls: false,
    });

    expect(resolution.deferredTools).toBeUndefined();
  });

  it("leaves tools alone when functions are disabled for the request", () => {
    const resolution = resolve({ disable_functions: true }, everyTool);

    expect(resolution.deferredTools).toBeUndefined();
  });
});

function discoveryMessage(items: unknown[]): Message {
  return {
    role: "tool",
    name: CAPABILITY_DISCOVERY_TOOL_NAME,
    content: "",
    data: {
      [CAPABILITY_DISCOVERY_DATA_KEY]: { query: "images", items, total: items.length },
    },
  };
}

describe("collectLoadedToolNames", () => {
  const readyItem = {
    id: "tool:create_image",
    kind: "tool",
    name: "Create image",
    configured: true,
    state: "ready",
    reason: "loaded",
    tags: [],
    invocation: { toolName: "create_image", availableNow: true, instruction: "call it" },
  };

  it("recovers the tools a previous turn loaded", () => {
    expect(collectLoadedToolNames([discoveryMessage([readyItem])])).toEqual(["create_image"]);
  });

  it("ignores capabilities that were not available", () => {
    const blocked = {
      ...readyItem,
      state: "unavailable",
      invocation: { ...readyItem.invocation, availableNow: false },
    };

    expect(collectLoadedToolNames([discoveryMessage([blocked])])).toEqual([]);
  });

  it("ignores recipes and connectors, which are not loadable tools", () => {
    const recipe = {
      ...readyItem,
      id: "recipe:weekly",
      kind: "recipe",
      invocation: { toolName: "trigger_recipe", availableNow: true, instruction: "call it" },
    };

    expect(collectLoadedToolNames([discoveryMessage([recipe])])).toEqual([]);
  });

  it("ignores messages that are not discovery results", () => {
    const messages: Message[] = [
      { role: "assistant", content: "hello" },
      { role: "tool", name: "get_weather", content: "sunny", data: { temperature: 20 } },
    ];

    expect(collectLoadedToolNames(messages)).toEqual([]);
  });
});
