import { describe, expect, it } from "vitest";

import { DeferredToolRegistry, type DeferredToolEntry } from "../DeferredToolRegistry";

function createEntry(name: string, group: string, description: string): DeferredToolEntry {
  return {
    group,
    definition: {
      name,
      description,
      parameters: { type: "object", properties: { id: { type: "string" } } },
    },
  };
}

const entries: DeferredToolEntry[] = [
  createEntry("mcp_a1b2_create_issue", "GitHub", "Open a new issue on a repository."),
  createEntry("mcp_a1b2_list_pull_requests", "GitHub", "List open pull requests."),
  createEntry("mcp_a1b2_send_message", "Slack", "Post a message to a Slack channel."),
];

describe("DeferredToolRegistry", () => {
  it("groups tools by the server they came from", () => {
    const registry = new DeferredToolRegistry(entries);

    expect(registry.size).toBe(3);
    expect(registry.groups()).toEqual([
      { name: "GitHub", toolNames: ["mcp_a1b2_create_issue", "mcp_a1b2_list_pull_requests"] },
      { name: "Slack", toolNames: ["mcp_a1b2_send_message"] },
    ]);
  });

  it("ranks an exact tool name above a description match", () => {
    const registry = new DeferredToolRegistry([
      ...entries,
      createEntry("mcp_a1b2_search", "GitHub", "Search issues across repositories."),
    ]);

    const matches = registry.search("mcp_a1b2_create_issue", 5);

    expect(matches[0]?.name).toBe("mcp_a1b2_create_issue");
  });

  it("matches on description and group wording", () => {
    const registry = new DeferredToolRegistry(entries);

    expect(registry.search("post a slack message", 5).map((match) => match.name)).toContain(
      "mcp_a1b2_send_message",
    );
  });

  it("returns nothing when no tool is relevant", () => {
    const registry = new DeferredToolRegistry(entries);

    expect(registry.search("render a 3d model", 5)).toEqual([]);
  });

  it("caps results at the requested limit", () => {
    const registry = new DeferredToolRegistry(entries);

    expect(registry.search("mcp", 1)).toHaveLength(1);
  });

  it("only activates tools it knows about", () => {
    const registry = new DeferredToolRegistry(entries);

    const activated = registry.activate(["mcp_a1b2_send_message", "mcp_a1b2_unknown"]);

    expect(activated.map((match) => match.name)).toEqual(["mcp_a1b2_send_message"]);
    expect(registry.activatedDefinitions()).toEqual([entries[2].definition]);
  });

  it("accumulates activations across calls in catalogue order", () => {
    const registry = new DeferredToolRegistry(entries);

    registry.activate(["mcp_a1b2_send_message"]);
    registry.activate(["mcp_a1b2_create_issue"]);

    expect(registry.activatedDefinitions().map((definition) => definition.name)).toEqual([
      "mcp_a1b2_create_issue",
      "mcp_a1b2_send_message",
    ]);
  });

  it("exposes no activated definitions before anything is loaded", () => {
    expect(new DeferredToolRegistry(entries).activatedDefinitions()).toEqual([]);
  });
});
