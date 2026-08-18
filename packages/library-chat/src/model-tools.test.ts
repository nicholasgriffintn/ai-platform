import { describe, expect, it } from "vitest";

import { filterUnavailableModelToolSelections, getModelToolOptions } from "./model-tools";

const toolDefinitions = [
  {
    id: "web_fetch",
    capability: "supportsWebFetch",
    category: "Research",
    command: "web fetch",
    description: "Fetch URLs",
    label: "Web fetch",
  },
  {
    id: "hosted_shell",
    capability: "supportsHostedShell",
    category: "Development",
    command: "hosted shell",
    description: "Run shell commands",
    label: "Hosted shell",
  },
  {
    id: "mcp",
    capability: "supportsMcp",
    category: "Integrations",
    command: "mcp",
    description: "Use MCP servers",
    label: "MCP",
    requiresConfiguration: true,
  },
  {
    id: "file_search",
    capability: "supportsFileSearch",
    category: "Knowledge",
    command: "file search",
    description: "Search files",
    label: "File search",
    requiresConfiguration: true,
  },
] as const;

describe("model tool options", () => {
  it("explains available and incompatible tools for the selected model", () => {
    const options = getModelToolOptions(
      {
        supportsToolCalls: true,
        supportsFileSearch: true,
        supportsMcp: true,
        supportsWebFetch: true,
        supportsHostedShell: false,
      },
      toolDefinitions,
    );

    expect(options.find((tool) => tool.id === "web_fetch")).toMatchObject({
      available: true,
      availabilityReason: "Available for the selected model.",
      requiredModelCapabilities: ["supportsWebFetch"],
    });
    expect(options.find((tool) => tool.id === "hosted_shell")).toMatchObject({
      available: false,
      availabilityReason: "The selected model does not support hosted shell.",
      requiredModelCapabilities: ["supportsHostedShell"],
    });
    expect(options.find((tool) => tool.id === "mcp")).toMatchObject({
      available: false,
      availabilityReason: "Configure MCP servers before enabling MCP.",
      requiredModelCapabilities: ["supportsMcp"],
    });
    expect(options.find((tool) => tool.id === "file_search")).toMatchObject({
      available: false,
      availabilityReason: "Configure vector stores before enabling file search.",
      requiredModelCapabilities: ["supportsFileSearch"],
    });
  });

  it("filters stale hosted model tool selections while preserving backend tools", () => {
    expect(
      filterUnavailableModelToolSelections(["web_search", "web_fetch", "file_search"], {
        supportsToolCalls: true,
        supportsWebFetch: true,
        supportsFileSearch: true,
      }),
    ).toEqual(["web_search", "web_fetch"]);

    expect(filterUnavailableModelToolSelections(["web_search", "web_fetch"], undefined)).toEqual([
      "web_search",
      "web_fetch",
    ]);
  });
});
