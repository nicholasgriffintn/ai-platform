import { describe, expect, it } from "vitest";

import { DeferredToolSession, type DeferredToolEntry } from "~/lib/tools/DeferredToolSession";

import { buildDeferredToolsSection } from "../deferred-tools";

function createEntries(count: number, group: string): DeferredToolEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    group,
    origin: "external" as const,
    definition: { name: `${group.toLowerCase()}_tool_${index}` },
  }));
}

describe("buildDeferredToolsSection", () => {
  it("says nothing when no tools are deferred", () => {
    expect(buildDeferredToolsSection(undefined)).toBe("");
    expect(buildDeferredToolsSection(new DeferredToolSession([]))).toBe("");
  });

  it("lists the tool names in each group", () => {
    const section = buildDeferredToolsSection(
      new DeferredToolSession([...createEntries(2, "GitHub"), ...createEntries(1, "Slack")]),
    );

    expect(section).toContain("<name>GitHub</name>");
    expect(section).toContain("<tools>github_tool_0, github_tool_1</tools>");
    expect(section).toContain("<tools>slack_tool_0</tools>");
    expect(section).toContain("discover_capabilities");
  });

  it("drops to group counts once the index would dominate the prompt", () => {
    const section = buildDeferredToolsSection(
      new DeferredToolSession(createEntries(200, "GitHub")),
    );

    expect(section).toContain("<count>200</count>");
    expect(section).not.toContain("github_tool_0");
  });
});
