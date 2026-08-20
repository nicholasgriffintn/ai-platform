import { describe, expect, it } from "vitest";

import { DeferredToolRegistry, type DeferredToolEntry } from "~/lib/tools/DeferredToolRegistry";
import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";

import { buildLoadToolsDescription, load_tools } from "../load_tools";

const entries: DeferredToolEntry[] = [
  {
    group: "GitHub",
    definition: {
      name: "mcp_a1b2_create_issue",
      description: "Open a new issue on a repository.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    group: "Slack",
    definition: {
      name: "mcp_a1b2_send_message",
      description: "Post a message to a Slack channel.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function createContext(registry?: DeferredToolRegistry): ToolExecutionContext {
  return { request: { env: {}, deferredTools: registry } } as unknown as ToolExecutionContext;
}

describe("load_tools", () => {
  it("reports when the conversation has no deferred tools", async () => {
    const response = await load_tools.execute({ query: "issue" }, createContext());

    expect(response.status).toBe("error");
    expect(response.data).toEqual({ loaded: [] });
  });

  it("activates the tools that match the query", async () => {
    const registry = new DeferredToolRegistry(entries);

    const response = await load_tools.execute({ query: "open an issue" }, createContext(registry));

    expect(response.status).toBe("success");
    expect(registry.activatedDefinitions().map((definition) => definition.name)).toEqual([
      "mcp_a1b2_create_issue",
    ]);
    expect(response.content).toContain("mcp_a1b2_create_issue");
  });

  it("honours the requested limit", async () => {
    const registry = new DeferredToolRegistry(entries);

    await load_tools.execute({ query: "mcp_a1b2", limit: 1 }, createContext(registry));

    expect(registry.activatedDefinitions()).toHaveLength(1);
  });

  it("activates nothing when the query matches no tool", async () => {
    const registry = new DeferredToolRegistry(entries);

    const response = await load_tools.execute({ query: "render a video" }, createContext(registry));

    expect(response.status).toBe("error");
    expect(registry.activatedDefinitions()).toEqual([]);
  });
});

describe("buildLoadToolsDescription", () => {
  it("lists every loadable tool by group", () => {
    const description = buildLoadToolsDescription(new DeferredToolRegistry(entries));

    expect(description).toContain("2 tools can be loaded");
    expect(description).toContain("GitHub (mcp_a1b2_create_issue)");
    expect(description).toContain("Slack (mcp_a1b2_send_message)");
  });

  it("falls back to group counts when the full index is too long", () => {
    const manyEntries = Array.from({ length: 400 }, (_, index): DeferredToolEntry => ({
      group: "GitHub",
      definition: {
        name: `mcp_a1b2_tool_with_a_long_name_${index}`,
        description: "A tool.",
        parameters: { type: "object", properties: {} },
      },
    }));

    const description = buildLoadToolsDescription(new DeferredToolRegistry(manyEntries));

    expect(description).toContain("GitHub (400 tools)");
    expect(description).not.toContain("mcp_a1b2_tool_with_a_long_name_0,");
  });
});
